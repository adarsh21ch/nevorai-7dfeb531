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

export const Route = createFileRoute("/api/admin/whatsapp-messages/$leadId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await getUser(request);
          if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

          const { data: lead, error: leadErr } = await supabaseAdmin
            .from("whatsapp_leads")
            .select("phone_number")
            .eq("user_id", user.id)
            .eq("id", params.leadId)
            .maybeSingle();
          if (leadErr) throw leadErr;
          if (!lead) return Response.json({ error: "not_found" }, { status: 404 });

          const { data, error } = await supabaseAdmin
            .from("whatsapp_message_logs")
            .select("*")
            .eq("user_id", user.id)
            .eq("lead_phone", (lead as any).phone_number)
            .order("created_at", { ascending: true })
            .limit(100);
          if (error) throw error;
          return Response.json(data);
        } catch (err: any) {
          console.error("[whatsapp-messages GET]", err?.message || err);
          return Response.json({ error: err?.message || "failed" }, { status: 500 });
        }
      },
    },
  },
});
