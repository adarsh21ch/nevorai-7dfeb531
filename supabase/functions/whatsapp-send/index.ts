// WhatsApp Cloud API sender. Returns { skipped:true } when not configured
// so callers (other edge functions / triggers) can degrade gracefully.
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

interface SendBody {
  to: string;                 // E.164 phone, e.g. 919876543210
  automation_id: string;      // welcome_signup, trial_ending, ...
  template_name?: string;     // overrides settings lookup
  variables?: Record<string, string>;
  user_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: SendBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const to = (body.to || "").replace(/\D/g, "");
  const automationId = (body.automation_id || "").trim();
  if (!to || !automationId) return json({ error: "to and automation_id required" }, 400);

  const { data: settings } = await supabase
    .from("whatsapp_settings")
    .select("is_connected, phone_number_id, access_token, automations_enabled, templates")
    .limit(1)
    .maybeSingle();

  if (!settings || !settings.is_connected || !settings.phone_number_id || !settings.access_token) {
    await supabase.from("whatsapp_logs").insert({
      user_id: body.user_id ?? null,
      phone_number: to,
      automation_id: automationId,
      status: "skipped",
      error_message: "WhatsApp not configured",
    });
    return json({ skipped: true, reason: "not_configured" });
  }

  const enabled = (settings.automations_enabled || {}) as Record<string, boolean>;
  if (enabled[automationId] === false) {
    await supabase.from("whatsapp_logs").insert({
      user_id: body.user_id ?? null,
      phone_number: to,
      automation_id: automationId,
      status: "skipped",
      error_message: "Automation disabled",
    });
    return json({ skipped: true, reason: "disabled" });
  }

  // Resolve template name
  const templates = (settings.templates || []) as Array<{ automation_id: string; template_name: string; language?: string }>;
  const tpl = body.template_name
    ? { template_name: body.template_name, language: "en" }
    : templates.find((t) => t.automation_id === automationId);
  if (!tpl?.template_name) {
    await supabase.from("whatsapp_logs").insert({
      user_id: body.user_id ?? null,
      phone_number: to,
      automation_id: automationId,
      status: "skipped",
      error_message: "No template mapped",
    });
    return json({ skipped: true, reason: "no_template" });
  }

  // Build template payload
  const components = body.variables && Object.keys(body.variables).length
    ? [{
        type: "body",
        parameters: Object.values(body.variables).map((v) => ({ type: "text", text: String(v) })),
      }]
    : [];

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
          type: "template",
          template: {
            name: tpl.template_name,
            language: { code: (tpl as any).language || "en" },
            components,
          },
        }),
      },
    );
    const result = await res.json();
    if (!res.ok) {
      await supabase.from("whatsapp_logs").insert({
        user_id: body.user_id ?? null,
        phone_number: to,
        automation_id: automationId,
        template_name: tpl.template_name,
        status: "failed",
        error_message: JSON.stringify(result?.error || result).slice(0, 500),
      });
      return json({ error: "send_failed", details: result }, 502);
    }
    const metaId = result?.messages?.[0]?.id || null;
    await supabase.from("whatsapp_logs").insert({
      user_id: body.user_id ?? null,
      phone_number: to,
      automation_id: automationId,
      template_name: tpl.template_name,
      status: "sent",
      meta_message_id: metaId,
    });
    return json({ sent: true, meta_message_id: metaId });
  } catch (e) {
    await supabase.from("whatsapp_logs").insert({
      user_id: body.user_id ?? null,
      phone_number: to,
      automation_id: automationId,
      template_name: tpl.template_name,
      status: "failed",
      error_message: (e as Error).message?.slice(0, 500),
    });
    return json({ error: "exception", message: (e as Error).message }, 500);
  }
});
