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

export const Route = createFileRoute("/api/admin/whatsapp-leads")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await getUser(request);
          if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

          const url = new URL(request.url);
          const search = url.searchParams.get("search");
          const status = url.searchParams.get("status");

          let q = supabaseAdmin
            .from("whatsapp_leads")
            .select("*")
            .eq("user_id", user.id);

          if (status) q = q.eq("status", status);
          if (search) {
            const s = search.replace(/[%,]/g, "");
            q = q.or(`name.ilike.%${s}%,phone_number.ilike.%${s}%`);
          }

          const { data, error } = await q.order("created_at", { ascending: false });
          if (error) throw error;
          return Response.json(data);
        } catch (err: any) {
          console.error("[whatsapp-leads GET]", err?.message || err);
          return Response.json({ error: err?.message || "failed" }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await getUser(request);
          if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

          const body = await request.json();
          const { data, error } = await supabaseAdmin
            .from("whatsapp_leads")
            .insert({ ...body, user_id: user.id })
            .select()
            .single();
          if (error) throw error;
          return Response.json(data);
        } catch (err: any) {
          console.error("[whatsapp-leads POST]", err?.message || err);
          return Response.json({ error: err?.message || "failed" }, { status: 500 });
        }
      },
    },
  },
});
