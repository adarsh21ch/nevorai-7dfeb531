import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─────────────────────────────────────────────────────────────────────────────
// Two-transport email router:
//
//   • Resend           → platform/system emails sent from Nevorai itself
//                        (welcome, payment receipt, reminder, invoice, OTP)
//   • Admin Gmail      → lead-facing emails tied to a creator's funnel
//                        (prospect confirmation + creator new-lead alert),
//                        sent via the `send-gmail-email` Supabase edge fn
//                        which uses the admin's connected Gmail account.
//
// If a transport is unavailable for a given email, we fall back to the other
// where it makes sense so nothing silently disappears.
// ─────────────────────────────────────────────────────────────────────────────

const SITE = "https://nevorai.com";
const RESEND_FROM = "Nevorai <noreply@nevorai.com>";

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const wrap = (inner: string) => `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;padding:36px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <tr><td>
        <div style="font-size:13px;font-weight:700;letter-spacing:0.2em;color:#2563eb;margin-bottom:24px;">NEVORAI</div>
        ${inner}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;"/>
        <div style="font-size:11px;color:#94a3b8;line-height:1.6;">
          Nevorai · <a href="${SITE}" style="color:#94a3b8;text-decoration:underline;">nevorai.com</a><br/>
          Same effort. Twice the conversion.
        </div>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;

const button = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;margin:8px 0 20px;">${esc(label)} →</a>`;

type Payload =
  | { type: "welcome"; to: string; name: string }
  | {
      type: "lead";
      funnel_id: string;
      prospect: { name: string; email?: string; phone?: string };
    }
  | {
      type: "receipt";
      to: string;
      name: string;
      plan: string;
      amount: number;
      orderId: string;
    }
  | {
      type: "reminder";
      to: string;
      name: string;
      plan: string;
      dueDate?: string;
    }
  | {
      type: "password_reset";
      to: string;
      name?: string;
      action_link: string;
    };


interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
  sender_name?: string;
  from?: string;
}

type SendResult = { ok: boolean; reason?: string; transport?: string };

/** Send a single email via Resend (platform/system transport). */
async function sendViaResend(mail: OutgoingMail): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY not configured");
    return { ok: false, reason: "no_resend_key", transport: "resend" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: mail.from || RESEND_FROM,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[email] resend send failed", res.status, json);
      return { ok: false, reason: json?.message || `status_${res.status}`, transport: "resend" };
    }
    console.log("[email] resend send ok", json?.id);
    return { ok: true, transport: "resend" };
  } catch (err: any) {
    console.error("[email] resend send threw", err?.message || err);
    return { ok: false, reason: err?.message || "fetch_failed", transport: "resend" };
  }
}

/** Send a single email through the admin's connected Gmail account. */
async function sendViaGmail(mail: OutgoingMail): Promise<SendResult> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[email] Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    return { ok: false, reason: "no_supabase_env", transport: "gmail" };
  }
  try {
    const res = await fetch(`${url}/functions/v1/send-gmail-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(mail),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || !json?.sent) {
      console.error("[email] gmail send failed", res.status, json);
      return { ok: false, reason: json?.error || `status_${res.status}`, transport: "gmail" };
    }
    console.log("[email] gmail send ok", json?.message_id);
    return { ok: true, transport: "gmail" };
  } catch (err: any) {
    console.error("[email] gmail send threw", err?.message || err);
    return { ok: false, reason: err?.message || "fetch_failed", transport: "gmail" };
  }
}

/** Lead emails use Gmail; if Gmail isn't connected, fall back to Resend. */
async function sendLeadEmail(mail: OutgoingMail): Promise<SendResult> {
  const gmail = await sendViaGmail(mail);
  if (gmail.ok) return gmail;
  console.warn("[email] gmail failed for lead email, falling back to resend:", gmail.reason);
  return sendViaResend(mail);
}

async function buildAndSend(payload: Payload) {
  // ───── System / platform emails → Resend ─────
  if (payload.type === "welcome") {
    const html = wrap(`
      <h1 style="font-size:24px;font-weight:700;margin:0 0 14px;line-height:1.3;">Welcome, ${esc(payload.name)} 👋</h1>
      <p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 22px;">Your Nevorai account is ready. Create your first video funnel, share the link, and watch your leads come in — without YouTube stealing your prospects.</p>
      ${button(`${SITE}/dashboard`, "Go to Dashboard")}
    `);
    return sendViaResend({
      to: payload.to,
      subject: "Welcome to Nevorai 🎉",
      html,
    });
  }

  if (payload.type === "receipt") {
    const date = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const row = (label: string, val: string) =>
      `<tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;width:120px;">${label}</td><td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600;">${esc(val)}</td></tr>`;
    const html = wrap(`
      <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;color:#2563eb;margin-bottom:10px;">PAYMENT CONFIRMED</div>
      <h1 style="font-size:24px;font-weight:700;margin:0 0 18px;line-height:1.3;">You're on Nevorai ${esc(payload.plan)}, ${esc(payload.name)} 🎉</h1>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border-radius:10px;padding:8px 16px;margin:0 0 22px;">
        ${row("Plan", `Nevorai ${payload.plan}`)}
        ${row("Amount paid", `₹${payload.amount.toLocaleString("en-IN")}`)}
        ${row("Order ID", payload.orderId)}
        ${row("Date", date)}
      </table>
      ${button(`${SITE}/dashboard`, "Go to Dashboard")}
    `);
    return sendViaResend({
      to: payload.to,
      subject: `Payment confirmed — Nevorai ${payload.plan}`,
      html,
    });
  }

  if (payload.type === "reminder") {
    const html = wrap(`
      <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;color:#d97706;margin-bottom:10px;">PAYMENT REMINDER</div>
      <h1 style="font-size:22px;font-weight:700;margin:0 0 14px;line-height:1.3;">Hi ${esc(payload.name)}, your Nevorai ${esc(payload.plan)} payment is due</h1>
      <p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 22px;">${payload.dueDate ? `Due on <strong>${esc(payload.dueDate)}</strong>. ` : ""}Renew now to keep your funnels live and leads flowing.</p>
      ${button(`${SITE}/billing`, "Renew now")}
    `);
    return sendViaResend({
      to: payload.to,
      subject: `Payment reminder — Nevorai ${payload.plan}`,
      html,
    });
  }

  // ───── Lead emails → Admin Gmail (with Resend fallback) ─────
  if (payload.type === "lead") {
    const { data: funnel } = await supabaseAdmin
      .from("funnels")
      .select("id, title, owner_id")
      .eq("id", payload.funnel_id)
      .maybeSingle();
    if (!funnel) return { ok: false, reason: "funnel_not_found" };

    const { data: creator } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", (funnel as any).owner_id)
      .maybeSingle();

    const p = payload.prospect;
    const ftitle = (funnel as any).title || "your funnel";
    const cname = (creator as any)?.full_name || "the creator";

    const results: SendResult[] = [];

    // 1. Alert to creator
    if ((creator as any)?.email) {
      const row = (label: string, val: string) =>
        `<tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;width:90px;">${label}</td><td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:500;">${esc(val)}</td></tr>`;
      const html = wrap(`
        <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;color:#16a34a;margin-bottom:10px;">NEW LEAD</div>
        <h1 style="font-size:22px;font-weight:700;margin:0 0 6px;line-height:1.3;">${esc(p.name)} just filled your form</h1>
        <p style="font-size:14px;color:#64748b;margin:0 0 20px;">on <strong>${esc(ftitle)}</strong></p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border-radius:10px;padding:8px 16px;margin:0 0 22px;">
          ${row("Name", p.name)}
          ${row("Email", p.email || "—")}
          ${row("Phone", p.phone || "—")}
        </table>
        ${button(`${SITE}/insights/funnels/${(funnel as any).id}`, "View Lead in Dashboard")}
      `);
      results.push(
        await sendLeadEmail({
          to: (creator as any).email,
          subject: `New lead: ${p.name} just registered`,
          html,
          sender_name: "Nevorai",
        }),
      );
    }

    // 2. Confirmation to prospect
    if (p.email) {
      const html = wrap(`
        <h1 style="font-size:24px;font-weight:700;margin:0 0 14px;line-height:1.3;">You're registered, ${esc(p.name)} ✅</h1>
        <p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 14px;">Thank you for registering on <strong>${esc(ftitle)}</strong>.</p>
        <p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 22px;"><strong>${esc(cname)}</strong> will be in touch with you shortly.</p>
        <p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:0;">This confirmation was sent via Nevorai — the video sales platform for Indian creators.</p>
      `);
      results.push(
        await sendLeadEmail({
          to: p.email,
          subject: "You're registered",
          html,
          sender_name: cname || "Nevorai",
        }),
      );
    }

    return {
      ok: true,
      sent: results.filter((r) => r.ok).length,
      attempted: results.length,
      details: results,
    };
  }

  return { ok: false, reason: "unknown_type" };
}

export const Route = createFileRoute("/api/public/email/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Payload;
        try {
          body = (await request.json()) as Payload;
        } catch {
          return Response.json({ ok: false, reason: "bad_json" }, { status: 400 });
        }

        if (!body || typeof body !== "object" || !("type" in body)) {
          return Response.json({ ok: false, reason: "bad_payload" }, { status: 400 });
        }

        try {
          const result = await buildAndSend(body);
          return Response.json({ ok: true, result });
        } catch (err: any) {
          console.error("[email] send failed", err?.message || err);
          return Response.json(
            { ok: false, reason: err?.message || "send_failed" },
            { status: 200 },
          );
        }
      },
    },
  },
});
