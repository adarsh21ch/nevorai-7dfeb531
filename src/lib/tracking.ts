import { startEntityView, heartbeatEntityView } from "@/lib/entityTracking.functions";

type EntityType = "funnel" | "landing_page" | "live_session";

const SESSION_KEY = "nv_session_id";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "ssr-no-session";
  try {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return crypto.randomUUID().replace(/-/g, "");
  }
}

function detectDevice(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobile|iphone|android/.test(ua)) return "mobile";
  return "desktop";
}

function detectReferrer(): string {
  if (typeof document === "undefined") return "direct";
  const ref = document.referrer || "";
  if (!ref) return "direct";
  try {
    const host = new URL(ref).hostname.toLowerCase();
    if (host.includes("whatsapp") || host === "wa.me") return "whatsapp";
    if (host.includes("instagram")) return "instagram";
    if (host.includes("facebook") || host === "fb.com") return "facebook";
    if (host.includes("youtube") || host === "youtu.be") return "youtube";
    if (host.includes("google")) return "google";
    if (host.includes("t.co") || host.includes("twitter") || host.includes("x.com")) return "twitter";
    return "other";
  } catch {
    return "other";
  }
}

/**
 * Track a view on a public entity page (funnel/landing-page/live-session).
 * Sends a single start event + a heartbeat every 30s while the tab is visible.
 * Returns a cleanup function — call it on unmount.
 */
export function trackEntityView(entityType: EntityType, entityId: string | null | undefined) {
  if (!entityId || typeof window === "undefined") return () => {};

  let eventId: string | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;
  let cancelled = false;

  const start = async () => {
    try {
      const res = await startEntityView({
        data: {
          entityType,
          entityId,
          sessionId: getOrCreateSessionId(),
          deviceType: detectDevice(),
          referrerSource: detectReferrer(),
        },
      });
      if (cancelled) return;
      eventId = res?.eventId ?? null;
      if (eventId) {
        interval = setInterval(() => {
          if (document.visibilityState !== "visible") return;
          if (!eventId) return;
          heartbeatEntityView({ data: { entityType, eventId } }).catch(() => {});
        }, 30_000);
      }
    } catch (err) {
      console.debug("trackEntityView failed (non-fatal):", err);
    }
  };

  void start();

  return () => {
    cancelled = true;
    if (interval) clearInterval(interval);
  };
}

/**
 * Returns attribution metadata to attach to a lead/registration form
 * submission. Reads UTM params from the URL and the current referrer.
 */
export function captureAttribution(
  sourceType: "funnel" | "landing_page" | "video" | "live_session",
  sourceId: string,
  sourceSlug?: string,
) {
  if (typeof window === "undefined") {
    return {
      source_type: sourceType,
      source_id: sourceId,
      source_slug: sourceSlug ?? null,
      captured_at: new Date().toISOString(),
      referrer_url: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
    };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    source_type: sourceType,
    source_id: sourceId,
    source_slug: sourceSlug ?? null,
    captured_at: new Date().toISOString(),
    referrer_url: document.referrer || null,
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
  };
}
