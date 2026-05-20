// Centralized Meta Pixel helper.
// - Waits for the async fbq stub to be ready (avoids silent no-ops).
// - Sends an eventID with every event so Browser + CAPI dedupe.
// - Mirrors to /api/pixel/track for Conversions API (ad-blocker fallback).
// - Per-key dedup guard so Strict Mode / lazy-route re-mounts don't double-fire.

if (typeof window !== "undefined") {
  window._fbqEventIds = window._fbqEventIds ?? new Set<string>();
}

export type StandardEvent =
  | "PageView"
  | "Lead"
  | "CompleteRegistration"
  | "StartTrial"
  | "AddToCart"
  | "InitiateCheckout"
  | "Purchase"
  | "Subscribe"
  | "ViewContent";

export type FbqEventParams = {
  value?: number;
  currency?: string;
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  content_type?: "product";
  num_items?: number;
  predicted_ltv?: number;
  status?: string;
  email?: string;
  phone?: string;
  user_id?: string;
  order_id?: string;
  [key: string]: any;
};

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function waitForFbq(maxAttempts = 30, delayMs = 100): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    let attempts = 0;
    const check = () => {
      attempts += 1;
      if (typeof window.fbq === "function") return resolve(true);
      if (attempts >= maxAttempts) {
        console.warn("[pixel] fbq unavailable after", maxAttempts * delayMs, "ms");
        return resolve(false);
      }
      setTimeout(check, delayMs);
    };
    check();
  });
}

export async function trackPixel(
  event: StandardEvent | string,
  params: FbqEventParams = {},
  options: { dedupKey?: string; serverSide?: boolean } = {},
): Promise<void> {
  if (typeof window === "undefined") return;

  const eventID = genId();
  const dedupKey = options.dedupKey ?? `${event}:${eventID}`;

  if (window._fbqEventIds?.has(dedupKey)) {
    console.log("[pixel] dedup hit, skipping", event, dedupKey);
    return;
  }
  window._fbqEventIds?.add(dedupKey);

  const ready = await waitForFbq();
  if (ready) {
    console.log("[pixel] firing", event, "eventID", eventID, params);
    try {
      window.fbq!("track", event, params, { eventID });
    } catch (err) {
      console.warn("[pixel] fbq call threw", err);
    }
  } else {
    console.warn("[pixel] relying on CAPI only for", event);
  }

  if (options.serverSide !== false) {
    try {
      await fetch("/api/pixel/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          eventID,
          params,
          eventSourceUrl: window.location.href,
          userAgent: navigator.userAgent,
        }),
        keepalive: true,
      });
    } catch (err) {
      console.warn("[pixel] CAPI mirror failed (non-blocking)", err);
    }
  }
}

export const trackLead = (userId: string, params: FbqEventParams = {}) =>
  trackPixel(
    "Lead",
    { ...params, user_id: userId },
    { dedupKey: `Lead:${userId}` },
  );

export const trackCompleteRegistration = (userId: string, params: FbqEventParams = {}) =>
  trackPixel(
    "CompleteRegistration",
    { ...params, user_id: userId },
    { dedupKey: `CompleteRegistration:${userId}` },
  );

export const trackStartTrial = (userId: string, plan: string) =>
  trackPixel(
    "StartTrial",
    { content_name: plan, user_id: userId },
    { dedupKey: `StartTrial:${userId}:${plan}` },
  );

export const trackAddToCart = (plan: string, value: number) =>
  trackPixel("AddToCart", { content_name: plan, value, currency: "INR" });

export const trackInitiateCheckout = (plan: string, value: number) =>
  trackPixel("InitiateCheckout", { content_name: plan, value, currency: "INR" });

export const trackPurchase = (
  userId: string,
  plan: string,
  value: number,
  orderId: string,
) =>
  trackPixel(
    "Purchase",
    {
      content_name: plan,
      value,
      currency: "INR",
      user_id: userId,
      order_id: orderId,
    },
    { dedupKey: `Purchase:${orderId}` },
  );

export const trackFunnelCreated = (userId: string) =>
  trackPixel("FunnelCreated", { user_id: userId });

export const trackVideoUploaded = (userId: string) =>
  trackPixel("VideoUploaded", { user_id: userId });

export const trackLinkShared = (
  userId: string,
  channel: "whatsapp" | "copy" | "share",
) => trackPixel("LinkShared", { user_id: userId, channel });

export function getFiredEvents(): string[] {
  return Array.from(window._fbqEventIds ?? []);
}

if (typeof window !== "undefined") {
  window.getFiredPixelEvents = getFiredEvents;
}
