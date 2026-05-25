// Resolves a verified WhatsApp number to its account email so users can
// "Login with phone". Service-role read; only returns email if the number is
// linked to a verified profile.
// POST { phone_number } -> { email } | { error }
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

  let body: { phone_number?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const phone = (body.phone_number || "").replace(/\D/g, "");
  if (!phone || phone.length < 10) return json({ error: "invalid_phone" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("whatsapp_number", phone)
    .eq("whatsapp_verified", true)
    .maybeSingle();

  if (error) return json({ error: "lookup_failed" }, 500);
  if (!data?.email) return json({ error: "not_found" }, 404);

  return json({ email: data.email });
});
