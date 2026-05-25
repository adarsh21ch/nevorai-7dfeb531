// Server-side Meta Conversions API event fire.
// Service-role only — never callable from the browser directly.
// Reads pixel_id + access_token from meta_pixel_settings table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashed(v: string | null | undefined): Promise<string | undefined> {
  if (!v) return undefined;
  return sha256(v.trim().toLowerCase());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // Service-role gate: require the bearer to equal the service role key.
  const auth = req.headers.get("authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!auth.startsWith("Bearer ") || auth.slice(7).trim() !== serviceKey) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  try {
    const {
      event_name,
      event_id,
      user_phone = null,
      user_email = null,
      funnel_id = null,
      custom_data = {},
      action_source = "website",
      event_source_url = null,
    } = await req.json();

    if (!event_name) {
      return new Response(JSON.stringify({ error: "missing_event_name" }), {
        status: 400, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    const { data: settings } = await supabase
      .from("meta_pixel_settings").select("*").limit(1).maybeSingle();

    if (!settings || !settings.is_active || !settings.pixel_id || !settings.access_token) {
      await supabase.from("meta_pixel_events_log").insert({
        event_name, event_id, user_phone, user_email, funnel_id,
        custom_data, success: false, response: { skipped: "pixel_disabled_or_unconfigured" },
      });
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const user_data: Record<string, string | string[]> = {};
    const emH = await hashed(user_email);
    const phH = await hashed(user_phone?.replace(/\D/g, ""));
    if (emH) user_data.em = [emH];
    if (phH) user_data.ph = [phH];

    const payload: any = {
      data: [{
        event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event_id ?? undefined,
        action_source,
        event_source_url: event_source_url ?? undefined,
        user_data,
        custom_data,
      }],
    };
    if (settings.test_event_code) payload.test_event_code = settings.test_event_code;

    const url = `https://graph.facebook.com/v20.0/${settings.pixel_id}/events?access_token=${encodeURIComponent(settings.access_token)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));

    await supabase.from("meta_pixel_events_log").insert({
      event_name, event_id, user_phone, user_email, funnel_id,
      custom_data, response: json, success: res.ok,
    });

    return new Response(JSON.stringify({ ok: res.ok, response: json }), {
      status: 200, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 200, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
