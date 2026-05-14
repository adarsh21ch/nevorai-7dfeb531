import { Link } from "@/lib/router-compat";
import { AlertTriangle, AlertOctagon, ArrowRight, X } from "lucide-react";
import { useMonthlyViews } from "@/hooks/useMonthlyViews";
import { useState, useEffect } from "react";
import { format } from "date-fns";

const DISMISS_KEY_PREFIX = "nFlow by Nevorai-monthly-views-warn-dismissed-";

export const MonthlyViewsBanner = () => {
  const views = useMonthlyViews();
  const [dismissed, setDismissed] = useState(false);

  const dismissKey = `${DISMISS_KEY_PREFIX}${new Date().toISOString().slice(0, 10)}`;
  useEffect(() => {
    try { setDismissed(localStorage.getItem(dismissKey) === "1"); } catch {}
  }, [dismissKey]);

  if (views.isUnlimited) return null;
  if (!views.isApproachingLimit && !views.isOverLimit) return null;

  const resetDateFmt = (() => {
    try { return format(new Date(views.resetAt), "d MMM"); } catch { return "next month"; }
  })();

  if (views.isOverLimit) {
    return (
      <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3.5 flex items-start sm:items-center justify-between gap-4 mb-4 flex-col sm:flex-row">
        <div className="flex items-start gap-3">
          <AlertOctagon size={20} className="text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">
              You've used all {views.limit.toLocaleString("en-IN")} views this month.
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your funnels are paused until {resetDateFmt} — or upgrade to Pro for 20,000 views/month.
            </p>
          </div>
        </div>
        <Link to="/pricing" className="shrink-0 w-full sm:w-auto">
          <button className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90 px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-1.5">
            Upgrade to Pro <ArrowRight size={14} />
          </button>
        </Link>
      </div>
    );
  }

  if (dismissed) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 flex items-start sm:items-center justify-between gap-4 mb-4 flex-col sm:flex-row">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-200">
            You've used {views.used.toLocaleString("en-IN")} of {views.limit.toLocaleString("en-IN")} views this month.
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upgrade to Pro for 20,000 views/month and avoid pausing your funnels.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
        <Link to="/pricing" className="flex-1 sm:flex-none">
          <button className="w-full bg-amber-500 hover:bg-amber-600 text-black px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1">
            Upgrade <ArrowRight size={12} />
          </button>
        </Link>
        <button
          aria-label="Dismiss warning"
          onClick={() => {
            try { localStorage.setItem(dismissKey, "1"); } catch {}
            setDismissed(true);
          }}
          className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/50"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
