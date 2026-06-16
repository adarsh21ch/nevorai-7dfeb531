// Team tracking helpers — read share-link token from URL, resolve it,
// fire link_events, and stamp share_link_id on lead inserts.
import { supabase } from "@/integrations/supabase/client";

const TOKEN_PARAMS = ["t", "ref"]; // accept either ?t= or ?ref=
const FP_KEY = "nev_fp";
const RESOLVED_KEY_PREFIX = "nev_sl_"; // sessionStorage cache: funnelId -> share_link_id
const VIEW_FIRED_PREFIX = "nev_view_"; // dedupe view events client-side per (link,step)

export function getVisitorFingerprint(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let fp = localStorage.getItem(FP_KEY);
    if (!fp) {
      fp =
        (crypto.randomUUID && crypto.randomUUID()) ||
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(FP_KEY, fp);
    }
    return fp;
  } catch {
    return `nofp-${Math.random().toString(36).slice(2)}`;
  }
}

export function readShareTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    for (const k of TOKEN_PARAMS) {
      const v = params.get(k);
      if (v && v.trim()) return v.trim();
    }
  } catch {}
  return null;
}

/**
 * Fire a view/lead/complete event for the current share token.
 * Returns the resolved share_link_id, which can be stamped onto lead rows.
 * Safe to call when there is no token (no-op, returns null).
 */
export async function trackLinkEvent(
  funnelId: string,
  stepId: string | null,
  eventType: "view" | "lead" | "complete",
): Promise<string | null> {
  const token = readShareTokenFromUrl();
  if (!token) return null;
  try {
    // Client-side dedupe of identical view events in the same session.
    if (eventType === "view") {
      const key = `${VIEW_FIRED_PREFIX}${token}_${stepId ?? "root"}`;
      if (sessionStorage.getItem(key)) {
        // Still return cached share_link_id so leads can be attributed.
        return getCachedShareLinkId(funnelId);
      }
      sessionStorage.setItem(key, "1");
    }
    const { data, error } = await supabase.rpc("track_link_event", {
      p_token: token,
      p_step_id: stepId,
      p_event_type: eventType,
      p_fingerprint: getVisitorFingerprint(),
    });
    if (error) {
      console.warn("[teamTracking] track_link_event failed", error.message);
      return null;
    }
    const shareLinkId = (data as string | null) ?? null;
    if (shareLinkId) cacheShareLinkId(funnelId, shareLinkId);
    return shareLinkId;
  } catch (e) {
    console.warn("[teamTracking] track_link_event threw", e);
    return null;
  }
}

function cacheShareLinkId(funnelId: string, id: string) {
  try { sessionStorage.setItem(`${RESOLVED_KEY_PREFIX}${funnelId}`, id); } catch {}
}

export function getCachedShareLinkId(funnelId: string): string | null {
  try { return sessionStorage.getItem(`${RESOLVED_KEY_PREFIX}${funnelId}`); } catch { return null; }
}
