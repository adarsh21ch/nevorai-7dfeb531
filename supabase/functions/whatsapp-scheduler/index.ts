// Daily WhatsApp automation runner.
// Called by pg_cron (or external cron) once a day at 10:00 IST.
// Picks up users matching each trigger and fires whatsapp-send for them.
// Idempotency via whatsapp_automation_log (UNIQUE on user_id+automation_id+period_key).
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AutomationUser {
  user_id: string;
  phone: string;
  email: string | null;
  full_name: string | null;
  period_key: string;
}

async function fireAutomation(
  supabase: SupabaseClient,
  serviceRoleKey: string,
  user: AutomationUser,
  automationId: string,
  variables: Record<string, string> = {},
): Promise<{ sent: boolean; reason?: string }> {
  // Pre-check log to avoid race condition
  const { data: existing } = await supabase
    .from("whatsapp_automation_log")
    .select("id")
    .eq("user_id", user.user_id)
    .eq("automation_id", automationId)
    .eq("period_key", user.period_key)
    .maybeSingle();
  if (existing) return { sent: false, reason: "already sent" };

  // Call whatsapp-send Edge Function (template-based send)
  const res = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        to: user.phone.replace(/\D/g, ""),
        automation_id: automationId,
        variables: {
          name: user.full_name?.split(" ")[0] || "there",
          email: user.email || "",
          ...variables,
        },
        user_id: user.user_id,
      }),
    },
  );
  const result = await res.json();
  const ok = res.ok && (result?.sent === true || result?.skipped === true);

  // Log the attempt (UNIQUE constraint guarantees idempotency)
  await supabase.from("whatsapp_automation_log").insert({
    user_id: user.user_id,
    automation_id: automationId,
    period_key: user.period_key,
    status: ok ? "sent" : "failed",
    meta_message_id: result?.meta_message_id || null,
    error_message: ok ? null : JSON.stringify(result).slice(0, 500),
  }).select(); // ignore unique-violation errors silently

  return { sent: ok, reason: ok ? "ok" : "send failed" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const summary: Record<string, { processed: number; sent: number; skipped: number }> = {};

  // Trigger map: RPC name → automation_id
  const triggers: Array<{ rpc: string; automationId: string }> = [
    { rpc: "wa_users_trial_ending_soon", automationId: "trial_ending" },
    { rpc: "wa_users_trial_expired", automationId: "trial_expired" },
    { rpc: "wa_users_plan_expiring", automationId: "plan_expiring" },
    { rpc: "wa_users_plan_expired", automationId: "plan_expired" },
  ];

  for (const t of triggers) {
    const { data: users, error } = await supabase.rpc(t.rpc);
    if (error) {
      console.error(`RPC ${t.rpc} failed:`, error.message);
      continue;
    }
    const list = (users || []) as AutomationUser[];
    summary[t.automationId] = { processed: list.length, sent: 0, skipped: 0 };

    for (const u of list) {
      const result = await fireAutomation(supabase, serviceRoleKey, u, t.automationId);
      if (result.sent) summary[t.automationId].sent++;
      else summary[t.automationId].skipped++;
    }
  }

  console.log("Scheduler summary:", JSON.stringify(summary));

  return new Response(JSON.stringify({ ok: true, summary }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
