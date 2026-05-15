import { Eye, Info, ArrowUpRight } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { useDailyViews } from "@/hooks/useDailyViews";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePlan } from "@/hooks/usePlan";

/**
 * Today's Views — plan-level total across ALL flows (shared pool).
 * Resets at midnight IST. Shown on the creator dashboard.
 */
export const DailyViewsCard = () => {
  const { used, limit, isUnlimited, percent, status } = useDailyViews();
  const { plan } = usePlan();

  const barColor =
    status === "limit"
      ? "bg-destructive"
      : status === "warning"
      ? "bg-warning"
      : "bg-success";

  const headerSub =
    status === "limit"
      ? "Limit reached · Resets tomorrow"
      : "Resets at midnight IST";

  return (
    <div className="premium-card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="stat-icon">
            <Eye size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">Today's Views</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                      <Info size={11} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px] text-xs">
                    Total unique viewers across all your flows per day. Resets at midnight IST.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-[11px] text-muted-foreground">{headerSub}</p>
          </div>
        </div>
        {!isUnlimited && plan.tier !== "pro" && status !== "ok" && (
          <Link
            to="/pricing"
            className="text-[11px] font-medium text-primary hover:underline flex items-center gap-0.5 shrink-0"
          >
            Upgrade <ArrowUpRight size={11} />
          </Link>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-heading font-bold">{used.toLocaleString("en-IN")}</span>
        <span className="text-sm text-muted-foreground">
          / {isUnlimited ? "∞" : limit.toLocaleString("en-IN")} views
        </span>
      </div>

      {!isUnlimited && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {status === "limit" && (
        <p className="text-[11px] text-destructive mt-2">
          New prospects can't view your flows until tomorrow.
        </p>
      )}
      {status === "warning" && (
        <p className="text-[11px] text-warning mt-2">
          You're close to today's limit. Consider upgrading.
        </p>
      )}

      <p className="text-[10px] text-muted-foreground/70 mt-3">
        Shared across all your flows — not per flow.
      </p>
    </div>
  );
};
