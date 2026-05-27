/**
 * Plan ordering helpers.
 *
 * Source of truth is `plan_config.display_order` in the DB (loaded via
 * `useAllPlans()`). The static maps below are fallbacks for code paths that
 * cannot reach React Query state (e.g. utility modules, server fns).
 */

export const PLAN_RANK: Record<string, number> = {
  free: 0,
  basic: 1,
  growth: 2,
  pro: 3,
  trial: 3,
};

export const PAID_TIERS = ["basic", "growth", "pro"] as const;
export type PaidTier = (typeof PAID_TIERS)[number];

export const isPaidTier = (tier: string | null | undefined): tier is PaidTier =>
  !!tier && (PAID_TIERS as readonly string[]).includes(tier);

export const isAtLeast = (
  tier: string | null | undefined,
  min: string,
): boolean => (PLAN_RANK[tier ?? "free"] ?? 0) >= (PLAN_RANK[min] ?? 0);

/** Rank from live plan configs (preferred). Falls back to static PLAN_RANK. */
export const getPlanRank = (
  tier: string | null | undefined,
  configs?: Array<{ plan_name: string; display_order?: number | null }> | null,
): number => {
  if (!tier) return 0;
  if (configs && configs.length) {
    const row = configs.find((c) => c.plan_name === tier);
    if (row && typeof row.display_order === "number") return row.display_order;
  }
  return PLAN_RANK[tier] ?? 0;
};
