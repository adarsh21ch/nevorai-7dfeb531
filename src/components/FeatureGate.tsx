import { ReactNode } from "react";
import { Lock, Sparkles } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { usePlanLimits } from "@/hooks/usePlanLimits";

/**
 * Admin-driven feature gate. Reads boolean flags directly from `plan_config`
 * via `usePlanLimits().features`. No hardcoded tier checks.
 *
 *   <FeatureGate feature="speakerProfile" requiredPlan="Basic">
 *     <SpeakerProfileSection />
 *   </FeatureGate>
 *
 * If the user's plan does NOT include the feature, the children render dimmed
 * and non-interactive with a lock badge in the corner. Tapping anywhere opens
 * a small popover linking to /upgrade — never a full-screen modal.
 */

type FeatureKey = keyof ReturnType<typeof usePlanLimits>["features"];

interface FeatureGateProps {
  feature: FeatureKey;
  requiredPlan?: "Basic" | "Pro";
  children: ReactNode;
  /** Optional custom fallback overrides the dimmed inline preview. */
  fallback?: ReactNode;
  /** Friendly label shown in the popover. */
  label?: string;
}

export const FeatureGate = ({
  feature,
  requiredPlan = "Basic",
  children,
  fallback,
  label,
}: FeatureGateProps) => {
  const { features } = usePlanLimits();
  const unlocked = features[feature];

  if (unlocked) return <>{children}</>;
  if (fallback) return <>{fallback}</>;

  const displayName = label || String(feature);

  return (
    <Popover>
      <div className="relative rounded-xl">
        <div aria-hidden className="pointer-events-none select-none opacity-50">
          {children}
        </div>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${displayName} is locked — tap to upgrade`}
            className="absolute inset-0 z-10 cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          />
        </PopoverTrigger>
        <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm backdrop-blur-sm">
          <Lock size={11} className="text-primary" />
          {requiredPlan}
        </div>
        <PopoverContent
          side="top"
          align="center"
          className="w-72 p-4 text-center"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Lock size={15} className="text-primary" />
          </div>
          <h4 className="font-heading text-sm font-semibold">Upgrade to unlock {displayName}</h4>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Available on the {requiredPlan} plan and above.
          </p>
          <Link to="/upgrade" className="mt-3 block">
            <Button variant="hero" size="sm" className="w-full gap-1.5">
              <Sparkles size={12} />
              Upgrade to {requiredPlan}
            </Button>
          </Link>
        </PopoverContent>
      </div>
    </Popover>
  );
};

/** Small "Pro" badge for inline buttons; reads admin-driven feature flags. */
export const FeatureLockBadge = ({ feature }: { feature: FeatureKey }) => {
  const { features } = usePlanLimits();
  if (features[feature]) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
      <Lock size={10} /> Locked
    </span>
  );
};
