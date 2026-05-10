import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!;

// Constant-time string compare to prevent timing attacks on HMAC verification.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function verifyWebhookSignature(body: string, signature: string): Promise<boolean> {
  if (!signature || !RAZORPAY_WEBHOOK_SECRET) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(RAZORPAY_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(expectedSig, signature.toLowerCase());
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";

  try {
    const isValid = await verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.error("Invalid webhook signature");
      // Still return 200 to prevent Razorpay retries for bad signatures
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 200 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const payload = event.payload;
    const eventId = event.event_id || `${eventType}_${Date.now()}`;

    // Idempotency check
    const idempotencyKey = `webhook_${eventId}`;
    const { data: existing } = await serviceClient.from("payment_audit_logs")
      .select("id").eq("idempotency_key", idempotencyKey).maybeSingle();
    
    if (existing) {
      console.log("Duplicate webhook, skipping:", idempotencyKey);
      return new Response(JSON.stringify({ status: "duplicate" }), { status: 200 });
    }

    // Extract common fields
    const paymentEntity = payload?.payment?.entity;
    const subscriptionEntity = payload?.subscription?.entity;
    const userId = paymentEntity?.notes?.user_id || subscriptionEntity?.notes?.user_id;
    const planKey = paymentEntity?.notes?.plan_key || subscriptionEntity?.notes?.plan_key;

    // Log event
    await serviceClient.from("payment_audit_logs").insert({
      user_id: userId || null,
      event_type: eventType,
      razorpay_event_id: eventId,
      razorpay_payment_id: paymentEntity?.id,
      razorpay_order_id: paymentEntity?.order_id,
      razorpay_subscription_id: subscriptionEntity?.id,
      payload: event,
      source: "webhook",
      idempotency_key: idempotencyKey,
    });

    // Handle specific events
    switch (eventType) {
      case "payment.captured": {
        if (userId && paymentEntity) {
          // Payment captured - ensure subscription is active
          const { data: sub } = await serviceClient.from("user_subscriptions")
            .select("*")
            .eq("razorpay_order_id", paymentEntity.order_id)
            .eq("user_id", userId)
            .maybeSingle();

          if (sub && sub.status !== "active") {
            await serviceClient.from("user_subscriptions")
              .update({ status: "active", razorpay_payment_id: paymentEntity.id })
              .eq("id", sub.id);
          }
        }
        break;
      }

      case "payment.failed": {
        if (userId && paymentEntity) {
          await serviceClient.from("user_subscriptions")
            .update({ status: "payment_failed" })
            .eq("razorpay_order_id", paymentEntity.order_id)
            .eq("user_id", userId);
        }
        break;
      }

      case "subscription.activated": {
        if (userId && subscriptionEntity) {
          // Activate or create the subscription
          await serviceClient.from("user_subscriptions")
            .update({ status: "active" })
            .eq("razorpay_subscription_id", subscriptionEntity.id)
            .eq("user_id", userId);
        }
        break;
      }

      case "subscription.charged": {
        if (userId && subscriptionEntity) {
          // Extend the expiry date for recurring payment
          const now = new Date();
          const expiresAt = new Date(now.getTime() + 30 * 86400000);

          await serviceClient.from("user_subscriptions")
            .update({
              status: "active",
              started_at: now.toISOString(),
              expires_at: expiresAt.toISOString(),
              amount_paid: paymentEntity ? Math.round(paymentEntity.amount / 100) : null,
              razorpay_payment_id: paymentEntity?.id,
            })
            .eq("razorpay_subscription_id", subscriptionEntity.id)
            .eq("user_id", userId);
        }
        break;
      }

      case "subscription.cancelled":
      case "subscription.completed": {
        if (userId && subscriptionEntity) {
          await serviceClient.from("user_subscriptions")
            .update({ status: "cancelled" })
            .eq("razorpay_subscription_id", subscriptionEntity.id)
            .eq("user_id", userId);
        }
        break;
      }

      default:
        console.log("Unhandled event:", eventType);
    }

    return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
  } catch (err: any) {
    console.error("Webhook error:", err);
    // Return 200 to prevent infinite retries on parse errors
    return new Response(JSON.stringify({ error: err.message }), { status: 200 });
  }
});
