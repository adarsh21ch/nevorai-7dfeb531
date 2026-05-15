import { Link } from "@/lib/router-compat";
import { Crown, ArrowUpRight, Eye, Layers, Video, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMonthlyViews } from "@/hooks/useMonthlyViews";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePlan } from "@/hooks/usePlan";
import { planDisplay } from "@/config/planDisplay";
import { format } from "date-fns";

const compactNum = (n: number) => n.toLocaleString("en-IN");

export const PlanUsageWidget = () => {
  const views = useMonthlyViews();
  const { plan } = usePlan();
  const { config, counts } = usePlanLimits();
  const display = planDisplay(plan.tier === "trial" ? "trial" : plan.tier);
  const isProOrTrial = plan.tier === "pro" || plan.tier === "trial";

  const barClass = views.isOverLimit
    ? "bg-gradient-to-r from-amber-500 to-red-500"
    : views.isApproachingLimit
    ? "bg-gradient-to-r from-amber-400 to-orange-500"
    : "bg-gradient-to-r from-emerald-500 to-blue-500";

  const resetDateFmt = (() => {
    try { return format(new Date(views.resetAt), "d MMM"); } catch { return "next month"; }
  })();

  return (
    <div className="premium-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="stat-icon">
            <Crown size={16} className="text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-semibold text-sm">{display.name} Plan</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${display.badgeClass}`}>
                {display.name}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">This month's usage</p>
          </div>
        </div>
        {!isProOrTrial && (
          <Link to="/pricing">
            <Button size="sm" variant="hero" className="h-8 text-xs gap-1">
              Upgrade to Pro <ArrowUpRight size={12} />
            </Button>
          </Link>
        )}
      </div>

      {/* PRIMARY — view usage (mode-aware) */}
      {(views.mode === "monthly" || views.mode === "both") && (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-3xl font-heading font-bold tracking-tight">{compactNum(views.used)}</span>
            <span className="text-sm text-muted-foreground">
              / {views.isUnlimited ? "Unlimited" : compactNum(views.limit)} 📆 monthly views
            </span>
          </div>
          {!views.isUnlimited && views.limit > 0 && (
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-500 ${barClass}`} style={{ width: `${views.pct}%` }} />
            </div>
          )}
          {views.extraPurchased > 0 && (
            <p className="text-[11px] text-emerald-500">
              Includes +{compactNum(views.extraPurchased)} extra views purchased this month
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            {views.isOverLimit
              ? <span className="text-destructive font-medium">Monthly limit reached — flows paused until {resetDateFmt}</span>
              : views.isApproachingLimit
              ? <span className="text-amber-500 font-medium">{Math.round(100 - views.pct)}% remaining · resets {resetDateFmt}</span>
              : <>Resets on {resetDateFmt}</>}
          </p>
        </div>
      )}

      {(views.mode === "daily" || views.mode === "both") && (
        <div className="space-y-2 pt-2 border-t border-border/40">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-heading font-bold tracking-tight">{compactNum(views.dailyUsed)}</span>
            <span className="text-sm text-muted-foreground">
              / {views.isDailyUnlimited ? "Unlimited" : compactNum(views.dailyLimit)} 📅 today's views
            </span>
          </div>
          {!views.isDailyUnlimited && views.dailyLimit > 0 && (
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  views.isDailyOverLimit
                    ? "bg-gradient-to-r from-amber-500 to-red-500"
                    : views.isDailyApproachingLimit
                    ? "bg-gradient-to-r from-amber-400 to-orange-500"
                    : "bg-gradient-to-r from-emerald-500 to-blue-500"
                }`}
                style={{ width: `${views.dailyPct}%` }}
              />
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            {views.isDailyOverLimit
              ? <span className="text-destructive font-medium">Daily limit reached — resets at midnight</span>
              : <>Resets at midnight (IST)</>}
          </p>
        </div>
      )}

      {/* SECONDARY metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border">
        <SecondaryStat icon={Layers} label="Active funnels" value={counts.funnels} max={config.max_funnels} />
        <SecondaryStat icon={Video} label="Videos" value={counts.videos} max={config.max_videos ?? 0} />
        <SecondaryStat icon={Eye} label="Landing pages" value={counts.landing_pages} max={config.max_landing_pages} />
        <SecondaryStat icon={Users} label="Live sessions" value={counts.live_sessions} max={config.max_live_sessions} />
      </div>
    </div>
  );
};

const SecondaryStat = ({
  icon: Icon, label, value, max,
}: { icon: any; label: string; value: number; max: number }) => (
  <div className="space-y-1 px-2">
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Icon size={12} />
      <span className="text-[10px] uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-sm font-semibold">
      {value} <span className="text-muted-foreground font-normal">/ {max === -1 ? "∞" : max}</span>
    </p>
  </div>
);
