// member-gateway-admin
// Admin-only endpoint for managing individual members of the Nevorai
// gateway: pause, resume, extend, revoke, resend welcome notification.
// Validates that the caller has the 'admin' role and audit-logs every action.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action =
  | "pause"
  | "resume"
  | "extend"
  | "revoke"
  | "resend_notification";

interface AdminRequest {
  action: Action;
  target_user_id: string;
  add_days?: number;
}

function buildWelcomeHtml(name: string, loginUrl: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#ffffff;color:#1a1a1a;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
    <h2 style="font-size:20px;margin:0 0 12px;">🎉 Welcome to Nevorai, ${name}!</h2>
    <p style="font-size:15px;line-height:1.6;color:#444;">
      As a Nevorai Pro member, you have free access to the Nevorai Individual plan.
    </p>
    <p style="font-size:14px;line-height:1.6;color:#666;">
      Create video funnels, capture leads, and track your prospects — at no extra cost.
    </p>
    <div style="text-align:center;margin:24px 0 8px;">
      <a href="${loginUrl}" style="display:inline-block;background:#22c55e;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Activate Your Access</a>
    </div>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const adminUserId = user.id;

    // Service-role client for the actual writes
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify admin role
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: adminUserId,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as AdminRequest;
    if (!body.action || !body.target_user_id) {
      return new Response(
        JSON.stringify({ error: "action and target_user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "id, email, full_name, nevorai_member, nevorai_member_active, nevorai_member_status, nevorai_member_expires_at",
      )
      .eq("id", body.target_user_id)
      .maybeSingle();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Target user not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const now = new Date().toISOString();

    switch (body.action) {
      case "pause": {
        await supabase
          .from("profiles")
          .update({
            nevorai_member_active: false,
            nevorai_member_status: "paused",
          })
          .eq("id", profile.id);
        await supabase.from("member_access_logs").insert({
          user_id: profile.id,
          email: profile.email,
          event_type: "paused",
          source: "admin",
          metadata: { admin_user_id: adminUserId },
        });
        break;
      }

      case "resume": {
        await supabase
          .from("profiles")
          .update({
            nevorai_member: true,
            nevorai_member_active: true,
            nevorai_member_status: "active",
          })
          .eq("id", profile.id);
        await supabase.from("member_access_logs").insert({
          user_id: profile.id,
          email: profile.email,
          event_type: "resumed",
          source: "admin",
          metadata: { admin_user_id: adminUserId },
        });
        break;
      }

      case "extend": {
        const days = Number(body.add_days);
        if (!days || days <= 0 || days > 3650) {
          return new Response(
            JSON.stringify({ error: "add_days must be between 1 and 3650" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const baseTs = profile.nevorai_member_expires_at
          ? new Date(profile.nevorai_member_expires_at).getTime()
          : Date.now();
        const newExpiry = new Date(
          Math.max(baseTs, Date.now()) + days * 86400000,
        ).toISOString();

        await supabase
          .from("profiles")
          .update({
            nevorai_member: true,
            nevorai_member_active: true,
            nevorai_member_status: "active",
            nevorai_member_expires_at: newExpiry,
          })
          .eq("id", profile.id);
        await supabase.from("member_access_logs").insert({
          user_id: profile.id,
          email: profile.email,
          event_type: "granted",
          source: "admin",
          metadata: {
            admin_user_id: adminUserId,
            extension_days: days,
            new_expires_at: newExpiry,
          },
        });
        break;
      }

      case "revoke": {
        await supabase
          .from("profiles")
          .update({
            nevorai_member_active: false,
            nevorai_member_status: "revoked",
          })
          .eq("id", profile.id);
        await supabase.from("member_access_logs").insert({
          user_id: profile.id,
          email: profile.email,
          event_type: "revoked",
          source: "admin",
          metadata: { admin_user_id: adminUserId },
        });
        break;
      }

      case "resend_notification": {
        if (!profile.email) {
          return new Response(
            JSON.stringify({ error: "Profile has no email" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const loginUrl = `${Deno.env.get("PUBLIC_APP_URL") || "https://flow.nevorai.com"}/auth`;
        const displayName = profile.full_name || "there";

        await supabase.from("notifications").insert({
          user_id: profile.id,
          type: "member_welcome",
          title: "🎉 Nevorai Individual access",
          message:
            "Your Nevorai Pro membership includes free Nevorai Individual plan access.",
          data: { source: "admin_resend" },
        });

        await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            to: profile.email,
            subject: "Your Nevorai Individual access",
            html: buildWelcomeHtml(displayName, loginUrl),
            label: "member_gateway_resend",
            message_id: `member-resend-${crypto.randomUUID()}`,
            queued_at: now,
            from: "Nevorai",
          },
        });

        await supabase
          .from("profiles")
          .update({
            nevorai_member_notified: false,
            member_welcome_shown: false,
          })
          .eq("id", profile.id);

        await supabase.from("member_access_logs").insert({
          user_id: profile.id,
          email: profile.email,
          event_type: "notification_sent",
          source: "admin",
          metadata: { admin_user_id: adminUserId, resent: true },
        });
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${body.action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    // Tamper-proof admin audit trail (writes to admin_audit_logs via SECURITY DEFINER RPC)
    try {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("cf-connecting-ip")
        || null;
      const ua = req.headers.get("user-agent") || null;
      await supabase.rpc("log_admin_action", {
        _admin_user_id: adminUserId,
        _action: `member_gateway_${body.action}`,
        _target_type: "user",
        _target_id: profile.id,
        _metadata: {
          target_email: profile.email,
          add_days: body.add_days ?? null,
        },
        _ip_address: ip,
        _user_agent: ua,
      });
    } catch (auditErr) {
      // Never fail the action just because audit logging failed; log it loudly.
      console.error("[member-gateway-admin] audit log failed", auditErr);
    }

    return new Response(
      JSON.stringify({ ok: true, action: body.action }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[member-gateway-admin] fatal", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
