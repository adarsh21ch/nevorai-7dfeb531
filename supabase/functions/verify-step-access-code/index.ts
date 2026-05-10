import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Constant-time string comparison to prevent timing attacks on access codes.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { funnel_id, step_id, code, session_id } = await req.json();

    if (!funnel_id || !step_id || !code) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (typeof code !== "string" || code.length > 32) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid code format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    // Rate limit: max 5 failed attempts in last 15 minutes per (step + session OR ip)
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: recentFailures } = await supabase
      .from("step_access_logs")
      .select("id", { count: "exact", head: true })
      .eq("funnel_step_id", step_id)
      .eq("success", false)
      .gte("attempted_at", since)
      .or(`session_id.eq.${session_id ?? ""},ip_address.eq.${ip}`);

    if ((recentFailures ?? 0) >= 5) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Too many attempts. Please try again in 15 minutes.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch step config (hash-only)
    const { data: step, error } = await supabase
      .from("funnel_steps")
      .select("id, access_code_enabled, access_code_hash")
      .eq("id", step_id)
      .eq("funnel_id", funnel_id)
      .maybeSingle();

    if (error || !step) {
      return new Response(
        JSON.stringify({ success: false, message: "Step not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!step.access_code_enabled || !step.access_code_hash) {
      return new Response(
        JSON.stringify({ success: true, no_code_required: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const provided = code.trim().toUpperCase();
    const providedHash = await sha256Hex(provided);
    const isValid = timingSafeEqual(String(step.access_code_hash), providedHash);

    // Audit log every attempt
    await supabase.from("step_access_logs").insert({
      funnel_id,
      funnel_step_id: step_id,
      session_id: session_id ?? null,
      code_attempted: code,
      success: isValid,
      ip_address: ip,
    });

    if (isValid) {
      // Mark this session's progress row as code-unlocked (if exists)
      if (session_id) {
        await supabase
          .from("funnel_step_progress")
          .update({ access_code_unlocked: true })
          .eq("funnel_id", funnel_id)
          .eq("funnel_step_id", step_id)
          .eq("session_id", session_id);
      }
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: "Incorrect code." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (_err) {
    return new Response(
      JSON.stringify({ success: false, message: "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
