// user-data-controls
// GDPR helpers: lets a signed-in user export all their data, or permanently
// delete their account along with all associated rows.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action = "export" | "delete";
interface Body { action: Action; confirm?: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = (await req.json()) as Body;

    if (body.action === "export") {
      const tables = [
        "profiles", "user_subscriptions", "funnels", "funnel_leads",
        "landing_pages", "live_sessions", "live_registrations",
        "user_kyc_submissions", "notifications", "user_daily_views",
      ];
      const out: Record<string, unknown> = { exported_at: new Date().toISOString(), user_id: userId };
      for (const t of tables) {
        const col = t === "profiles" ? "id" : (t === "funnels" || t === "landing_pages" || t === "live_sessions") ? "owner_id" : "user_id";
        const { data } = await admin.from(t as any).select("*").eq(col, userId);
        out[t] = data || [];
      }
      return new Response(JSON.stringify(out, null, 2), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Content-Disposition": `attachment; filename="nevorai-data-${userId}.json"` },
      });
    }

    if (body.action === "delete") {
      if (body.confirm !== "DELETE") {
        return new Response(JSON.stringify({ error: "Type DELETE to confirm" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // auth.users cascade will clean child rows that have FK with ON DELETE CASCADE.
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) {
        console.error("[user-data-controls] delete failed", error);
        return new Response(JSON.stringify({ error: "Delete failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[user-data-controls] fatal", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
