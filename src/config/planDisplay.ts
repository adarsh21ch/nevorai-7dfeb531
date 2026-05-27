export type PlanKeyLike = "free" | "basic" | "growth" | "pro" | "trial" | "expired" | string | null | undefined;

export interface PlanDisplay {
  name: string;
  color: string;
  gradient: string;
  badgeClass: string;
}

export const PLAN_DISPLAY: Record<string, PlanDisplay> = {
  free: { name: "Free", color: "#6B7A99", gradient: "from-slate-500 to-slate-600", badgeClass: "bg-muted text-muted-foreground" },
  basic: { name: "Basic", color: "#818CF8", gradient: "from-indigo-500 to-purple-600", badgeClass: "bg-indigo-500/15 text-indigo-300 border border-indigo-400/30" },
  growth: { name: "Growth", color: "#A78BFA", gradient: "from-violet-500 to-emerald-500", badgeClass: "bg-violet-500/15 text-violet-300 border border-violet-400/30" },
  pro: { name: "Pro", color: "#00C896", gradient: "from-emerald-500 to-blue-600", badgeClass: "bg-emerald-500/12 text-emerald-300 border border-emerald-400/25" },
  enterprise: { name: "Enterprise", color: "#F59E0B", gradient: "from-amber-500 to-orange-600", badgeClass: "bg-amber-500/15 text-amber-300 border border-amber-400/30" },
  trial: { name: "Free Trial", color: "#6B7A99", gradient: "from-slate-500 to-slate-600", badgeClass: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30" },
  expired: { name: "Expired", color: "#EF4444", gradient: "from-red-500 to-red-600", badgeClass: "bg-destructive/15 text-destructive" },
};

export const planDisplay = (key: PlanKeyLike): PlanDisplay => {
  if (!key) return PLAN_DISPLAY.free;
  const k = String(key).toLowerCase();
  return PLAN_DISPLAY[k] || PLAN_DISPLAY.free;
};

export const planName = (key: PlanKeyLike): string => planDisplay(key).name;
