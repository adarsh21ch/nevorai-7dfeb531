import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { FlowParticles } from "./FlowParticles";
import { AnimatedLogo3D } from "./AnimatedLogo3D";
import { CountUp } from "./CountUp";

export const HeroSection = () => {
  const ctaLabel = "Start Free →";

  return (
    <section className="hero-section relative min-h-screen flex items-center pt-20 pb-16 overflow-hidden bg-hero-bg">
      <FlowParticles />
      <div className="absolute inset-0 bg-gradient-hero-glow pointer-events-none" />

      <div className="container-app relative z-10">
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 bg-brand-emerald/10 border border-brand-emerald/30">
              <span className="w-2 h-2 rounded-full animate-pulse bg-brand-emerald" />
              <span className="text-xs font-medium text-brand-emerald">
                2,400+ network marketers converting more prospects
              </span>
            </div>
          </motion.div>

          <div className="relative mb-6">
            <div className="hero-glow" aria-hidden="true" />
            <h1 className="font-heading font-extrabold tracking-tight text-white relative leading-[1.1]">
              <motion.span
                className="block text-white text-4xl sm:text-5xl md:text-6xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                Same Effort.
              </motion.span>
              <motion.span
                className="block text-gradient-brand text-5xl sm:text-6xl md:text-7xl mt-1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                Twice the Conversions.
              </motion.span>
              <motion.span
                className="block text-2xl sm:text-3xl md:text-4xl mt-2 text-white/80"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
              >
                Zero Extra Work.
              </motion.span>
            </h1>
          </div>

          <motion.p
            className="text-base md:text-lg max-w-xl mx-auto mb-10 text-hero-muted"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
          >
            Most people share a YouTube link and <span className="text-white">hope</span> for the best.
            nFlow <span className="text-brand-emerald">controls</span> what your prospect sees,
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
                className="rounded-full text-white font-semibold border-0 bg-gradient-brand shadow-glow-brand-lg px-10 py-4 min-h-11"
              >
                {ctaLabel}
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button
                size="xl"
                variant="outline"
                className="rounded-full bg-transparent text-white border-white/20 px-8 py-4 min-h-11"
              >
                <Play size={18} />
                See How It Works
              </Button>
            </a>
          </motion.div>
          <motion.p
            className="text-xs -mt-10 mb-14 text-hero-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            Start free · No credit card · Upgrade when you grow
          </motion.p>

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
                    className="block text-gradient-brand font-extrabold text-3xl"
                  />
                  <div className="text-[11px] uppercase mt-1 text-hero-muted tracking-[1px]">
                    {stat.l}
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div className="hidden sm:block h-10 w-px bg-white/10" />
                )}
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};
