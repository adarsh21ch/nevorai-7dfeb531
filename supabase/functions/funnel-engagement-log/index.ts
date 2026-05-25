// Public POST endpoint. Logs a funnel engagement event and upserts the
// rollup row in funnel_engagement_sessions. No auth required.
//
// Rate-limited in-process by IP (best-effort; per-worker memory).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-client-info, apikey",
};

type Bucket = { count: number; resetAt: number };
const ipBuckets = new Map<string, Bucket>();
function rateLimited(ip: string, max = 100, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = ipBuckets.get(ip);
  if (!b || b.resetAt < now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  b.count++;
  return b.count > max;
}

const VALID_EVENTS = new Set([
  "view_start","progress_25","progress_50","progress_75",
  "completed","lead_submitted","exit",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const ip = req.headers.get("cf-connecting-ip")
    || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
  if (rateLimited(ip)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      funnel_id, session_id, event_type,
      viewer_phone = null, viewer_email = null,
      video_position_sec = null, video_duration_sec = null,
    } = body || {};

    if (!funnel_id || !session_id || !event_type || !VALID_EVENTS.has(event_type)) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Insert raw event (best-effort)
    await supabase.from("funnel_engagement_events").insert({
      funnel_id, session_id, event_type,
      viewer_phone, viewer_email,
      video_position_sec, video_duration_sec,
    });

    // Upsert session rollup
    await supabase.from("funnel_engagement_sessions").upsert({
      session_id,
      funnel_id,
      viewer_phone,
      viewer_email,
      last_event: event_type,
      last_event_at: new Date().toISOString(),
    }, { onConflict: "session_id" });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 200, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
