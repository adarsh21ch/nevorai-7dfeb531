// check-funnel-view-limit
// Public endpoint called by the funnel viewer on the first 'play' event.
// Atomically increments the funnel OWNER's daily counter (per-user, shared
// across all their funnels) and returns whether the view is allowed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CheckRequest {
  funnelId: string;
  sessionId?: string;
}

// Lightweight stable session hash (per visitor + creator + day)
async function hashSession(parts: string[]): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(parts.join("|"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { funnelId, sessionId } = (await req.json()) as CheckRequest;

    if (!funnelId || !/^[0-9a-f-]{36}$/i.test(funnelId)) {
      return new Response(
        JSON.stringify({ allowed: false, error: "Invalid funnel id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up funnel owner so we can build a per-creator session hash
    const { data: funnel } = await supabase
      .from("funnels")
      .select("id, owner_id, is_published")
      .eq("id", funnelId)
      .maybeSingle();

    if (!funnel || !funnel.is_published) {
      return new Response(
        JSON.stringify({ allowed: false, error: "Funnel not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build a stable session id when caller didn't supply one
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || "0.0.0.0";
    const ua = req.headers.get("user-agent") || "unknown";
    const istDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const effectiveSession = sessionId
      || await hashSession([ip, ua, funnel.owner_id, istDate]);

    // Atomic per-user increment + dedup + threshold notifications happen in DB
    const { data, error } = await supabase.rpc("increment_user_daily_view", {
      _funnel_id: funnelId,
      _session_id: effectiveSession,
    });

    if (error) {
      console.error("[check-funnel-view-limit] RPC failed:", error);
      // Fail open — never block real prospects on infra hiccups
      return new Response(
        JSON.stringify({ allowed: true, error: "counter_unavailable" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = data as {
      allowed: boolean;
      currentCount?: number;
      limit?: number;
      unlimited?: boolean;
      deduped?: boolean;
      reason?: string;
    } | null;

    return new Response(
      JSON.stringify(result ?? { allowed: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[check-funnel-view-limit] Unhandled error:", e);
    return new Response(
      JSON.stringify({ allowed: true, error: "internal" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
