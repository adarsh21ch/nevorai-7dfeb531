// Free-form WhatsApp text sender — used by the admin WhatsApp test page. (deploy v2)
// POST { to, message } → sends a plain text message via Meta Graph API.
// Uses phone_number_id and access_token from whatsapp_settings table.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { to?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const to = (body.to || "").replace(/\D/g, "");
  const message = (body.message || "").trim();
  if (!to || to.length < 8) return json({ error: "invalid_phone" }, 400);
  if (!message) return json({ error: "empty_message" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: settings } = await supabase
    .from("whatsapp_settings")
    .select("is_connected, phone_number_id, access_token")
    .limit(1)
    .maybeSingle();

  if (!settings || !settings.is_connected || !settings.phone_number_id || !settings.access_token) {
    return json({ error: "not_configured", message: "Configure WhatsApp settings in admin first." }, 400);
  }

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
          to,
          type: "text",
          text: { body: message },
        }),
      },
    );
    const result = await res.json();
    const metaId = result?.messages?.[0]?.id ?? null;

    await supabase.from("whatsapp_conversations").insert({
      phone_number: to,
      direction: "outbound",
      message_body: message,
      message_type: "text",
      meta_message_id: metaId,
      status: res.ok ? "sent" : "failed",
      reply_method: "manual",
      error_message: res.ok ? null : JSON.stringify(result?.error || result).slice(0, 500),
    });

    if (!res.ok) return json({ error: "send_failed", details: result }, 502);
    return json({ sent: true, meta_message_id: metaId });
  } catch (e) {
    const errMsg = (e as Error).message;
    await supabase.from("whatsapp_conversations").insert({
      phone_number: to,
      direction: "outbound",
      message_body: message,
      message_type: "text",
      status: "failed",
      reply_method: "manual",
      error_message: errMsg.slice(0, 500),
    });
    return json({ error: "exception", message: errMsg }, 500);
  }
});
