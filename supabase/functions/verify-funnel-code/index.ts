import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { funnel_id, code } = await req.json();
    if (!funnel_id || !code || typeof funnel_id !== "string" || typeof code !== "string" || code.length > 64) {
      return new Response(JSON.stringify({ success: false, message: "Missing or invalid input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
            || req.headers.get("cf-connecting-ip") || "unknown";

    // Rate limit: 5 failed attempts per 15 minutes per (funnel, ip)
    const { data: rl } = await supabase.rpc("check_funnel_code_rate_limit", { _funnel_id: funnel_id, _ip: ip });
    if (rl && (rl as any).locked) {
      return new Response(JSON.stringify({ success: false, message: "Too many attempts. Please wait 15 minutes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: funnel, error } = await supabase
      .from("funnels")
      .select("id, access_code_hash")
      .eq("id", funnel_id)
      .single();

    if (error || !funnel) {
      return new Response(JSON.stringify({ success: false, message: "Funnel not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const submittedHash = await sha256Hex(code.trim().toUpperCase());
    const isValid = !!funnel.access_code_hash && submittedHash === funnel.access_code_hash;

    await supabase.from("funnel_access_logs").insert({
      funnel_id, code_attempted: "[redacted]", success: isValid, ip_address: ip,
    });

    return new Response(
      JSON.stringify(isValid ? { success: true } : { success: false, message: "Invalid code" }),
      { status: isValid ? 200 : 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(JSON.stringify({ success: false, message: "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
