// Client-safe email helpers. All functions POST to /api/public/email/send
// (server route holds RESEND_API_KEY). Fire-and-forget: never throws, never
// blocks the caller. Failures are logged and swallowed.

const ENDPOINT = "/api/public/email/send";

async function post(body: unknown): Promise<void> {
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch (err) {
    console.error("[email] request failed", err);
  }
}

// 1. Welcome email → sent to creator on signup
export function sendWelcomeEmail(to: string, name: string): Promise<void> {
  if (!to) return Promise.resolve();
  return post({ type: "welcome", to, name: name || "there" });
}

// 2 + 3. Lead alert (to creator) + confirmation (to prospect). Server looks
// up funnel + creator profile, so client only needs funnel_id + prospect.
export function sendLeadEmails(params: {
  funnelId: string;
  prospect: { name: string; email?: string | null; phone?: string | null };
}): Promise<void> {
  if (!params.funnelId || !params.prospect?.name) return Promise.resolve();
  return post({
    type: "lead",
    funnel_id: params.funnelId,
    prospect: {
      name: params.prospect.name,
      email: params.prospect.email || undefined,
      phone: params.prospect.phone || undefined,
    },
  });
}

// 4. Subscription/payment receipt → sent after Razorpay payment success
export function sendSubscriptionReceipt(params: {
  to: string;
  name: string;
  plan: string;
  amount: number;
  orderId: string;
}): Promise<void> {
  if (!params.to) return Promise.resolve();
  return post({ type: "receipt", ...params });
}
