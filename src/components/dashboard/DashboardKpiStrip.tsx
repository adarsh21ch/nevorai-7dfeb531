import { Crown, AlertTriangle, ArrowRight } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import { useMonthlyViews } from "@/hooks/useMonthlyViews";
import { useDailyViews } from "@/hooks/useDailyViews";
import { usePlan } from "@/hooks/usePlan";
import { planDisplay } from "@/config/planDisplay";
import { format } from "date-fns";

const fmt = (n: number) => n.toLocaleString("en-IN");

export const DashboardKpiStrip = () => {
  const { plan } = usePlan();
  const monthly = useMonthlyViews();
  const daily = useDailyViews();
  const navigate = useNavigate();
  const display = planDisplay(plan.tier);
  const expiresIn = plan.daysLeft ?? null;
  const showRenew = expiresIn !== null && expiresIn <= 7 && expiresIn > 0 && plan.isPaid;

  const monthPct = monthly.isUnlimited ? 100 : monthly.pct;
  const dayPct = daily.isUnlimited ? 100 : daily.percent;

  const resetDateFmt = (() => {
    try { return format(new Date(monthly.resetAt), "d MMM"); } catch { return "next month"; }
  })();

  return (
    <div
      className="flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-500/15 px-5 py-4 bg-gradient-to-br from-primary/[0.06] to-primary/[0.02]"
    >
      <div className="flex min-w-[140px] items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <Crown size={16} className="text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{display.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${display.badgeClass}`}>
              {plan.isPaid ? "ACTIVE" : plan.tier === "trial" ? "TRIAL" : "FREE"}
            </span>
          </div>
          {expiresIn !== null && expiresIn <= 7 && expiresIn > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-500">
              <AlertTriangle size={10} /> Expires in {expiresIn}d
            </p>
          )}
        </div>
      </div>

      <div className="hidden h-10 w-px shrink-0 bg-border md:block" />

      <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Monthly Views</span>
          <span className="font-semibold">
            {fmt(monthly.used)} / {monthly.isUnlimited ? "∞" : fmt(monthly.limit)}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all" style={{ width: `${monthPct}%` }} />
        </div>
        <span className="text-[10px] text-muted-foreground/70">Resets {resetDateFmt}</span>
      </div>

      <div className="hidden h-10 w-px shrink-0 bg-border md:block" />

      <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Today's Views</span>
          <span className="font-semibold">
            {fmt(daily.used)} / {daily.isUnlimited ? "∞" : fmt(daily.limit)}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all" style={{ width: `${dayPct}%` }} />
        </div>
        <span className="text-[10px] text-muted-foreground/70">Resets midnight IST</span>
      </div>

      {showRenew && (
        <button
          onClick={() => navigate("/billing")}
          className="flex items-center gap-1 whitespace-nowrap rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-500 transition-colors hover:bg-amber-500/15"
        >
          Renew Now <ArrowRight size={12} />
        </button>
      )}

      {!daily.isUnlimited && dayPct >= 100 && (
        <button
          onClick={() => navigate("/billing?upgrade=views")}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-400 transition-colors hover:bg-rose-500/15"
        >
          <span className="flex items-center gap-2"><AlertTriangle size={12} /> Daily limit reached — prospects are blocked</span>
          <span className="flex items-center gap-1">Get more views <ArrowRight size={12} /></span>
        </button>
      )}
      {!daily.isUnlimited && dayPct >= 80 && dayPct < 100 && (
        <button
          onClick={() => navigate("/billing?upgrade=views")}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-500/15"
        >
          <span className="flex items-center gap-2"><AlertTriangle size={12} /> {dayPct}% of today's views used</span>
          <span className="flex items-center gap-1">Get more views <ArrowRight size={12} /></span>
        </button>
      )}
    </div>
  );
};
