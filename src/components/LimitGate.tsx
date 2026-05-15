import { usePlan } from "@/hooks/usePlan";
import { useResourceCount } from "@/hooks/useResourceCount";
import { Lock, Crown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";

interface LimitGateProps {
  resource: "flow" | "landing_page" | "live_session";
  children: React.ReactNode;
}

const labels: Record<string, { singular: string; plural: string }> = {
  flow: { singular: "Flow", plural: "Flows" },
  landing_page: { singular: "Landing Page", plural: "Landing Pages" },
  live_session: { singular: "Live Session", plural: "Live Sessions" },
};

export const LimitGate = ({ resource, children }: LimitGateProps) => {
  const { plan, canCreate } = usePlan();
  const counts = useResourceCount();

  const countMap = {
    flow: counts.flows,
    landing_page: counts.landing_pages,
    live_session: counts.live_sessions,
  };

  const limitMap = {
    funnel: plan.limits.funnel_limit,
    landing_page: plan.limits.landing_page_limit,
    live_session: plan.limits.live_session_limit,
  };

  const currentCount = countMap[resource];
  const limit = limitMap[resource];
  const l = labels[resource];

  if (canCreate(resource, currentCount)) {
    return <>{children}</>;
  }

  const tierLabel = plan.tier === "free" ? "Basic or Pro" : plan.tier === "basic" ? "Pro" : "";

  return (
    <div className="glass-card p-6 text-center space-y-3 border-dashed border-2 border-primary/20 max-w-md mx-auto">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <Lock className="text-primary" size={20} />
      </div>
      <h3 className="text-base font-heading font-semibold">
        {l.singular} Limit Reached
      </h3>
      <p className="text-sm text-muted-foreground">
        You've used <span className="font-semibold text-foreground">{currentCount}</span> of{" "}
        <span className="font-semibold text-foreground">{limit === 0 ? "0" : limit}</span> {l.plural.toLowerCase()} on your{" "}
        <span className="capitalize">{plan.tier}</span> plan.
        {tierLabel && <> Upgrade to <span className="text-primary font-medium">{tierLabel}</span> for more.</>}
      </p>
      <Link to="/upgrade">
        <Button variant="default" size="sm" className="gap-2 mt-2">
          <Crown size={14} /> Upgrade <ArrowRight size={14} />
        </Button>
      </Link>
    </div>
  );
};

/** Inline indicator showing usage count */
export const LimitBadge = ({ resource }: { resource: "flow" | "landing_page" | "live_session" }) => {
  const { plan } = usePlan();
  const counts = useResourceCount();

  const countMap = {
    flow: counts.flows,
    landing_page: counts.landing_pages,
    live_session: counts.live_sessions,
  };
  const limitMap = {
    funnel: plan.limits.funnel_limit,
    landing_page: plan.limits.landing_page_limit,
    live_session: plan.limits.live_session_limit,
  };

  const current = countMap[resource];
  const limit = limitMap[resource];

  if (limit === null || limit === undefined) return null; // unlimited

  const isNearLimit = current >= limit - 1;

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${isNearLimit ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"}`}>
      {current}/{limit}
    </span>
  );
};
