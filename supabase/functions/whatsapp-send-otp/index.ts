// Generates a 6-digit OTP, stores its hash, sends via WhatsApp.
// POST { phone_number } → { sent: true, expires_in_seconds: 300 }
//
// Rate-limiting: max 1 OTP per phone per 60 seconds.
// OTP expires in 5 minutes. Max 5 verification attempts per code.
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

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { phone_number?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const phone = (body.phone_number || "").replace(/\D/g, "");
  if (!phone || phone.length < 10) return json({ error: "invalid_phone" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Rate limit: 1 OTP per phone per 60 sec
  const sixtySecAgo = new Date(Date.now() - 60_000).toISOString();
  const { data: recent } = await supabase
    .from("whatsapp_otp_codes")
    .select("id")
    .eq("phone_number", phone)
    .gt("created_at", sixtySecAgo)
    .maybeSingle();
  if (recent) return json({ error: "rate_limit", message: "Please wait 60 seconds before requesting another OTP." }, 429);

  // Load WhatsApp settings
  const { data: settings } = await supabase
    .from("whatsapp_settings")
    .select("is_connected, phone_number_id, access_token")
    .limit(1)
    .maybeSingle();
  if (!settings?.is_connected || !settings.phone_number_id || !settings.access_token) {
    return json({ error: "not_configured" }, 400);
  }

  // Generate + store hash
  const code = generateOtp();
  const codeHash = await sha256(code);
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

  await supabase.from("whatsapp_otp_codes").insert({
    phone_number: phone,
    code_hash: codeHash,
    expires_at: expiresAt,
    attempts: 0,
    verified: false,
  });

  // Send via WhatsApp free-form text
  const message = `Your Nevorai verification code is: *${code}*\n\nThis code expires in 5 minutes. Do not share it with anyone.`;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${settings.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: message },
        }),
      },
    );
    const result = await res.json();
    if (!res.ok) {
      return json({ error: "send_failed", details: result }, 502);
    }
    return json({ sent: true, expires_in_seconds: 300 });
  } catch (e) {
    return json({ error: "exception", message: (e as Error).message }, 500);
  }
});
