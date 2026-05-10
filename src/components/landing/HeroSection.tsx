import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { FlowParticles } from "./FlowParticles";
import { AnimatedLogo3D } from "./AnimatedLogo3D";
import { CountUp } from "./CountUp";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const HeroSection = () => {
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
  const ctaLabel = isTrialEnabled ? `Start Free ${trialDays}-Day Trial →` : "Get Started →";
  return (
    <section className="hero-section relative min-h-screen flex items-center pt-20 pb-16 overflow-hidden" style={{ background: "#060C1A" }}>
      <FlowParticles />
      <div className="absolute inset-0 gradient-bg-subtle pointer-events-none" />

      <div className="container relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <AnimatedLogo3D />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
              style={{
                background: "rgba(0,200,150,0.1)",
                border: "1px solid rgba(0,200,150,0.3)",
              }}
            >
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#00C896" }} />
              <span className="text-xs font-medium" style={{ color: "#00C896" }}>
                2,400+ network marketers converting more prospects
              </span>
            </div>
          </motion.div>

          <div className="relative mb-6">
            <div className="hero-glow" aria-hidden="true" />
            <h1
              className="font-heading font-extrabold tracking-tight text-white relative"
              style={{ lineHeight: 1.1 }}
            >
              <motion.span
                className="hero-line-1 block text-white"
                style={{ fontSize: "clamp(36px, 6vw, 56px)" }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                Same Effort.
              </motion.span>
              <motion.span
                className="hero-line-2 hero-gradient-text block"
                style={{ fontSize: "clamp(40px, 7.2vw, 72px)", marginTop: "0.1em" }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                Twice the Conversions.
              </motion.span>
              <motion.span
                className="hero-line-3 block"
                style={{ fontSize: "clamp(24px, 3.5vw, 36px)", color: "rgba(255,255,255,0.78)", marginTop: "0.2em" }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
              >
                Zero Extra Work.
              </motion.span>
            </h1>
          </div>

          <motion.p
            className="hero-sub text-base md:text-lg max-w-xl mx-auto mb-10"
            style={{ color: "#8896B3" }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
          >
            Most people share a YouTube link and <span className="text-white">hope</span> for the best.
            nFlow <span style={{ color: "#00C896" }}>controls</span> what your prospect sees,
            keeps them focused, captures their details, and follows up — <span className="text-white">automatically</span>.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Link to="/auth?tab=signup">
              <Button
                size="xl"
                className="rounded-full text-white font-semibold border-0"
                style={{
                  background: "linear-gradient(135deg, #00C896, #0066FF)",
                  boxShadow: "0 0 30px rgba(0,200,150,0.4)",
                  padding: "16px 40px",
                }}
              >
                {ctaLabel}
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button
                size="xl"
                variant="outline"
                className="rounded-full bg-transparent text-white"
                style={{ border: "1px solid rgba(255,255,255,0.18)", padding: "16px 32px" }}
              >
                <Play size={18} />
                See How It Works
              </Button>
            </a>
          </motion.div>
          {isTrialEnabled && (
            <motion.p
              className="text-xs -mt-10 mb-14"
              style={{ color: "#8896B3" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              {trialDays} days free · No credit card · Cancel anytime
            </motion.p>
          )}

          {/* Live stats */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-6 sm:gap-10"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            {[
              { v: 2400, s: "+", l: "Active users" },
              { v: 2, s: "x", l: "Average conversion lift" },
              { v: 4.2, s: "x", l: "More leads captured", decimals: 1 },
            ].map((stat, i, arr) => (
              <div key={stat.l} className="flex items-center gap-6 sm:gap-10">
                <div className="text-center">
                  <CountUp
                    to={stat.v}
                    suffix={stat.s}
                    decimals={stat.decimals || 0}
                    className="hero-stat-number block hero-gradient-text font-extrabold text-3xl"
                  />
                  <div
                    className="text-[11px] uppercase mt-1"
                    style={{ color: "#8896B3", letterSpacing: "1px" }}
                  >
                    {stat.l}
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div className="hidden sm:block h-10 w-px" style={{ background: "rgba(255,255,255,0.1)" }} />
                )}
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};
