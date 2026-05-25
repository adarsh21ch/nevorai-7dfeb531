// Cron-driven exit detector. Finds sessions where the viewer watched
// at least 50% but never converted, and enrolls their phone (if known)
// into the active "funnel_dropoff" automation.
//
// Trigger: cron-job.org POST with header `x-cron-secret: <CRON_SECRET>`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expected = Deno.env.get("CRON_SECRET");
  if (expected && req.headers.get("x-cron-secret") !== expected) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Active funnel_dropoff automation
  const { data: automation } = await supabase
    .from("whatsapp_automations")
    .select("id")
    .eq("trigger_event", "funnel_dropoff")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!automation) {
    return new Response(JSON.stringify({ ok: true, skipped: "no_active_automation" }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: sessions } = await supabase
    .from("funnel_engagement_sessions")
    .select("session_id, viewer_phone")
    .in("last_event", ["progress_50","progress_75"])
    .lt("last_event_at", oneHourAgo)
    .gt("last_event_at", twentyFourHoursAgo)
    .is("followup_sent_at", null)
    .not("viewer_phone", "is", null)
    .limit(200);

  let enrolled = 0;
  for (const s of sessions ?? []) {
    if (!s.viewer_phone) continue;
    const { error } = await supabase.from("whatsapp_sequence_enrollments").insert({
      phone_number: s.viewer_phone,
      automation_id: automation.id,
      current_step: 0,
      next_send_at: new Date().toISOString(),
      status: "active",
    });
    // 23505 = unique violation (already enrolled). Treat as success.
    if (!error || (error as any).code === "23505") enrolled++;
    await supabase
      .from("funnel_engagement_sessions")
      .update({ followup_sent_at: new Date().toISOString() })
      .eq("session_id", s.session_id);
  }

  return new Response(JSON.stringify({ ok: true, scanned: sessions?.length ?? 0, enrolled }), {
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
