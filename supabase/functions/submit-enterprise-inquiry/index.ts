// submit-enterprise-inquiry
// Public endpoint (no auth required) to:
//   1. Persist a new Enterprise plan inquiry into enterprise_inquiries
//   2. Notify the admin team via Gmail (primary: teamnevorai@gmail.com,
//      CC: connected OAuth Gmail address if different)
//
// Errors during email send are logged but never block the inquiry being saved
// — the admin will always see the new inquiry in the dashboard.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PRIMARY_ADMIN_EMAIL = "teamnevorai@gmail.com";

interface InquiryBody {
  full_name: string;
  whatsapp_phone: string;
  email: string;
  network_name: string;
  team_size: string;
  platform?: string;
  custom_needs?: string;
}

const TEAM_SIZE_OPTIONS = ["100-500", "500-1000", "1000-5000", "5000+"];

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildAdminEmailHtml(b: InquiryBody, ip: string | null) {
  const rows: [string, string][] = [
    ["Name", b.full_name],
    ["WhatsApp", b.whatsapp_phone],
    ["Email", b.email],
    ["Network / Company", b.network_name],
    ["Team size", b.team_size],
    ["Platform", b.platform || "—"],
    ["Custom needs", b.custom_needs || "—"],
    ["IP", ip || "—"],
    ["Submitted", new Date().toISOString()],
  ];
  const tableRows = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;color:#555;width:160px;font-weight:600;">${escapeHtml(
          k,
        )}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;color:#1a1a1a;white-space:pre-wrap;">${escapeHtml(
          v,
        )}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f7f8;padding:32px 16px;color:#1a1a1a;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e5e5e5;">
    <div style="margin-bottom:18px;">
      <h1 style="font-size:18px;color:#0f172a;margin:0 0 4px;">New Enterprise Inquiry</h1>
      <p style="font-size:13px;color:#666;margin:0;">A team leader just requested a custom white-label app.</p>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">${tableRows}</table>
    <p style="margin-top:20px;font-size:12px;color:#888;">Reply to this email or contact them on WhatsApp directly.</p>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let body: InquiryBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Validate required fields
  const errors: Record<string, string> = {};
  const trim = (s: any) => (typeof s === "string" ? s.trim() : "");

  body.full_name = trim(body.full_name);
  body.whatsapp_phone = trim(body.whatsapp_phone);
  body.email = trim(body.email).toLowerCase();
  body.network_name = trim(body.network_name);
  body.team_size = trim(body.team_size);
  body.platform = trim(body.platform);
  body.custom_needs = trim(body.custom_needs);

  if (!body.full_name || body.full_name.length > 120) errors.full_name = "Required";
  if (!body.whatsapp_phone || body.whatsapp_phone.length > 30) errors.whatsapp_phone = "Required";
  if (!body.email || !isValidEmail(body.email) || body.email.length > 200) errors.email = "Valid email required";
  if (!body.network_name || body.network_name.length > 200) errors.network_name = "Required";
  if (!body.team_size || !TEAM_SIZE_OPTIONS.includes(body.team_size)) errors.team_size = "Invalid team size";
  if (body.platform && body.platform.length > 200) errors.platform = "Too long";
  if (body.custom_needs && body.custom_needs.length > 2000) errors.custom_needs = "Too long";

  if (Object.keys(errors).length) {
    return new Response(
      JSON.stringify({ error: "Validation failed", fields: errors }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    null;
  const ua = req.headers.get("user-agent") || null;

  // Insert inquiry
  const { data: inserted, error: insertErr } = await supabase
    .from("enterprise_inquiries")
    .insert({
      full_name: body.full_name,
      whatsapp_phone: body.whatsapp_phone,
      email: body.email,
      network_name: body.network_name,
      team_size: body.team_size,
      platform: body.platform || null,
      custom_needs: body.custom_needs || null,
      ip_address: ip,
      user_agent: ua,
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("[enterprise-inquiry] insert error", insertErr);
    return new Response(
      JSON.stringify({ error: "Failed to save inquiry" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Determine recipients: primary + CC OAuth Gmail (if different)
  let ccEmail: string | null = null;
  try {
    const { data: token } = await supabase
      .from("gmail_oauth_tokens")
      .select("gmail_email")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (token?.gmail_email && token.gmail_email.toLowerCase() !== PRIMARY_ADMIN_EMAIL) {
      ccEmail = token.gmail_email;
    }
  } catch (e) {
    console.warn("[enterprise-inquiry] could not look up oauth gmail", e);
  }

  const subject = `New Enterprise Inquiry — ${body.full_name} — ${body.team_size}`;
  const html = buildAdminEmailHtml(body, ip);

  // Queue/send via gmail. We send primary first, then CC as a separate
  // message (Gmail-via-our-edge-function doesn't currently support CC headers
  // — easiest correct path is two separate sends marked as such).
  const sendOne = async (to: string) => {
    try {
      const res = await supabase.functions.invoke("send-gmail-email", {
        body: {
          to,
          subject,
          html,
          sender_name: "Nevorai Notifications",
        },
      });
      if (res.error) {
        console.error(`[enterprise-inquiry] send to ${to} failed`, res.error);
      }
    } catch (e) {
      console.error(`[enterprise-inquiry] send to ${to} threw`, e);
    }
  };

  // Fire emails — do not block response on them
  await sendOne(PRIMARY_ADMIN_EMAIL);
  if (ccEmail) await sendOne(ccEmail);

  return new Response(
    JSON.stringify({ ok: true, inquiry_id: inserted.id }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
