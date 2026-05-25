// Daily WhatsApp automation runner.
// Called by pg_cron (or external cron) once a day at 10:00 IST.
// Picks up users matching each trigger and fires whatsapp-send for them.
// Idempotency via whatsapp_automation_log (UNIQUE on user_id+automation_id+period_key).
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AutomationUser {
  user_id: string;
  phone: string;
  email: string | null;
  full_name: string | null;
  period_key: string;
}

async function fireAutomation(
  supabase: SupabaseClient,
  serviceRoleKey: string,
  user: AutomationUser,
  automationId: string,
  variables: Record<string, string> = {},
): Promise<{ sent: boolean; reason?: string }> {
  // Pre-check log to avoid race condition
  const { data: existing } = await supabase
    .from("whatsapp_automation_log")
    .select("id")
    .eq("user_id", user.user_id)
    .eq("automation_id", automationId)
    .eq("period_key", user.period_key)
    .maybeSingle();
  if (existing) return { sent: false, reason: "already sent" };

  // Call whatsapp-send Edge Function (template-based send)
  const res = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        to: user.phone.replace(/\D/g, ""),
        automation_id: automationId,
        variables: {
          name: user.full_name?.split(" ")[0] || "there",
          email: user.email || "",
          ...variables,
        },
        user_id: user.user_id,
      }),
    },
  );
  const result = await res.json();
  const ok = res.ok && (result?.sent === true || result?.skipped === true);

  // Log the attempt (UNIQUE constraint guarantees idempotency)
  await supabase.from("whatsapp_automation_log").insert({
    user_id: user.user_id,
    automation_id: automationId,
    period_key: user.period_key,
    status: ok ? "sent" : "failed",
    meta_message_id: result?.meta_message_id || null,
    error_message: ok ? null : JSON.stringify(result).slice(0, 500),
  }).select(); // ignore unique-violation errors silently

  return { sent: ok, reason: ok ? "ok" : "send failed" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ── Security: optional shared-secret check ──
  // Set CRON_SECRET in Supabase Edge Function secrets, then pass header
  // 'x-cron-secret: <same value>' from cron-job.org. If CRON_SECRET is
  // NOT set, this check is skipped (backwards compatible).
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const provided = req.headers.get("x-cron-secret");
    if (provided !== cronSecret) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const summary: Record<string, { processed: number; sent: number; skipped: number; error?: string }> = {};

  // Trigger map: RPC name → automation_id
  const triggers: Array<{ rpc: string; automationId: string }> = [
    { rpc: "wa_users_trial_ending_soon", automationId: "trial_ending" },
    { rpc: "wa_users_trial_expired", automationId: "trial_expired" },
    { rpc: "wa_users_plan_expiring", automationId: "plan_expiring" },
    { rpc: "wa_users_plan_expired", automationId: "plan_expired" },
  ];

  for (const t of triggers) {
    summary[t.automationId] = { processed: 0, sent: 0, skipped: 0 };
    try {
      const { data: users, error } = await supabase.rpc(t.rpc);
      if (error) {
        summary[t.automationId].error = error.message;
        console.error(`RPC ${t.rpc} failed:`, error.message);
        continue;
      }
      const list = (users || []) as AutomationUser[];
      summary[t.automationId].processed = list.length;

      for (const u of list) {
        try {
          const result = await fireAutomation(supabase, serviceRoleKey, u, t.automationId);
          if (result.sent) summary[t.automationId].sent++;
          else summary[t.automationId].skipped++;
        } catch (e) {
          summary[t.automationId].skipped++;
          console.error(`fireAutomation failed for ${u.user_id}:`, (e as Error).message);
        }
      }
    } catch (e) {
      summary[t.automationId].error = (e as Error).message;
      console.error(`Trigger ${t.automationId} threw:`, (e as Error).message);
    }
  }

  // ── Landing page session reminders (~24h before session_datetime) ──
  const reminderSummary = { pages: 0, emailsSent: 0, errors: 0 };
  try {
    const now = Date.now();
    const windowStart = new Date(now + 24 * 3600_000 - 15 * 60_000).toISOString();
    const windowEnd = new Date(now + 24 * 3600_000 + 15 * 60_000).toISOString();

    const { data: pages, error: pagesErr } = await supabase
      .from("landing_pages")
      .select("id, title, session_datetime, session_link, owner_id")
      .eq("status", "published")
      .not("session_datetime", "is", null)
      .gte("session_datetime", windowStart)
      .lte("session_datetime", windowEnd);

    if (pagesErr) throw pagesErr;

    for (const page of pages || []) {
      try {
        reminderSummary.pages++;
        const { data: regs } = await supabase
          .from("landing_page_registrations")
          .select("name, email")
          .eq("landing_page_id", page.id)
          .not("email", "is", null);

        const whenLabel = new Date(page.session_datetime).toLocaleString("en-IN", {
          weekday: "short", day: "numeric", month: "long",
          hour: "numeric", minute: "2-digit", hour12: true,
          timeZone: "Asia/Kolkata",
        });

        for (const r of regs || []) {
          const email = (r.email || "").toLowerCase().trim();
          if (!email) continue;
          const joinBtn = page.session_link
            ? `<p style="margin:24px 0"><a href="${page.session_link}" style="display:inline-block;background:#7EE83A;color:#0F1424;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700">Join the Session →</a></p>`
            : "";
          const html = `
            <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
              <h2 style="margin:0 0 12px">Reminder: ${page.title} is tomorrow!</h2>
              <p>Hi ${r.name || "there"},</p>
              <p>This is a friendly reminder that <strong>${page.title}</strong> is happening on <strong>${whenLabel}</strong> (IST).</p>
              ${joinBtn}
              <p style="color:#6B7280;font-size:12px;margin-top:24px">See you there!</p>
            </div>`;
          try {
            await fetch(`${supabaseUrl}/functions/v1/send-gmail-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                user_id: page.owner_id,
                to: email,
                subject: `Reminder: ${page.title} is tomorrow!`,
                html,
              }),
            });
            reminderSummary.emailsSent++;
          } catch (e) {
            reminderSummary.errors++;
            console.error("Reminder email failed:", (e as Error).message);
          }
        }
      } catch (e) {
        reminderSummary.errors++;
        console.error(`Reminder page ${page.id} failed:`, (e as Error).message);
      }
    }
  } catch (e) {
    console.error("Landing page reminder block failed:", (e as Error).message);
  }

  console.log("Scheduler summary:", JSON.stringify(summary), "reminders:", JSON.stringify(reminderSummary));


  return new Response(JSON.stringify({ ok: true, summary }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
