import { Link } from "@/lib/router-compat";
import { BarChart3, Crown, AlertTriangle, ArrowRight } from "lucide-react";
import { useMonthlyViews } from "@/hooks/useMonthlyViews";
import { useDailyViews } from "@/hooks/useDailyViews";
import { useViewsTrend } from "@/hooks/useViewsTrend";
import { usePlan } from "@/hooks/usePlan";
import { planDisplay } from "@/config/planDisplay";
import { format } from "date-fns";

const fmt = (n: number) => n.toLocaleString("en-IN");

export const ViewsOverviewCard = () => {
  const { plan } = usePlan();
  const monthly = useMonthlyViews();
  const daily = useDailyViews();
  const trend = useViewsTrend();
  const display = planDisplay(plan.tier);

  const monthPct = monthly.isUnlimited ? 100 : monthly.pct;
  const dayPct = daily.isUnlimited ? 100 : daily.percent;
  const remainingToday = daily.isUnlimited ? "∞" : Math.max(0, daily.limit - daily.used);

  const resetDateFmt = (() => {
    try { return format(new Date(monthly.resetAt), "d MMM"); } catch { return "next month"; }
  })();

  const trendStats = [
    { label: "Yesterday", value: trend.yesterday, href: "/insights" },
    { label: "Last 7 days", value: trend.last7, href: "/insights" },
    { label: "Last 30 days", value: trend.last30, href: "/insights" },
  ];

  return (
    <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card to-accent/[0.04] overflow-hidden">
      {/* Header row: plan + reset */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-5 py-2.5">
        <div className="flex items-center gap-2">
          <Crown size={13} className="text-primary" />
          <span className="text-xs font-semibold">{display.name}</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${display.badgeClass}`}>
            {plan.isPaid ? "ACTIVE" : plan.tier === "trial" ? "TRIAL" : "FREE"}
          </span>
        </div>
        <Link to="/insights" className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
          View insights <ArrowRight size={11} />
        </Link>
      </div>

      {/* Today's views hero */}
      <Link to="/insights" className="block px-5 pt-5 pb-4 transition-colors hover:bg-primary/[0.03]">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            People Watched Today
          </span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-3">
          <div className="text-5xl font-heading font-extrabold tracking-tight">{fmt(daily.used)}</div>
          <div className="text-sm text-muted-foreground">
            {remainingToday} remaining · {daily.isUnlimited ? "Unlimited plan" : `Daily ${fmt(daily.limit)}`}
          </div>
        </div>
        {!daily.isUnlimited && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all" style={{ width: `${dayPct}%` }} />
          </div>
        )}
      </Link>

      {/* Monthly progress */}
      <div className="border-t border-border/50 px-5 py-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">This month</span>
          <span className="font-semibold">
            {fmt(monthly.used)} / {monthly.isUnlimited ? "∞" : fmt(monthly.limit)}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all" style={{ width: `${monthPct}%` }} />
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground/70">Resets {resetDateFmt}</p>
      </div>

      {/* Trend strip */}
      <div className="grid grid-cols-3 border-t border-border/50">
        {trendStats.map((s, i) => (
          <Link
            key={s.label}
            to={s.href}
            className={`flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-muted/40 ${i < 2 ? "border-r border-border/50" : ""}`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</span>
            <span className="text-lg font-heading font-bold leading-tight">{fmt(s.value)}</span>
          </Link>
        ))}
      </div>

      {/* Limit alerts */}
      {!daily.isUnlimited && dayPct >= 100 && (
        <Link
          to="/billing?upgrade=views"
          className="flex items-center justify-between gap-2 border-t border-rose-500/30 bg-rose-500/10 px-5 py-2.5 text-xs font-semibold text-rose-400 transition-colors hover:bg-rose-500/15"
        >
          <span className="flex items-center gap-2"><AlertTriangle size={12} /> Daily limit reached — prospects are blocked</span>
          <span className="flex items-center gap-1">Get more views <ArrowRight size={12} /></span>
        </Link>
      )}
      {!daily.isUnlimited && dayPct >= 80 && dayPct < 100 && (
        <Link
          to="/billing?upgrade=views"
          className="flex items-center justify-between gap-2 border-t border-amber-500/30 bg-amber-500/10 px-5 py-2.5 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-500/15"
        >
          <span className="flex items-center gap-2"><AlertTriangle size={12} /> {dayPct}% of today's views used</span>
          <span className="flex items-center gap-1">Get more views <ArrowRight size={12} /></span>
        </Link>
      )}
    </section>
  );
};
