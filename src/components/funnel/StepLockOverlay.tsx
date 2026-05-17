import { Lock, Sparkles } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  featureName: string;
  requiredPlan: "Basic" | "Pro";
  priceLabel: string;
}

/**
 * Inline lock: renders children dimmed and non-interactive, with a small
 * lock badge in the corner. Tapping anywhere on the locked section opens a
 * compact popover linking to the upgrade page — never a full-screen modal.
 * This lets users keep building the rest of the funnel without being blocked.
 */
export const StepLockOverlay = ({ children, featureName, requiredPlan, priceLabel }: Props) => {
  return (
    <Popover>
      <div className="relative rounded-xl">
        {/* Dimmed, non-interactive content */}
        <div aria-hidden className="pointer-events-none select-none opacity-50">
          {children}
        </div>

        {/* Transparent click-catcher that triggers the popover */}
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${featureName} is locked — tap to upgrade`}
            className="absolute inset-0 z-10 cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          />
        </PopoverTrigger>

        {/* Corner lock badge */}
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
          <h4 className="font-heading text-sm font-semibold">{featureName}</h4>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Available on the {requiredPlan} plan and above. Upgrade to unlock — your other steps stay editable.
          </p>
          <Link to="/upgrade" className="mt-3 block">
            <Button variant="hero" size="sm" className="w-full gap-1.5">
              <Sparkles size={12} />
              Upgrade — {priceLabel}
            </Button>
          </Link>
        </PopoverContent>
      </div>
    </Popover>
  );
};
