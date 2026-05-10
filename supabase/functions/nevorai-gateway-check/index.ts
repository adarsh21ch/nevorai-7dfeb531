// nevorai-gateway-check
// Daily auto-check (cron-driven). For every Nevorai Pro user in the registry:
//  - If they have an nFlow account but no member access yet → grant it
//    (using the current gateway settings) and queue a welcome notification.
//  - If they already have access with a fixed-day duration:
//      * Revoke if expires_at has passed
//      * Send a 3-day expiry warning if not already warned
//  - Continuous duration → no-op while in registry
// Per-user errors are isolated with try/catch so one bad row never blocks
// the rest of the run.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface GatewaySettings {
  gateway_enabled: boolean;
  access_duration_type: "continuous" | "days" | "disabled";
  access_duration_days: number | null;
  notify_enabled: boolean;
  notify_in_app: boolean;
  notify_email: boolean;
  notification_template: string;
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

function buildEmailHtml(name: string, body: string, loginUrl: string): string {
  const safeBody = body.replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#ffffff;color:#1a1a1a;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
    <div style="text-align:center;margin-bottom:20px;">
      <h1 style="color:#22c55e;font-size:20px;margin:0;">nFlow</h1>
    </div>
    <h2 style="font-size:20px;margin:0 0 12px;">🎉 Welcome to nFlow, ${name}!</h2>
    <div style="font-size:15px;line-height:1.6;color:#444;">${safeBody}</div>
    <div style="text-align:center;margin:28px 0 8px;">
      <a href="${loginUrl}" style="display:inline-block;background:#22c55e;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Activate Your Access</a>
    </div>
  </div>
</body></html>`;
}

function buildWarningHtml(name: string, daysLeft: number, loginUrl: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#ffffff;color:#1a1a1a;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
    <h2 style="font-size:20px;margin:0 0 12px;">Hi ${name}, your nFlow access expires soon</h2>
    <p style="font-size:15px;line-height:1.6;color:#444;">
      Your nFlow Individual access (granted as part of your Nevorai Pro membership) expires in <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong>.
    </p>
    <p style="font-size:14px;line-height:1.6;color:#666;">
      Renew your Nevorai Pro membership to keep your nFlow access active without interruption.
    </p>
    <div style="text-align:center;margin:24px 0 8px;">
      <a href="${loginUrl}" style="display:inline-block;background:#22c55e;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Open nFlow</a>
    </div>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require service-role bearer token (cron / internal use only)
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const summary = {
    started_at: new Date().toISOString(),
    granted: 0,
    expired: 0,
    warned: 0,
    skipped_no_account: 0,
    skipped_already_active: 0,
    errors: 0,
    error_samples: [] as string[],
  };

  try {
    const { data: settingsRow } = await supabase
      .from("member_gateway_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    const settings = settingsRow as GatewaySettings | null;

    if (!settings) {
      return new Response(
        JSON.stringify({ ok: false, reason: "No gateway settings row" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!settings.gateway_enabled || settings.access_duration_type === "disabled") {
      await supabase.from("member_access_logs").insert({
        event_type: "access_checked",
        source: "auto_check",
        metadata: { reason: "gateway_disabled", settings },
      });
      await supabase
        .from("member_gateway_settings")
        .update({
          last_check_at: new Date().toISOString(),
          last_check_summary: { ...summary, skipped_reason: "gateway_disabled" },
        })
        .eq("id", 1);

      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "gateway_disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const loginUrl = `${Deno.env.get("PUBLIC_APP_URL") || "https://flow.nevorai.com"}/auth`;

    // Pull all Pro registry entries
    const { data: registry } = await supabase
      .from("nevorai_member_registry")
      .select("email, phone, full_name, is_pro")
      .eq("is_pro", true);

    for (const row of registry || []) {
      try {
        const email = row.email?.toLowerCase().trim();
        if (!email) continue;

        // Look up the nFlow profile by email
        const { data: profile } = await supabase
          .from("profiles")
          .select(
            "id, email, full_name, nevorai_member, nevorai_member_active, nevorai_member_status, nevorai_member_expires_at, nevorai_member_notified",
          )
          .ilike("email", email)
          .maybeSingle();

        if (!profile) {
          summary.skipped_no_account++;
          continue;
        }

        // Branch 1: Not yet granted
        if (!profile.nevorai_member || !profile.nevorai_member_active) {
          let expiresAt: string | null = null;
          if (settings.access_duration_type === "days" && settings.access_duration_days) {
            expiresAt = new Date(
              Date.now() + settings.access_duration_days * 86400000,
            ).toISOString();
          }

          await supabase
            .from("profiles")
            .update({
              nevorai_member: true,
              nevorai_member_active: true,
              nevorai_member_status: "active",
              nevorai_member_source: "bridge_auto",
              nevorai_member_granted_at: new Date().toISOString(),
              nevorai_member_last_checked_at: new Date().toISOString(),
              nevorai_member_expires_at: expiresAt,
              member_welcome_shown: false,
              nevorai_member_notified: false,
            })
            .eq("id", profile.id);

          await supabase.from("member_access_logs").insert({
            user_id: profile.id,
            email: profile.email,
            event_type: "granted",
            source: "auto_check",
            metadata: {
              duration_type: settings.access_duration_type,
              expires_at: expiresAt,
            },
          });

          // Queue welcome notification
          if (settings.notify_enabled) {
            const displayName = profile.full_name || row.full_name || "there";

            if (settings.notify_in_app) {
              await supabase.from("notifications").insert({
                user_id: profile.id,
                type: "member_welcome",
                title: "🎉 Welcome to nFlow!",
                message:
                  "Your Nevorai Pro membership now includes free nFlow Individual plan access.",
                data: { source: "auto_check", expires_at: expiresAt },
              });
            }

            if (settings.notify_email && profile.email) {
              const body = renderTemplate(settings.notification_template, {
                name: displayName,
                login_url: loginUrl,
              });
              try {
                await supabase.rpc("enqueue_email", {
                  queue_name: "transactional_emails",
                  payload: {
                    to: profile.email,
                    subject: "🎉 You have free nFlow Individual access",
                    html: buildEmailHtml(displayName, body, loginUrl),
                    label: "member_gateway_welcome",
                    message_id: `member-welcome-${crypto.randomUUID()}`,
                    queued_at: new Date().toISOString(),
                    from: "nFlow",
                  },
                });
                await supabase.from("member_access_logs").insert({
                  user_id: profile.id,
                  email: profile.email,
                  event_type: "notification_sent",
                  source: "auto_check",
                  metadata: { channel: "email" },
                });
              } catch (e) {
                console.error("[gateway-check] email enqueue failed", profile.email, e);
              }
            }
          }

          summary.granted++;
          continue;
        }

        // Branch 2: Already active with fixed-day duration → expiry handling
        if (profile.nevorai_member_expires_at) {
          const expiresAt = new Date(profile.nevorai_member_expires_at);
          const now = new Date();
          const msLeft = expiresAt.getTime() - now.getTime();
          const daysLeft = Math.ceil(msLeft / 86400000);

          if (msLeft <= 0) {
            await supabase
              .from("profiles")
              .update({
                nevorai_member_active: false,
                nevorai_member_status: "expired",
                nevorai_member_last_checked_at: now.toISOString(),
              })
              .eq("id", profile.id);

            await supabase.from("member_access_logs").insert({
              user_id: profile.id,
              email: profile.email,
              event_type: "expired",
              source: "auto_check",
              metadata: { expired_at: now.toISOString() },
            });
            summary.expired++;
            continue;
          }

          if (daysLeft <= 3) {
            // Send only one warning per "warning window" — check log
            const { data: recentWarn } = await supabase
              .from("member_access_logs")
              .select("id")
              .eq("user_id", profile.id)
              .eq("event_type", "warning_sent")
              .gte(
                "created_at",
                new Date(Date.now() - 4 * 86400000).toISOString(),
              )
              .limit(1)
              .maybeSingle();

            if (!recentWarn && settings.notify_enabled && settings.notify_email && profile.email) {
              const displayName = profile.full_name || "there";
              try {
                await supabase.rpc("enqueue_email", {
                  queue_name: "transactional_emails",
                  payload: {
                    to: profile.email,
                    subject: `Your nFlow access expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
                    html: buildWarningHtml(displayName, daysLeft, loginUrl),
                    label: "member_gateway_expiry_warning",
                    message_id: `member-warn-${crypto.randomUUID()}`,
                    queued_at: new Date().toISOString(),
                    from: "nFlow",
                  },
                });
                await supabase.from("member_access_logs").insert({
                  user_id: profile.id,
                  email: profile.email,
                  event_type: "warning_sent",
                  source: "auto_check",
                  metadata: { days_left: daysLeft },
                });
                summary.warned++;
              } catch (e) {
                console.error("[gateway-check] warning email failed", profile.email, e);
              }
            }
          }
        }

        // Touch last_checked_at
        await supabase
          .from("profiles")
          .update({ nevorai_member_last_checked_at: new Date().toISOString() })
          .eq("id", profile.id);

        summary.skipped_already_active++;
      } catch (perRowErr) {
        summary.errors++;
        if (summary.error_samples.length < 5) {
          summary.error_samples.push(String(perRowErr));
        }
        console.error("[gateway-check] per-row error", row.email, perRowErr);
      }
    }

    const finishedAt = new Date().toISOString();
    await supabase
      .from("member_gateway_settings")
      .update({
        last_check_at: finishedAt,
        last_check_summary: { ...summary, finished_at: finishedAt },
      })
      .eq("id", 1);

    await supabase.from("member_access_logs").insert({
      event_type: "access_checked",
      source: "auto_check",
      metadata: { ...summary, finished_at: finishedAt },
    });

    return new Response(
      JSON.stringify({ ok: true, summary }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[gateway-check] fatal error", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
