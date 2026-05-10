import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Map Stripe price lookup_key -> { plan_key, tier, billing_type }
function mapPriceToPlan(lookupKey: string | null | undefined): {
  plan_key: string;
  tier: string;
  billing_type: string;
} {
  switch (lookupKey) {
    case "basic_monthly":
      return { plan_key: "basic_monthly", tier: "basic", billing_type: "monthly" };
    case "basic_yearly":
      return { plan_key: "basic_yearly", tier: "basic", billing_type: "yearly" };
    case "pro_monthly":
      return { plan_key: "pro_monthly", tier: "pro", billing_type: "monthly" };
    case "pro_yearly":
      return { plan_key: "pro_yearly", tier: "pro", billing_type: "yearly" };
    default:
      return { plan_key: "basic_monthly", tier: "basic", billing_type: "monthly" };
  }
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const url = new URL(req.url);
  const env = (url.searchParams.get("env") || "sandbox") as StripeEnv;

  let event: { type: string; data: { object: any }; id: string };
  try {
    event = await verifyWebhook(req, env);
  } catch (e: any) {
    console.error("Webhook verify error:", e.message);
    return new Response("Invalid signature", { status: 400 });
  }

  console.log("Stripe event:", event.type, "env:", env, "id:", event.id);

  // Idempotency: log first
  await supabase.from("payment_audit_logs").insert({
    event_type: event.type,
    razorpay_event_id: null,
    idempotency_key: event.id,
    payload: event.data.object as any,
    source: "stripe",
  });

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpsert(event.data.object, env);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object, env);
        break;
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, env);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object, env);
        break;
      default:
        console.log("Unhandled event:", event.type);
    }
  } catch (e: any) {
    console.error("Handler error:", e);
    // Still return 200 to avoid retry storm; we logged it above
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function handleSubscriptionUpsert(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata", subscription.id);
    return;
  }
  const item = subscription.items?.data?.[0];
  const lookupKey: string | undefined =
    item?.price?.lookup_key || subscription.metadata?.priceId;
  const stripePriceId = item?.price?.id;
  const { plan_key, tier, billing_type } = mapPriceToPlan(lookupKey);
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;
  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000).toISOString()
    : null;

  // Mark any existing active subs as replaced (so we always have one active)
  await supabase
    .from("user_subscriptions")
    .update({ status: "replaced" })
    .eq("user_id", userId)
    .eq("status", "active")
    .neq("stripe_subscription_id", subscription.id);

  // Upsert the Stripe subscription row
  const { data: existing } = await supabase
    .from("user_subscriptions")
    .select("id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  const row = {
    user_id: userId,
    plan_key,
    tier,
    billing_type,
    status: subscription.status === "active" || subscription.status === "trialing"
      ? "active"
      : subscription.status,
    payment_gateway: "stripe",
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer,
    stripe_price_id: stripePriceId,
    environment: env,
    started_at: periodStart,
    current_period_end: periodEnd,
    expires_at: periodEnd,
    cancel_at_period_end: !!subscription.cancel_at_period_end,
    amount_paid: item?.price?.unit_amount ? item.price.unit_amount / 100 : null,
  };

  if (existing) {
    await supabase.from("user_subscriptions").update(row).eq("id", existing.id);
  } else {
    await supabase.from("user_subscriptions").insert(row);
    // First-time subscription — notify + email
    await onFirstSubscription(userId, tier, billing_type, env);
  }
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  // Cancel: keep access until period end (already stored).
  await supabase
    .from("user_subscriptions")
    .update({
      status: "cancelled",
      cancel_at_period_end: true,
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  // Subscription events handle the actual upsert. This is mainly for one-time payments.
  console.log("Checkout completed:", session.id, "mode:", session.mode);
}

async function handlePaymentFailed(invoice: any, env: StripeEnv) {
  if (invoice.subscription) {
    await supabase
      .from("user_subscriptions")
      .update({ status: "payment_failed" })
      .eq("stripe_subscription_id", invoice.subscription)
      .eq("environment", env);
  }
}

async function onFirstSubscription(
  userId: string,
  tier: string,
  billing: string,
  env: StripeEnv,
) {
  // Notification
  await supabase.from("notifications").insert({
    user_id: userId,
    type: "subscription_active",
    title: `Welcome to nFlow ${tier.charAt(0).toUpperCase() + tier.slice(1)}! 🎉`,
    message: `Your ${billing} subscription is now active. You're covered by our 7-day money-back guarantee.`,
    data: { tier, billing, gateway: "stripe", environment: env },
  });

  // Confirmation email via Gmail OAuth pipeline (non-blocking)
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.email) {
      await supabase.from("email_send_log").insert({
        recipient_email: profile.email,
        template_name: "stripe_subscription_active",
        status: "queued",
        metadata: { userId, tier, billing, gateway: "stripe" },
      });
    }
  } catch (e) {
    console.error("Email queue failed:", e);
  }
}
