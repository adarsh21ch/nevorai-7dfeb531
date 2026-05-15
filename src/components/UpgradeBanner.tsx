import { usePlan } from "@/hooks/usePlan";
import { AlertTriangle, Crown, ArrowRight } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";

export const UpgradeBanner = () => {
  const { plan } = usePlan();

  if (plan.tier === "trial") return null;
  if (plan.isPaid && !plan.isExpired && !plan.isExpiringSoon) return null;

  if (plan.isExpired) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <AlertTriangle size={18} className="text-destructive shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">Your plan has expired</p>
            <p className="text-xs text-muted-foreground">Renew now to keep using premium features.</p>
          </div>
        </div>
        <Link to="/billing">
          <Button size="sm" variant="destructive" className="gap-1.5 shrink-0">
            Renew <ArrowRight size={14} />
          </Button>
        </Link>
      </div>
    );
  }

  if (plan.isExpiringSoon) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Plan expiring in {plan.daysLeft} day{plan.daysLeft !== 1 ? "s" : ""}</p>
            <p className="text-xs text-muted-foreground">Renew to avoid losing access.</p>
          </div>
        </div>
        <Link to="/billing">
          <Button size="sm" variant="outline" className="gap-1.5 border-amber-500 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 shrink-0">
            Renew Now
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/15 rounded-lg px-4 py-3 flex items-center justify-between gap-4 mb-4">
      <div className="flex items-center gap-3">
        <Crown size={18} className="text-primary shrink-0" />
        <div>
          <p className="text-sm font-medium">Upgrade to unlock more features</p>
          <p className="text-xs text-muted-foreground">Get more flows, landing pages, live sessions, and premium tools.</p>
        </div>
      </div>
      <Link to="/billing">
        <Button size="sm" className="gap-1.5 shrink-0">
          Upgrade <ArrowRight size={14} />
        </Button>
      </Link>
    </div>
  );
};
