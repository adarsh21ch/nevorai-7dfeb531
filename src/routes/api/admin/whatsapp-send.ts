import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getUser(request: Request) {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  const token = auth?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export const Route = createFileRoute("/api/admin/whatsapp-send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await getUser(request);
          if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

          const { lead_phone, message_body } = await request.json();
          if (!lead_phone || !message_body) {
            return Response.json({ error: "missing_fields" }, { status: 400 });
          }

          const supaUrl = process.env.SUPABASE_URL;
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!supaUrl || !serviceKey) {
            return Response.json({ error: "server_misconfigured" }, { status: 500 });
          }

          const upstream = await fetch(`${supaUrl}/functions/v1/whatsapp-send-text`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ phone_number: lead_phone, message_body }),
          });
          const result = await upstream.json().catch(() => ({}));

          if ((result as any)?.sent) {
            const { error: logErr } = await supabaseAdmin
              .from("whatsapp_message_logs")
              .insert({
                user_id: user.id,
                lead_phone,
                direction: "outbound",
                message_type: "text",
                message_body,
                delivery_status: "sent",
                sent_at: new Date().toISOString(),
              });
            if (logErr) console.error("[whatsapp-send log insert]", logErr.message);
          }

          return Response.json(result, { status: upstream.status });
        } catch (err: any) {
          console.error("[whatsapp-send POST]", err?.message || err);
          return Response.json({ error: err?.message || "failed" }, { status: 500 });
        }
      },
    },
  },
});
