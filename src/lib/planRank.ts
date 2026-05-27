/**
 * Single source of truth for plan ordering.
 * Higher rank = bigger / more-included plan.
 * `trial` is treated as Pro-equivalent (matches existing trial behavior).
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
