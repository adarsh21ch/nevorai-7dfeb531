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
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
    const { data, error } = await (supabase as any).rpc("track_link_event_v2", {
      p_token: token,
      p_step_id: stepId,
      p_event_type: eventType,
      p_fingerprint: getVisitorFingerprint(),
      p_user_agent: ua,
    });
    if (error) {
      // fall back to v1 if v2 not deployed yet
      const fb = await (supabase as any).rpc("track_link_event", {
        p_token: token,
        p_step_id: stepId,
        p_event_type: eventType,
        p_fingerprint: getVisitorFingerprint(),
      });
      if (fb.error) {
        console.warn("[teamTracking] track_link_event failed", fb.error.message);
        return null;
      }
      const shareLinkId = (fb.data as string | null) ?? null;
      if (shareLinkId) cacheShareLinkId(funnelId, shareLinkId);
      return shareLinkId;
    }
    const shareLinkId = (data as string | null) ?? null;
    if (shareLinkId) cacheShareLinkId(funnelId, shareLinkId);
    return shareLinkId;
  } catch (e) {
    console.warn("[teamTracking] track_link_event threw", e);
    return null;
  }
}

/**
 * Record a funnel event (view/lead/complete) into link_events. If the URL has
 * a team share token (?t=/?ref=), attributes to that member; otherwise resolves
 * the funnel's owner-default universal share link server-side.
 *
 * This is the single entry point for funnel view/lead tracking. Use it
 * instead of trackLinkEvent for funnel pages so owner/direct opens are
 * counted too.
 */
export async function trackFunnelEvent(
  funnelId: string,
  stepId: string | null,
  eventType: "view" | "lead" | "complete",
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const token = readShareTokenFromUrl();
  try {
    if (eventType === "view") {
      const key = `${VIEW_FIRED_PREFIX}fv_${funnelId}_${stepId ?? "root"}`;
      if (sessionStorage.getItem(key)) return getCachedShareLinkId(funnelId);
      sessionStorage.setItem(key, "1");
    }
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
    const { data, error } = await (supabase as any).rpc("track_funnel_event", {
      p_funnel_id: funnelId,
      p_token: token,
      p_step_id: stepId,
      p_event_type: eventType,
      p_fingerprint: getVisitorFingerprint(),
      p_user_agent: ua,
    });
    if (error) {
      console.warn("[teamTracking] track_funnel_event failed", error.message);
      // Fallback to v2 if token present
      if (token) return trackLinkEvent(funnelId, stepId, eventType);
      return null;
    }
    const shareLinkId = (data as string | null) ?? null;
    if (shareLinkId) cacheShareLinkId(funnelId, shareLinkId);
    return shareLinkId;
  } catch (e) {
    console.warn("[teamTracking] track_funnel_event threw", e);
    return null;
  }
}


function cacheShareLinkId(funnelId: string, id: string) {
  try { sessionStorage.setItem(`${RESOLVED_KEY_PREFIX}${funnelId}`, id); } catch {}
}

export function getCachedShareLinkId(funnelId: string): string | null {
  try { return sessionStorage.getItem(`${RESOLVED_KEY_PREFIX}${funnelId}`); } catch { return null; }
}

// =====================================================================
// Dashboard hooks (caller = funnel owner)
// =====================================================================
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type TeamTrackingPeriod = "today" | "7d" | "30d" | "all";

function periodToRange(p: TeamTrackingPeriod): { from: string | null; to: string | null } {
  if (p === "all") return { from: null, to: null };
  const now = new Date();
  const to = now.toISOString();
  const from = new Date(now);
  if (p === "today") from.setHours(0, 0, 0, 0);
  else if (p === "7d") from.setDate(from.getDate() - 7);
  else if (p === "30d") from.setDate(from.getDate() - 30);
  return { from: from.toISOString(), to };
}

export type TeamMatrixFunnel = { id: string; name: string };
export type TeamMatrixCell = { funnel_id: string; viewers: number; leads: number };
export type TeamMatrixMember = {
  id: string;
  name: string;
  avatar_url: string | null;
  is_you: boolean;
  label_id: string | null;
  funnels: TeamMatrixCell[];
  total_viewers: number;
  total_leads: number;
};
export type TeamMatrixTotals = {
  per_funnel: TeamMatrixCell[];
  grand_viewers: number;
  grand_leads: number;
};
export type TeamMatrix = {
  funnels: TeamMatrixFunnel[];
  members: TeamMatrixMember[];
  totals: TeamMatrixTotals;
};

export function useTeamTracking(period: TeamTrackingPeriod) {
  return useQuery<TeamMatrix>({
    queryKey: ["team-tracking", period],
    queryFn: async () => {
      const { from, to } = periodToRange(period);
      const { data, error } = await (supabase as any).rpc("get_team_tracking", {
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return (data ?? { funnels: [], members: [], totals: { per_funnel: [], grand_viewers: 0, grand_leads: 0 } }) as TeamMatrix;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export type TeamLabel = { id: string; name: string; sort_order: number };

export function useTeamLabels() {
  return useQuery<TeamLabel[]>({
    queryKey: ["team-labels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_labels" as any)
        .select("id,name,sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown) as TeamLabel[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("team_labels" as any)
        .insert({ name, owner_id: u.user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-labels"] }),
  });
}

export function useDeleteLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_labels" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-labels"] });
      qc.invalidateQueries({ queryKey: ["team-tracking"] });
    },
  });
}

export function useAssignMemberLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, labelId }: { memberId: string; labelId: string | null }) => {
      const { error } = await (supabase as any).rpc("assign_member_label", {
        p_member_id: memberId,
        p_label_id: labelId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-tracking"] }),
  });
}

export function useColumnConfig() {
  return useQuery<string[]>({
    queryKey: ["tracking-column-config"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase
        .from("tracking_column_config" as any)
        .select("funnel_order")
        .eq("owner_id", u.user.id)
        .maybeSingle();
      return ((data as any)?.funnel_order ?? []) as string[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveColumnConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (funnelOrder: string[]) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("tracking_column_config" as any).upsert({
        owner_id: u.user.id,
        funnel_order: funnelOrder,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracking-column-config"] }),
  });
}

export function useHasTeam() {
  return useQuery<boolean>({
    queryKey: ["has-team-connections"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { count } = await supabase
        .from("team_connections" as any)
        .select("id", { count: "exact", head: true })
        .eq("upline_id", u.user.id)
        .eq("status", "active");
      return (count ?? 0) > 0;
    },
    staleTime: 5 * 60 * 1000,
  });
}
