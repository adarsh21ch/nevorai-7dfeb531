// Generates a 6-digit OTP, sends via WhatsApp (Authentication template),
// then stores its hash ONLY if the send succeeds.
// POST { phone_number, user_id? } → { sent: true, expires_in_seconds: 300 }
//
// Rate-limiting: max 1 OTP per phone per 60 seconds (only counts successful sends).
// OTP expires in 5 minutes. Max 5 verification attempts per code.
//
// IMPORTANT: Meta's WhatsApp Cloud API only allows free-form text inside an
// open 24-hour customer-service window. For first-time / signup OTPs, we MUST
// use a pre-approved Authentication template (HSM). The template name + lang
// are configured in whatsapp_settings.otp_template_{name,lang}.
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

function maskPhone(p: string) {
  return p.length > 4 ? `***${p.slice(-4)}` : "****";
}

// Map Meta error codes → user-friendly messages
function friendlyMetaError(code: number | undefined, raw: string): { message: string; key: string } {
  switch (code) {
    case 131047:
      return { message: "Could not deliver OTP. Please try again in a moment.", key: "reengagement_window" };
    case 131026:
      return { message: "Could not deliver to this WhatsApp number. Please check the number is correct and active on WhatsApp.", key: "undeliverable" };
    case 132000:
    case 132001:
    case 132005:
    case 132007:
      return { message: "OTP service is being set up. Please try again in a few minutes or contact support.", key: "template_issue" };
    case 190:
    case 200:
      return { message: "WhatsApp service authentication failed. Admin: refresh the access token.", key: "token_invalid" };
    case 100:
      return { message: "WhatsApp configuration error. Admin: check phone number ID and template name.", key: "config_invalid" };
    default:
      return { message: raw || "Could not send OTP. Please try again.", key: "send_failed" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { phone_number?: string; user_id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json", message: "Invalid request." }, 400); }

  const phone = (body.phone_number || "").replace(/\D/g, "");
  if (!phone || phone.length < 10) return json({ error: "invalid_phone", message: "Enter a valid 10-digit number." }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Duplicate check: another verified profile already owns this number.
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("whatsapp_number", phone)
    .eq("whatsapp_verified", true)
    .maybeSingle();
  if (existing && existing.id !== body.user_id) {
    return json({ error: "already_registered", message: "This WhatsApp number is already registered. Please login instead." }, 409);
  }

  // Rate limit: 1 OTP per phone per 60 sec (only counts successful sends).
  const sixtySecAgo = new Date(Date.now() - 60_000).toISOString();
  const { data: recent } = await supabase
    .from("whatsapp_otp_codes")
    .select("id")
    .eq("phone_number", phone)
    .gt("created_at", sixtySecAgo)
    .maybeSingle();
  if (recent) return json({ error: "rate_limit", message: "Please wait 60 seconds before requesting another OTP." }, 429);

  // Load WhatsApp settings (template config included)
  const { data: settings } = await supabase
    .from("whatsapp_settings")
    .select("is_connected, phone_number_id, access_token, otp_template_name, otp_template_lang")
    .limit(1)
    .maybeSingle();
  if (!settings?.is_connected || !settings.phone_number_id || !settings.access_token) {
    console.error("whatsapp-send-otp: not_configured", { has_settings: !!settings });
    return json({ error: "not_configured", message: "WhatsApp is not configured. Contact support." }, 400);
  }

  const templateName = settings.otp_template_name || "nevorai_otp";
  const templateLang = settings.otp_template_lang || "en";

  const code = generateOtp();

  // 1) Send via Meta FIRST. Only persist on success.
  let sendResult: { ok: boolean; metaCode?: number; rawError?: string; messageId?: string } = { ok: false };
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
          type: "template",
          template: {
            name: templateName,
            language: { code: templateLang },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: code }],
              },
              {
                type: "button",
                sub_type: "copy_code",
                index: "0",
                parameters: [{ type: "coupon_code", coupon_code: code }],
              },
            ],
          },
        }),
      },
    );
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      const metaCode = result?.error?.code as number | undefined;
      const rawMsg = result?.error?.message as string | undefined;
      console.error("whatsapp-send-otp: meta_send_failed", {
        phone: maskPhone(phone),
        http: res.status,
        meta_code: metaCode,
        meta_subcode: result?.error?.error_subcode,
        meta_message: rawMsg,
        template: templateName,
      });
      sendResult = { ok: false, metaCode, rawError: rawMsg };
    } else {
      sendResult = { ok: true, messageId: result?.messages?.[0]?.id };
    }
  } catch (e) {
    console.error("whatsapp-send-otp: fetch_exception", { phone: maskPhone(phone), err: (e as Error).message });
    return json({ error: "exception", message: "Network error reaching WhatsApp. Please try again." }, 500);
  }

  if (!sendResult.ok) {
    const friendly = friendlyMetaError(sendResult.metaCode, sendResult.rawError || "");
    // If template is missing/disapproved, attempt one fallback to free-form text
    // (works only if the user is inside an open 24h window with our number).
    if (friendly.key === "template_issue") {
      try {
        const textMsg = `Your Nevorai verification code is: *${code}*\n\nThis code expires in 5 minutes. Do not share it with anyone.`;
        const res2 = await fetch(
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
              text: { body: textMsg },
            }),
          },
        );
        const r2 = await res2.json().catch(() => ({}));
        if (res2.ok) {
          sendResult = { ok: true, messageId: r2?.messages?.[0]?.id };
          console.warn("whatsapp-send-otp: fallback_text_sent", { phone: maskPhone(phone) });
        } else {
          console.error("whatsapp-send-otp: fallback_text_failed", { phone: maskPhone(phone), meta: r2?.error });
        }
      } catch (e) {
        console.error("whatsapp-send-otp: fallback_text_exception", { err: (e as Error).message });
      }
    }
  }

  if (!sendResult.ok) {
    const friendly = friendlyMetaError(sendResult.metaCode, sendResult.rawError || "");
    return json({
      error: friendly.key,
      message: friendly.message,
      meta_code: sendResult.metaCode ?? null,
    }, 502);
  }

  // 2) Persist hash ONLY after successful send
  const codeHash = await sha256(code);
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const { error: insErr } = await supabase.from("whatsapp_otp_codes").insert({
    phone_number: phone,
    code_hash: codeHash,
    expires_at: expiresAt,
    attempts: 0,
    verified: false,
  });
  if (insErr) {
    console.error("whatsapp-send-otp: insert_failed", { err: insErr.message });
    // OTP was sent but we couldn't store hash — user can request again
    return json({ error: "store_failed", message: "OTP sent but storage failed. Please request again." }, 500);
  }

  return json({ sent: true, expires_in_seconds: 300 });
});
