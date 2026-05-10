import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const FinalCTA = () => {
  const { data: trial } = useQuery({
    queryKey: ["app-settings-trial-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings" as any)
        .select("key, value")
        .in("key", ["trial_enabled", "trial_days"]);
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => { map[s.key] = s.value; });
      return {
        isTrialEnabled: map.trial_enabled === "true",
        trialDays: parseInt(map.trial_days || "7", 10),
      };
    },
    staleTime: 60_000,
  });
  const isTrialEnabled = trial?.isTrialEnabled ?? false;
  const trialDays = trial?.trialDays ?? 7;

  const subtitle = isTrialEnabled
    ? `${trialDays} days free. No credit card. Set up in 2 minutes.`
    : "No credit card required. Set up in 2 minutes.";
  const ctaLabel = isTrialEnabled ? `Start ${trialDays}-Day Free Trial →` : "Get Started →";

  return (
    <section className="py-20 sm:py-24 relative overflow-hidden bg-gradient-brand">
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at top, rgba(255,255,255,0.15) 0%, transparent 60%)" }}
      />
      <div className="container-app relative z-10">
        <motion.div
          className="text-center max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="heading-display font-heading font-extrabold mb-4 text-white">
            Start Converting More Prospects Today
          </h2>
          <p className="mb-8 text-base md:text-lg text-white/90">{subtitle}</p>
          <Link to="/auth?tab=signup">
            <Button
              size="xl"
              className="rounded-full font-bold border-0 hover:scale-105 transition-transform bg-white text-base sm:text-lg px-10 sm:px-14 py-4 min-h-11 shadow-elegant"
            >
              <span className="text-gradient-brand">{ctaLabel}</span>
            </Button>
          </Link>
          <p className="mt-5 text-xs text-white/80">
            Join 2,400+ network marketers already converting more prospects.
          </p>
        </motion.div>
      </div>
    </section>
  );
};
