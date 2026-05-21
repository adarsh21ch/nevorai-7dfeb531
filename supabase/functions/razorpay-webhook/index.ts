import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!;
const RAZORPAY_KEY_ID = (Deno.env.get("RAZORPAY_KEY_ID") ?? "").trim();
const RAZORPAY_KEY_SECRET = (Deno.env.get("RAZORPAY_KEY_SECRET") ?? "").trim();
const RAZORPAY_API = "https://api.razorpay.com/v1";

function rzpHeaders() {
  return {
    Authorization: "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
    "Content-Type": "application/json",
  };
}

function getBillingInterval(planKey: string | null | undefined, fallback?: string | null) {
  const raw = ((planKey || "").split("_").slice(1).join("_") || fallback || "monthly").toLowerCase();
  return raw.includes("year") ? "yearly" : "monthly";
}

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

/**
 * Fallback subscription provisioning when the frontend `verify_payment` call
 * never reached the server (closed tab, network drop, etc.). Mirrors the
 * provisioning logic in razorpay-portal::verify_payment, driven by the
 * authoritative order notes we set at order creation time.
 */
async function provisionSubscriptionFromOrder(
  serviceClient: any,
  userId: string,
  orderId: string,
  paymentId: string,
  amountPaise: number,
) {
  // Already provisioned? Use payment_id as the strongest dedupe key.
  const { data: existingByPayment } = await serviceClient
    .from("user_subscriptions")
    .select("id")
    .eq("razorpay_payment_id", paymentId)
    .maybeSingle();
  if (existingByPayment) return { provisioned: false, reason: "already_exists_payment" };

  const { data: existingByOrder } = await serviceClient
    .from("user_subscriptions")
    .select("id, status")
    .eq("razorpay_order_id", orderId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingByOrder) {
    if (existingByOrder.status !== "active") {
      await serviceClient.from("user_subscriptions")
        .update({ status: "active", razorpay_payment_id: paymentId })
        .eq("id", existingByOrder.id);
    }
    return { provisioned: false, reason: "already_exists_order" };
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.error("[webhook fallback] missing RAZORPAY_KEY_ID/SECRET — cannot fetch order");
    return { provisioned: false, reason: "missing_rzp_keys" };
  }

  // Fetch authoritative order (notes contain plan_key, tier_id, upgrade metadata)
  const orderRes = await fetch(`${RAZORPAY_API}/orders/${orderId}`, { headers: rzpHeaders() });
  if (!orderRes.ok) {
    console.error("[webhook fallback] order fetch failed", orderRes.status);
    return { provisioned: false, reason: "order_fetch_failed" };
  }
  const order = await orderRes.json();

  if (order.notes?.user_id && order.notes.user_id !== userId) {
    console.error("[webhook fallback] order user mismatch");
    return { provisioned: false, reason: "user_mismatch" };
  }

  const planKey: string | null = order.notes?.plan_key || null;
  if (!planKey) return { provisioned: false, reason: "no_plan_key" };

  const { data: planData } = await serviceClient
    .from("admin_subscription_plans")
    .select("*")
    .eq("plan_key", planKey)
    .eq("is_active", true)
    .maybeSingle();
  if (!planData) return { provisioned: false, reason: "plan_not_found" };

  const isPlanUpgrade = order.notes?.kind === "plan_upgrade_prorated";
  const orderExpiresAt: string | null = order.notes?.expires_at || null;
  const orderTierId: string | null = (order.notes?.tier_id || "") || null;
  const interval = getBillingInterval(planKey, planData?.billing_type);

  let tierRow: any = null;
  if (orderTierId) {
    const { data: tr } = await serviceClient
      .from("plan_view_tiers")
      .select("id, plan_name, daily_views, monthly_price, yearly_price")
      .eq("id", orderTierId)
      .maybeSingle();
    tierRow = tr;
  }

  const now = new Date();
  let expiresAt: string;
  if (isPlanUpgrade && orderExpiresAt) {
    expiresAt = orderExpiresAt;
  } else {
    const cycleDays = Number(planData?.duration_days) > 0
      ? Number(planData.duration_days)
      : (interval === "yearly" ? 365 : 30);
    expiresAt = new Date(now.getTime() + cycleDays * 86400000).toISOString();
  }

  // Deactivate any prior active subscription for this user.
  await serviceClient.from("user_subscriptions")
    .update({ status: "replaced" })
    .eq("user_id", userId)
    .eq("status", "active");

  const { error: insertErr } = await serviceClient.from("user_subscriptions").insert({
    user_id: userId,
    plan_key: planKey,
    tier: planData?.tier || "pro",
    status: "active",
    billing_type: planData?.billing_type || "one_time",
    amount_paid: Math.round(amountPaise / 100),
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    started_at: now.toISOString(),
    expires_at: expiresAt,
  });
  if (insertErr) {
    console.error("[webhook fallback] subscription insert failed", insertErr);
    return { provisioned: false, reason: "insert_failed", error: insertErr.message };
  }

  await serviceClient.from("profiles")
    .update({ subscription_status: "active" })
    .eq("id", userId);

  if (tierRow) {
    await serviceClient.from("profiles").update({
      selected_tier_id: tierRow.id,
      selected_daily_views: tierRow.daily_views,
    }).eq("id", userId);
  }

  await serviceClient.from("payment_audit_logs").insert({
    user_id: userId,
    event_type: "payment_provisioned_via_webhook",
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    payload: { plan_key: planKey, tier: planData?.tier, is_plan_upgrade: isPlanUpgrade },
    source: "webhook",
    idempotency_key: `webhook_provision_${paymentId}`,
  });

  return { provisioned: true };
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
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 200 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const payload = event.payload;
    const eventId = event.event_id || `${eventType}_${Date.now()}`;

    const idempotencyKey = `webhook_${eventId}`;
    const { data: existing } = await serviceClient.from("payment_audit_logs")
      .select("id").eq("idempotency_key", idempotencyKey).maybeSingle();

    if (existing) {
      console.log("Duplicate webhook, skipping:", idempotencyKey);
      return new Response(JSON.stringify({ status: "duplicate" }), { status: 200 });
    }

    const paymentEntity = payload?.payment?.entity;
    const subscriptionEntity = payload?.subscription?.entity;
    const userId = paymentEntity?.notes?.user_id || subscriptionEntity?.notes?.user_id;
    const planKey = paymentEntity?.notes?.plan_key || subscriptionEntity?.notes?.plan_key;

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

    switch (eventType) {
      case "payment.captured":
      case "order.paid": {
        // Skip tier-upgrade and topup orders — they have their own verify paths
        // and provisioning logic that the webhook fallback doesn't know how to
        // replicate. The frontend handlers + manual support flow cover those.
        const kind = paymentEntity?.notes?.kind || "";
        const isStandardSubscriptionOrder =
          kind === "" || kind === "plan_upgrade_prorated";

        if (userId && paymentEntity?.order_id && isStandardSubscriptionOrder) {
          const result = await provisionSubscriptionFromOrder(
            serviceClient,
            userId,
            paymentEntity.order_id,
            paymentEntity.id,
            Number(paymentEntity.amount || 0),
          );
          if (result.provisioned) {
            console.log("[webhook] subscription provisioned via fallback for", paymentEntity.id);
          }
        } else if (userId && paymentEntity) {
          // Non-standard order kind: just ensure status flips active if a row exists.
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
          await serviceClient.from("user_subscriptions")
            .update({ status: "active" })
            .eq("razorpay_subscription_id", subscriptionEntity.id)
            .eq("user_id", userId);
        }
        break;
      }

      case "subscription.charged": {
        if (userId && subscriptionEntity) {
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
    return new Response(JSON.stringify({ error: err.message }), { status: 200 });
  }
});
