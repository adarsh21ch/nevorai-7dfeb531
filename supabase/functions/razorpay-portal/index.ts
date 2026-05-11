import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Trim to defend against trailing spaces/newlines pasted into the Supabase secret UI
const RAZORPAY_KEY_ID = (Deno.env.get("RAZORPAY_KEY_ID") ?? "").trim();
const RAZORPAY_KEY_SECRET = (Deno.env.get("RAZORPAY_KEY_SECRET") ?? "").trim();
const RAZORPAY_API = "https://api.razorpay.com/v1";

// Build marker — bumping this string forces a fresh deploy. v=2026-05-10f-planupg
console.log("razorpay-portal build v=2026-05-10f-planupg key_id_prefix=", RAZORPAY_KEY_ID.slice(0, 8));

function rzpHeaders() {
  return {
    Authorization: "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
    "Content-Type": "application/json",
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const PLAN_RANK: Record<string, number> = { free: 0, basic: 1, pro: 2 };

function getBasePlanName(value: string | null | undefined) {
  return (value || "").split("_")[0]?.toLowerCase() || "";
}

function getBillingInterval(planKey: string | null | undefined, fallback?: string | null) {
  const raw = ((planKey || "").split("_").slice(1).join("_") || fallback || "monthly").toLowerCase();
  return raw.includes("year") ? "yearly" : "monthly";
}

function getDefaultCycleDays(interval: string, explicitDays?: number | null) {
  if (explicitDays && explicitDays > 0) return explicitDays;
  return interval === "yearly" ? 365 : 30;
}

function pickTierPrice(tierRow: any, interval: string) {
  const preferred = interval === "yearly"
    ? Number(tierRow?.yearly_price ?? 0)
    : Number(tierRow?.monthly_price ?? 0);
  if (preferred > 0) return preferred;
  return Number(tierRow?.monthly_price ?? tierRow?.yearly_price ?? 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Public version probe — no auth required. Lets us confirm which build is live.
  const url = new URL(req.url);
  if (req.method === "GET" || url.searchParams.get("ping") === "1") {
    return jsonResponse({
      build: "v=2026-05-10f-planupg",
      key_id_prefix: RAZORPAY_KEY_ID ? RAZORPAY_KEY_ID.slice(0, 8) : null,
      key_id_len: RAZORPAY_KEY_ID.length,
      key_secret_len: RAZORPAY_KEY_SECRET.length,
      mode_guess: RAZORPAY_KEY_ID.startsWith("rzp_test") ? "test" : RAZORPAY_KEY_ID.startsWith("rzp_live") ? "live" : "unknown",
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { action } = body;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "create_order") {
      const { plan_key, tier_id } = body;
      if (!plan_key || typeof plan_key !== "string") {
        return jsonResponse({ error: "plan_key required" }, 400);
      }

      // SECURITY: Always look up authoritative price server-side. Never trust client amount.
      const { data: planData } = await serviceClient
        .from("admin_subscription_plans")
        .select("plan_key, price_inr, is_active")
        .eq("plan_key", plan_key)
        .eq("is_active", true)
        .maybeSingle();

      if (!planData || !planData.price_inr || planData.price_inr <= 0) {
        return jsonResponse({ error: "Invalid or inactive plan" }, 400);
      }

      const targetBillingInterval = getBillingInterval(plan_key, planData.billing_type);
      const targetCycleDays = getDefaultCycleDays(targetBillingInterval, Number(planData.duration_days || 0));
      let authoritativeAmount = Number(planData.price_inr);
      let resolvedTierId: string | null = null;
      let resolvedDailyViews: number | null = null;
      const baseTier = plan_key.split("_")[0]; // basic_monthly -> basic

      // If a tier_id was provided, validate it belongs to this plan and use its price.
      if (tier_id && typeof tier_id === "string") {
        const { data: tierRow } = await serviceClient
          .from("plan_view_tiers")
          .select("id, plan_name, daily_views, monthly_price, is_active")
          .eq("id", tier_id)
          .eq("is_active", true)
          .maybeSingle();
        if (!tierRow || tierRow.plan_name !== baseTier) {
          return jsonResponse({ error: "Invalid tier for plan" }, 400);
        }
        // Tier upgrade safety: if the user already has an active subscription on a
        // different plan, prevent buying a tier on the wrong plan.
        const { data: activeSub } = await serviceClient
          .from("user_subscriptions")
          .select("plan_key, tier")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (activeSub && activeSub.tier && activeSub.tier !== tierRow.plan_name) {
          return jsonResponse({ error: "Tier does not belong to your current plan" }, 400);
        }
        authoritativeAmount = pickTierPrice(tierRow, targetBillingInterval);
        resolvedTierId = tierRow.id;
        resolvedDailyViews = tierRow.daily_views;
      } else if (baseTier === "basic" || baseTier === "pro") {
        // Auto-resolve the base tier for the plan when no tier_id was supplied.
        const { data: baseRow } = await serviceClient
          .from("plan_view_tiers")
            .select("id, daily_views, monthly_price, yearly_price")
          .eq("plan_name", baseTier)
          .eq("is_active", true)
          .eq("is_base", true)
          .maybeSingle();
        if (baseRow) {
          authoritativeAmount = pickTierPrice(baseRow, targetBillingInterval);
          resolvedTierId = baseRow.id;
          resolvedDailyViews = baseRow.daily_views;
        }
      }

      // ===== Plan upgrade proration (Basic → Pro for users with active paid sub) =====
      // If user already has an active paid subscription on a LOWER plan, charge only
      // the prorated price difference for the days remaining in the current cycle.
      const { data: activePaidSub } = await serviceClient
        .from("user_subscriptions")
        .select("plan_key, tier, expires_at, amount_paid, status, billing_type")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const currentBasePlan = activePaidSub
        ? getBasePlanName(activePaidSub.tier || activePaidSub.plan_key)
        : null;
      const currentBillingInterval = getBillingInterval(activePaidSub?.plan_key, activePaidSub?.billing_type);

      let isPlanUpgrade = false;
      let proratedCharge = 0;
      let daysRemaining = 0;
      let priceDiff = 0;
      let currentPlanPrice = 0;
      let targetPlanPrice = authoritativeAmount;
      let fromPlanKey: string | null = null;

      if (
        activePaidSub &&
        activePaidSub.expires_at &&
        currentBasePlan &&
        (PLAN_RANK[baseTier] ?? -1) > (PLAN_RANK[currentBasePlan] ?? -1) &&
        (currentBasePlan === "basic" || currentBasePlan === "pro")
      ) {
        // Resolve current plan's base monthly price
        const { data: currentBaseRow } = await serviceClient
          .from("plan_view_tiers")
          .select("monthly_price, yearly_price")
          .eq("plan_name", currentBasePlan)
          .eq("is_base", true)
          .eq("is_active", true)
          .maybeSingle();

        currentPlanPrice = pickTierPrice(currentBaseRow, currentBillingInterval) || Number(activePaidSub.amount_paid || 0);
        priceDiff = targetPlanPrice - currentPlanPrice;

        if (priceDiff > 0) {
          const exp = new Date(activePaidSub.expires_at);
          const now = new Date();
          const msRemaining = exp.getTime() - now.getTime();
          daysRemaining = Math.max(1, Math.ceil(msRemaining / 86400000));
          const daysInCycle = getDefaultCycleDays(currentBillingInterval, Number(planData.duration_days || 0));
          const remainingFraction = Math.min(1, Math.max(0, msRemaining / (daysInCycle * 86400000)));
          proratedCharge = Math.max(
            1,
            Math.round(priceDiff * remainingFraction)
          );
          isPlanUpgrade = true;
          fromPlanKey = activePaidSub.plan_key;
          authoritativeAmount = proratedCharge;
        }
      }

      const orderNotes: Record<string, string> = {
        user_id: user.id,
        plan_key,
        tier_id: resolvedTierId || "",
        daily_views: resolvedDailyViews ? String(resolvedDailyViews) : "",
      };

      if (isPlanUpgrade) {
        orderNotes.kind = "plan_upgrade_prorated";
        orderNotes.from_plan = fromPlanKey || "";
        orderNotes.to_plan = plan_key;
        orderNotes.current_price = String(currentPlanPrice);
        orderNotes.target_price = String(targetPlanPrice);
        orderNotes.price_diff = String(priceDiff);
        orderNotes.prorated_charge = String(proratedCharge);
        orderNotes.days_remaining = String(daysRemaining);
        orderNotes.current_interval = currentBillingInterval;
        orderNotes.target_interval = targetBillingInterval;
        orderNotes.cycle_days = String(targetCycleDays);
        orderNotes.expires_at = activePaidSub!.expires_at as string;
      }

      const orderRes = await fetch(`${RAZORPAY_API}/orders`, {
        method: "POST",
        headers: rzpHeaders(),
        body: JSON.stringify({
          amount: Math.round(authoritativeAmount * 100),
          currency: "INR",
          receipt: `order_${user.id.slice(0, 8)}_${Date.now()}`,
          notes: orderNotes,
        }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.text();
        console.error("Razorpay order error:", orderRes.status, err);
        let detail: any = err;
        try { detail = JSON.parse(err); } catch {}
        return jsonResponse({
          error: "Failed to create order",
          razorpay_status: orderRes.status,
          razorpay_error: detail,
          key_id_prefix: RAZORPAY_KEY_ID ? RAZORPAY_KEY_ID.slice(0, 8) : null,
        }, 500);
      }

      const order = await orderRes.json();

      await serviceClient.from("payment_audit_logs").insert({
        user_id: user.id,
        event_type: isPlanUpgrade ? "plan_upgrade_order_created" : "order_created",
        razorpay_order_id: order.id,
        payload: {
          plan_key,
          amount: authoritativeAmount,
          is_plan_upgrade: isPlanUpgrade,
          prorated_charge: isPlanUpgrade ? proratedCharge : null,
          price_diff: isPlanUpgrade ? priceDiff : null,
          days_remaining: isPlanUpgrade ? daysRemaining : null,
        },
        source: "frontend",
        idempotency_key: `order_${order.id}`,
      });

      return jsonResponse({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: RAZORPAY_KEY_ID,
        is_plan_upgrade: isPlanUpgrade,
        prorated_charge: isPlanUpgrade ? proratedCharge : null,
        price_difference: isPlanUpgrade ? priceDiff : null,
        days_remaining: isPlanUpgrade ? daysRemaining : null,
        target_price: isPlanUpgrade ? targetPlanPrice : null,
      });
    }

    if (action === "verify_payment") {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_key: verifyPlanKey } = body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return jsonResponse({ error: "Missing payment verification fields" }, 400);
      }

      // Verify HMAC signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw", encoder.encode(RAZORPAY_KEY_SECRET),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const sigData = encoder.encode(`${razorpay_order_id}|${razorpay_payment_id}`);
      const sig = await crypto.subtle.sign("HMAC", key, sigData);
      const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

      if (expectedSig !== razorpay_signature) {
        await serviceClient.from("payment_audit_logs").insert({
          user_id: user.id,
          event_type: "payment_verification_failed",
          razorpay_order_id,
          razorpay_payment_id,
          source: "frontend",
          idempotency_key: `verify_fail_${razorpay_payment_id}`,
        });
        return jsonResponse({ error: "Signature mismatch" }, 400);
      }

      // SECURITY: Fetch order from Razorpay to validate user + amount + paid status.
      const orderRes = await fetch(`${RAZORPAY_API}/orders/${razorpay_order_id}`, { headers: rzpHeaders() });
      if (!orderRes.ok) {
        return jsonResponse({ error: "Order lookup failed" }, 400);
      }
      const order = await orderRes.json();

      // Order must belong to this user
      if (order.notes?.user_id !== user.id) {
        await serviceClient.from("payment_audit_logs").insert({
          user_id: user.id,
          event_type: "payment_user_mismatch",
          razorpay_order_id,
          razorpay_payment_id,
          source: "frontend",
          idempotency_key: `mismatch_${razorpay_payment_id}`,
        });
        return jsonResponse({ error: "Order does not belong to user" }, 403);
      }

      // Resolve plan from order notes (authoritative), not client input.
      const pKey = order.notes?.plan_key || verifyPlanKey;
      if (!pKey) return jsonResponse({ error: "Plan key missing on order" }, 400);

      const { data: planData } = await serviceClient.from("admin_subscription_plans")
        .select("*").eq("plan_key", pKey).eq("is_active", true).maybeSingle();

      if (!planData) return jsonResponse({ error: "Plan not found or inactive" }, 400);

      // Detect prorated plan upgrade orders (Basic → Pro for active paid users)
      const isPlanUpgradeOrder = order.notes?.kind === "plan_upgrade_prorated";
      const orderProratedCharge = Number(order.notes?.prorated_charge || 0);
      const orderExpiresAt: string | null = order.notes?.expires_at || null;

      // Resolve tier_id from order.notes (authoritative)
      const orderTierId: string | null = (order.notes?.tier_id || "") || null;
      let tierRow: any = null;
      let expectedAmountInr = isPlanUpgradeOrder
        ? orderProratedCharge
        : Number(planData.price_inr);
      if (orderTierId) {
        const { data: tr } = await serviceClient
          .from("plan_view_tiers")
          .select("id, plan_name, daily_views, monthly_price")
          .eq("id", orderTierId)
          .maybeSingle();
        if (tr) {
          tierRow = tr;
          if (!isPlanUpgradeOrder) {
            expectedAmountInr = Number(tr.monthly_price);
          }
        }
      }

      // Order amount must match (plan price OR tier price OR prorated upgrade)
      const expectedPaise = Math.round(expectedAmountInr * 100);
      if (Number(order.amount) !== expectedPaise) {
        await serviceClient.from("payment_audit_logs").insert({
          user_id: user.id,
          event_type: "payment_amount_mismatch",
          razorpay_order_id,
          razorpay_payment_id,
          payload: { expected: expectedPaise, actual: order.amount, kind: order.notes?.kind || null },
          source: "frontend",
          idempotency_key: `amt_${razorpay_payment_id}`,
        });
        return jsonResponse({ error: "Amount mismatch" }, 400);
      }

      // Idempotency: if a subscription already exists for this payment, return success.
      const { data: existing } = await serviceClient
        .from("user_subscriptions")
        .select("id")
        .eq("razorpay_payment_id", razorpay_payment_id)
        .maybeSingle();
      if (existing) {
        return jsonResponse({ success: true, plan_key: pKey, tier: planData.tier, idempotent: true });
      }

      const now = new Date();
      let expiresAt: string | null = null;
      if (isPlanUpgradeOrder && orderExpiresAt) {
        // Plan upgrade: preserve current cycle's renewal date.
        expiresAt = orderExpiresAt;
      } else if (planData?.duration_days) {
        expiresAt = new Date(now.getTime() + planData.duration_days * 86400000).toISOString();
      }

      // Deactivate old subscriptions
      await serviceClient.from("user_subscriptions")
        .update({ status: "replaced" })
        .eq("user_id", user.id)
        .eq("status", "active");

      // Create new subscription
      await serviceClient.from("user_subscriptions").insert({
        user_id: user.id,
        plan_key: pKey,
        tier: planData?.tier || "pro",
        status: "active",
        billing_type: planData?.billing_type || "one_time",
        amount_paid: expectedAmountInr,
        razorpay_order_id,
        razorpay_payment_id,
        started_at: now.toISOString(),
        expires_at: expiresAt,
      });

      await serviceClient.from("profiles").update({
        subscription_status: "active",
      }).eq("id", user.id);

      // Persist tier selection on profile so monthly limits derive correctly
      if (tierRow) {
        await serviceClient.from("profiles").update({
          selected_tier_id: tierRow.id,
          selected_daily_views: tierRow.daily_views,
        }).eq("id", user.id);
      }

      await serviceClient.from("payment_audit_logs").insert({
        user_id: user.id,
        event_type: "payment_verified",
        razorpay_order_id,
        razorpay_payment_id,
        payload: { plan_key: pKey, tier: planData?.tier },
        source: "frontend",
        idempotency_key: `verify_${razorpay_payment_id}`,
      });

      return jsonResponse({ success: true, plan_key: pKey, tier: planData?.tier });
    }

    if (action === "create_tier_upgrade_order") {
      const { tier_id } = body;
      if (!tier_id || typeof tier_id !== "string") {
        return jsonResponse({ error: "tier_id required" }, 400);
      }

      // Active subscription required
      const { data: activeSub } = await serviceClient
        .from("user_subscriptions")
        .select("plan_key, tier, expires_at, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activeSub || !activeSub.expires_at) {
        return jsonResponse({
          error: "No active paid subscription. Please subscribe to Basic or Pro before upgrading view capacity.",
        }, 400);
      }

      const basePlan = (activeSub.tier || activeSub.plan_key || "").split("_")[0];
      if (basePlan !== "basic" && basePlan !== "pro") {
        return jsonResponse({ error: "Only Basic and Pro subscriptions support tier upgrades" }, 400);
      }

      // Self-heal stale profile state: if the user has an active paid sub,
      // their profile must reflect "active" (not "trial"/"expired"). This
      // unblocks tier upgrades for users whose status was never updated.
      const { data: profileRow } = await serviceClient
        .from("profiles")
        .select("subscription_status, selected_tier_id, selected_daily_views")
        .eq("id", user.id)
        .maybeSingle();

      if (profileRow && profileRow.subscription_status !== "active") {
        await serviceClient
          .from("profiles")
          .update({ subscription_status: "active" })
          .eq("id", user.id);
      }

      // New tier
      const { data: newTier } = await serviceClient
        .from("plan_view_tiers")
        .select("id, plan_name, daily_views, monthly_price, is_active")
        .eq("id", tier_id)
        .eq("is_active", true)
        .maybeSingle();

      if (!newTier) return jsonResponse({ error: "Tier not found" }, 400);
      if (newTier.plan_name !== basePlan) {
        return jsonResponse({ error: "Tier plan mismatch" }, 400);
      }

      // Current tier price (resolve via selected_tier_id or selected_daily_views, else base)
      let currentTier: any = null;
      if (profileRow?.selected_tier_id) {
        const { data } = await serviceClient
          .from("plan_view_tiers")
          .select("id, daily_views, monthly_price, plan_name")
          .eq("id", profileRow.selected_tier_id)
          .maybeSingle();
        currentTier = data;
      }
      if (!currentTier && profileRow?.selected_daily_views != null) {
        const { data } = await serviceClient
          .from("plan_view_tiers")
          .select("id, daily_views, monthly_price, plan_name")
          .eq("plan_name", basePlan)
          .eq("daily_views", profileRow.selected_daily_views)
          .maybeSingle();
        currentTier = data;
      }
      if (!currentTier) {
        const { data } = await serviceClient
          .from("plan_view_tiers")
          .select("id, daily_views, monthly_price, plan_name")
          .eq("plan_name", basePlan)
          .eq("is_base", true)
          .eq("is_active", true)
          .maybeSingle();
        currentTier = data;
      }

      if (!currentTier) return jsonResponse({ error: "Could not resolve current tier" }, 400);

      if (newTier.daily_views !== -1 && newTier.daily_views <= currentTier.daily_views) {
        return jsonResponse({ error: "Can only upgrade to a higher tier" }, 400);
      }

      const priceDiff = Number(newTier.monthly_price) - Number(currentTier.monthly_price);
      if (priceDiff <= 0) {
        return jsonResponse({ error: "New tier must be more expensive than current" }, 400);
      }

      // Server-side proration
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const expiresAt = new Date(activeSub.expires_at);
      expiresAt.setUTCHours(0, 0, 0, 0);
      const msPerDay = 86400000;
      const daysRemaining = Math.max(
        1,
        Math.ceil((expiresAt.getTime() - today.getTime()) / msPerDay)
      );
      const daysInCycle = 30;
      const dailyDiff = priceDiff / daysInCycle;
      const proratedCharge = Math.max(1, Math.round(dailyDiff * Math.min(daysRemaining, daysInCycle)));

      const orderRes = await fetch(`${RAZORPAY_API}/orders`, {
        method: "POST",
        headers: rzpHeaders(),
        body: JSON.stringify({
          amount: proratedCharge * 100,
          currency: "INR",
          receipt: `upg_${user.id.slice(0, 8)}_${Date.now()}`,
          notes: {
            user_id: user.id,
            kind: "tier_upgrade_prorated",
            tier_id: newTier.id,
            plan_name: newTier.plan_name,
            new_daily_views: String(newTier.daily_views),
            new_monthly_price: String(newTier.monthly_price),
            current_monthly_price: String(currentTier.monthly_price),
            prorated_charge: String(proratedCharge),
            days_remaining: String(daysRemaining),
            price_diff: String(priceDiff),
            expires_at: activeSub.expires_at,
          },
        }),
      });

      if (!orderRes.ok) {
        const errText = await orderRes.text();
        console.error("Razorpay upgrade order error:", orderRes.status, errText);
        let detail: any = errText;
        try { detail = JSON.parse(errText); } catch {}
        return jsonResponse({
          error: "Failed to create order",
          where: "tier_upgrade",
          razorpay_status: orderRes.status,
          razorpay_error: detail,
          key_id_prefix: RAZORPAY_KEY_ID ? RAZORPAY_KEY_ID.slice(0, 8) : null,
        }, 500);
      }
      const order = await orderRes.json();

      await serviceClient.from("payment_audit_logs").insert({
        user_id: user.id,
        event_type: "tier_upgrade_order_created",
        razorpay_order_id: order.id,
        payload: {
          tier_id: newTier.id,
          prorated_charge: proratedCharge,
          days_remaining: daysRemaining,
          price_diff: priceDiff,
        },
        source: "frontend",
        idempotency_key: `upg_order_${order.id}`,
      });

      return jsonResponse({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: RAZORPAY_KEY_ID,
        prorated_charge: proratedCharge,
        days_remaining: daysRemaining,
        price_difference: priceDiff,
        renewal_price: Number(newTier.monthly_price),
        renewal_date: activeSub.expires_at,
        new_daily_views: newTier.daily_views,
      });
    }

    if (action === "verify_tier_upgrade") {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return jsonResponse({ error: "Missing payment verification fields" }, 400);
      }

      // HMAC verify
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw", encoder.encode(RAZORPAY_KEY_SECRET),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const sig = await crypto.subtle.sign("HMAC", key,
        encoder.encode(`${razorpay_order_id}|${razorpay_payment_id}`));
      const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
      if (expectedSig !== razorpay_signature) {
        return jsonResponse({ error: "Signature mismatch" }, 400);
      }

      const orderRes = await fetch(`${RAZORPAY_API}/orders/${razorpay_order_id}`, { headers: rzpHeaders() });
      if (!orderRes.ok) return jsonResponse({ error: "Order lookup failed" }, 400);
      const order = await orderRes.json();

      if (order.notes?.user_id !== user.id || order.notes?.kind !== "tier_upgrade_prorated") {
        return jsonResponse({ error: "Order does not belong to user" }, 403);
      }

      const expectedPaise = Number(order.notes?.prorated_charge || 0) * 100;
      if (Number(order.amount) !== expectedPaise) {
        return jsonResponse({ error: "Amount mismatch" }, 400);
      }

      // Idempotency
      const { data: existing } = await serviceClient
        .from("payment_audit_logs")
        .select("id")
        .eq("razorpay_payment_id", razorpay_payment_id)
        .eq("event_type", "tier_upgrade_verified")
        .maybeSingle();
      if (existing) {
        return jsonResponse({ success: true, idempotent: true });
      }

      const tierId = order.notes?.tier_id;
      const { data: tier } = await serviceClient
        .from("plan_view_tiers")
        .select("id, daily_views, monthly_price, plan_name")
        .eq("id", tierId)
        .maybeSingle();

      if (!tier) return jsonResponse({ error: "Tier not found" }, 400);

      // Update profile — daily views now active immediately. expires_at on subscription unchanged.
      await serviceClient.from("profiles").update({
        selected_tier_id: tier.id,
        selected_daily_views: tier.daily_views,
      }).eq("id", user.id);

      await serviceClient.from("payment_audit_logs").insert({
        user_id: user.id,
        event_type: "tier_upgrade_verified",
        razorpay_order_id,
        razorpay_payment_id,
        payload: {
          tier_id: tier.id,
          new_daily_views: tier.daily_views,
          new_monthly_price: tier.monthly_price,
          prorated_charge: Number(order.notes?.prorated_charge || 0),
        },
        source: "frontend",
        idempotency_key: `upg_verify_${razorpay_payment_id}`,
      });

      return jsonResponse({
        success: true,
        new_daily_views: tier.daily_views,
        new_monthly_price: Number(tier.monthly_price),
      });
    }

    if (action === "create_topup_order") {
      const units = Math.max(1, Math.min(100, Number(body.units || 1)));

      // Resolve user's active plan to get extras pricing
      const { data: sub } = await serviceClient
        .from("user_subscriptions")
        .select("plan_key")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const rawPlanKey = sub?.plan_key || "free";
      const planKey = rawPlanKey.split("_")[0];

      const { data: planRow } = await serviceClient
        .from("plan_config")
        .select("extra_views_price_per_unit, extra_views_unit_size")
        .eq("plan_name", planKey)
        .maybeSingle();

      const pricePerUnit = Number(planRow?.extra_views_price_per_unit || 0);
      const unitSize = Number(planRow?.extra_views_unit_size || 0);
      if (pricePerUnit <= 0 || unitSize <= 0) {
        return jsonResponse({ error: "Top-up not available on your plan" }, 400);
      }

      const totalInr = pricePerUnit * units;
      const orderRes = await fetch(`${RAZORPAY_API}/orders`, {
        method: "POST",
        headers: rzpHeaders(),
        body: JSON.stringify({
          amount: Math.round(totalInr * 100),
          currency: "INR",
          receipt: `topup_${user.id.slice(0, 8)}_${Date.now()}`,
          notes: {
            user_id: user.id,
            kind: "extra_views_topup",
            plan_key: planKey,
            units: String(units),
            unit_size: String(unitSize),
            price_per_unit: String(pricePerUnit),
          },
        }),
      });
      if (!orderRes.ok) {
        const errText = await orderRes.text();
        console.error("Razorpay topup order error:", orderRes.status, errText);
        let detail: any = errText;
        try { detail = JSON.parse(errText); } catch {}
        return jsonResponse({
          error: "Failed to create order",
          where: "topup",
          razorpay_status: orderRes.status,
          razorpay_error: detail,
          key_id_prefix: RAZORPAY_KEY_ID ? RAZORPAY_KEY_ID.slice(0, 8) : null,
        }, 500);
      }
      const order = await orderRes.json();

      await serviceClient.from("payment_audit_logs").insert({
        user_id: user.id,
        event_type: "topup_order_created",
        razorpay_order_id: order.id,
        payload: { units, unit_size: unitSize, price_per_unit: pricePerUnit, total_inr: totalInr },
        source: "frontend",
        idempotency_key: `topup_order_${order.id}`,
      });

      return jsonResponse({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: RAZORPAY_KEY_ID,
        units,
        unit_size: unitSize,
        total_views: units * unitSize,
        total_inr: totalInr,
      });
    }

    if (action === "verify_topup_payment") {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return jsonResponse({ error: "Missing payment verification fields" }, 400);
      }

      // HMAC verify
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw", encoder.encode(RAZORPAY_KEY_SECRET),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const sig = await crypto.subtle.sign("HMAC", key,
        encoder.encode(`${razorpay_order_id}|${razorpay_payment_id}`));
      const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
      if (expectedSig !== razorpay_signature) {
        return jsonResponse({ error: "Signature mismatch" }, 400);
      }

      const orderRes = await fetch(`${RAZORPAY_API}/orders/${razorpay_order_id}`, { headers: rzpHeaders() });
      if (!orderRes.ok) return jsonResponse({ error: "Order lookup failed" }, 400);
      const order = await orderRes.json();

      if (order.notes?.user_id !== user.id || order.notes?.kind !== "extra_views_topup") {
        return jsonResponse({ error: "Order does not belong to user" }, 403);
      }

      const units = Number(order.notes?.units || 0);
      const unitSize = Number(order.notes?.unit_size || 0);
      const pricePerUnit = Number(order.notes?.price_per_unit || 0);
      const expectedPaise = Math.round(pricePerUnit * units * 100);
      if (Number(order.amount) !== expectedPaise) {
        return jsonResponse({ error: "Amount mismatch" }, 400);
      }

      // Idempotency check via audit log
      const { data: existing } = await serviceClient
        .from("payment_audit_logs")
        .select("id")
        .eq("razorpay_payment_id", razorpay_payment_id)
        .eq("event_type", "topup_verified")
        .maybeSingle();
      if (existing) {
        return jsonResponse({ success: true, idempotent: true });
      }

      const addedViews = units * unitSize;

      // Read current extras (sum if not expired, else reset)
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("extra_views_purchased, extra_views_expires_at")
        .eq("id", user.id)
        .maybeSingle();

      const now = new Date();
      const currentExpires = profile?.extra_views_expires_at ? new Date(profile.extra_views_expires_at) : null;
      const stillValid = currentExpires && currentExpires > now;
      const newTotal = (stillValid ? Number(profile?.extra_views_purchased || 0) : 0) + addedViews;

      // End of current month in IST (00:00 IST on the 1st of next month)
      const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const endIst = new Date(ist.getFullYear(), ist.getMonth() + 1, 1, 0, 0, 0);
      // Convert IST midnight back to UTC (IST is UTC+5:30)
      const endUtc = new Date(endIst.getTime() - 5.5 * 60 * 60 * 1000);

      await serviceClient.from("profiles").update({
        extra_views_purchased: newTotal,
        extra_views_expires_at: endUtc.toISOString(),
      }).eq("id", user.id);

      await serviceClient.from("payment_audit_logs").insert({
        user_id: user.id,
        event_type: "topup_verified",
        razorpay_order_id,
        razorpay_payment_id,
        payload: { added_views: addedViews, total_views: newTotal, expires_at: endUtc.toISOString(), units, unit_size: unitSize },
        source: "frontend",
        idempotency_key: `topup_verify_${razorpay_payment_id}`,
      });

      return jsonResponse({
        success: true,
        added_views: addedViews,
        total_extra_views: newTotal,
        expires_at: endUtc.toISOString(),
      });
    }

    if (action === "get_topup_config") {
      const { data: sub } = await serviceClient
        .from("user_subscriptions")
        .select("plan_key")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const rawPlanKey = sub?.plan_key || "free";
      const planKey = rawPlanKey.split("_")[0];

      const { data: planRow } = await serviceClient
        .from("plan_config")
        .select("extra_views_price_per_unit, extra_views_unit_size")
        .eq("plan_name", planKey)
        .maybeSingle();

      const { data: profile } = await serviceClient
        .from("profiles")
        .select("extra_views_purchased, extra_views_expires_at")
        .eq("id", user.id)
        .maybeSingle();

      return jsonResponse({
        plan_key: planKey,
        price_per_unit: Number(planRow?.extra_views_price_per_unit || 0),
        unit_size: Number(planRow?.extra_views_unit_size || 0),
        extra_views_purchased: Number(profile?.extra_views_purchased || 0),
        extra_views_expires_at: profile?.extra_views_expires_at || null,
      });
    }

    if (action === "get_config") {
      const { data: plans } = await serviceClient.from("admin_subscription_plans")
        .select("*").eq("is_active", true).order("price_inr");

      const { data: settings } = await serviceClient.from("platform_settings")
        .select("key, value")
        .in("key", [
          "support_whatsapp", "support_message_template",
          "razorpay_monthly_price", "razorpay_onetime_price",
          "razorpay_onetime_validity_days", "razorpay_onetime_is_lifetime",
        ]);

      const settingsMap: Record<string, string> = {};
      settings?.forEach((s: any) => { settingsMap[s.key] = s.value; });

      return jsonResponse({
        key_id: RAZORPAY_KEY_ID,
        plans: plans || [],
        settings: settingsMap,
      });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (err: any) {
    console.error("razorpay-portal error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});
