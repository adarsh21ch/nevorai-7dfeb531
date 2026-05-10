// Sends reminder emails for upcoming live (simulated-live) sessions.
// Triggered by pg_cron every 5 minutes. Idempotent via reminder flags.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function enqueueEmail(svc: any, to: string, subject: string, html: string, template: string) {
  try {
    await svc.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: { to, subject, html, purpose: "transactional", template },
    });
  } catch (e) {
    console.warn("enqueue_email failed:", e);
  }
}

function fmtIST(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function reminderHtml(opts: {
  name: string | null;
  title: string;
  whenLabel: string;
  slotIso: string;
  link: string;
  windowLabel: string;
}) {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0F1424;color:#E5E7EB;border-radius:12px">
    <h2 style="margin:0 0 12px;color:#fff">${opts.windowLabel}</h2>
    <p style="margin:0 0 16px">Hi ${opts.name || "there"}, this is a reminder for:</p>
    <div style="background:#1A2236;border-radius:10px;padding:16px;margin-bottom:16px">
      <p style="margin:0;font-size:18px;font-weight:600;color:#fff">${opts.title}</p>
      <p style="margin:8px 0 0;color:#9CA3AF;font-size:14px">${opts.whenLabel} (IST)</p>
    </div>
    <a href="${opts.link}" style="display:inline-block;background:linear-gradient(90deg,#7EE83A,#1D4ED8);color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600">Join Session</a>
    <p style="margin:24px 0 0;color:#6B7280;font-size:12px">You're receiving this because you registered for this session on nFlow.</p>
  </div>`;
}

// Returns reminder windows that this slot falls into right now
function reminderWindows(slotMs: number, now: number): Array<"24h" | "1h" | "10m"> {
  const diff = slotMs - now; // ms until start
  const out: Array<"24h" | "1h" | "10m"> = [];
  // 24h window: 23h45m..24h15m
  if (diff > 23.75 * 3600_000 && diff <= 24.25 * 3600_000) out.push("24h");
  // 1h window: 55..65 min
  if (diff > 55 * 60_000 && diff <= 65 * 60_000) out.push("1h");
  // 10m window: 7..12 min
  if (diff > 7 * 60_000 && diff <= 12 * 60_000) out.push("10m");
  return out;
}

const labelMap: Record<string, string> = {
  "24h": "Reminder: Your session is tomorrow",
  "1h": "Starting in 1 hour",
  "10m": "Starting in 10 minutes — join now",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Require service-role bearer token (cron / internal use only)
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token !== SERVICE_ROLE_KEY) {
    return json({ error: "Unauthorized" }, 401);
  }

  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const now = Date.now();
  let queued = 0;
  let skipped = 0;

  try {
    // Find sessions that have at least one slot in the next 25 hours
    const { data: sessions, error } = await svc
      .from("live_sessions")
      .select("id, slug, title, scheduled_times, session_type")
      .eq("session_type", "funnel_video")
      .in("status", ["scheduled", "live"]);
    if (error) throw error;

    for (const s of sessions || []) {
      const slots: string[] = Array.isArray(s.scheduled_times) ? s.scheduled_times : [];
      // Compute which reminder windows are active right now across all slots
      const windowsForSession = new Set<string>();
      const slotForWindow: Record<string, string> = {};
      for (const iso of slots) {
        const t = new Date(iso).getTime();
        if (isNaN(t)) continue;
        for (const w of reminderWindows(t, now)) {
          if (!windowsForSession.has(w)) {
            windowsForSession.add(w);
            slotForWindow[w] = iso;
          }
        }
      }
      if (windowsForSession.size === 0) continue;

      // Get registrations with email
      const { data: regs } = await svc
        .from("live_registrations")
        .select("id, name, email")
        .eq("session_id", s.id)
        .not("email", "is", null);
      if (!regs || regs.length === 0) continue;

      for (const w of windowsForSession) {
        const slotIso = slotForWindow[w];
        const link = `https://flow.nevorai.com/s/${s.slug}`;
        const subject = `${labelMap[w]} — ${s.title}`;
        const whenLabel = fmtIST(slotIso);

        // Idempotency check via email_send_log
        const dedupeTemplate = `live_reminder_${w}_${s.id}`;
        const { data: alreadySent } = await svc
          .from("email_send_log")
          .select("recipient_email")
          .eq("template_name", dedupeTemplate);
        const sentSet = new Set((alreadySent || []).map((r: any) => (r.recipient_email || "").toLowerCase()));

        for (const r of regs) {
          const email = (r.email || "").toLowerCase().trim();
          if (!email) { skipped++; continue; }
          if (sentSet.has(email)) { skipped++; continue; }

          const html = reminderHtml({
            name: r.name,
            title: s.title,
            whenLabel,
            slotIso,
            link,
            windowLabel: labelMap[w],
          });
          await enqueueEmail(svc, email, subject, html, dedupeTemplate);
          queued++;
        }
      }
    }

    return json({ ok: true, queued, skipped, at: new Date().toISOString() });
  } catch (e) {
    console.error("send-live-reminders error", e);
    return json({ error: String(e) }, 500);
  }
});
