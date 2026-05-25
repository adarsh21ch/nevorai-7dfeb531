// Verifies a WhatsApp OTP code.
// POST { phone_number, code } → { verified: true } | { error: ... }
//
// If user_id is also passed, updates the profile to mark phone as verified.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { phone_number?: string; code?: string; user_id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const phone = (body.phone_number || "").replace(/\D/g, "");
  const code = (body.code || "").trim();
  if (!phone || !code) return json({ error: "missing_fields" }, 400);
  if (!/^\d{6}$/.test(code)) return json({ error: "invalid_code_format" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Get most recent active OTP for this phone
  const { data: otp } = await supabase
    .from("whatsapp_otp_codes")
    .select("id, code_hash, expires_at, attempts, verified")
    .eq("phone_number", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp) return json({ error: "no_otp_found" }, 400);
  if (otp.verified) return json({ error: "already_verified" }, 400);
  if (new Date(otp.expires_at) < new Date()) return json({ error: "code_expired" }, 400);
  if (otp.attempts >= 5) return json({ error: "too_many_attempts" }, 429);

  const codeHash = await sha256(code);
  if (codeHash !== otp.code_hash) {
    await supabase
      .from("whatsapp_otp_codes")
      .update({ attempts: otp.attempts + 1 })
      .eq("id", otp.id);
    return json({ error: "wrong_code", attempts_remaining: 4 - otp.attempts }, 400);
  }

  // Mark verified
  await supabase
    .from("whatsapp_otp_codes")
    .update({ verified: true, user_id: body.user_id || null })
    .eq("id", otp.id);

  // Optionally update the user's profile
  if (body.user_id) {
    await supabase
      .from("profiles")
      .update({ whatsapp_number: phone, phone_verified_at: new Date().toISOString() })
      .eq("id", body.user_id);
  }

  return json({ verified: true });
});
