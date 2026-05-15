import { Link } from "@/lib/router-compat";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { FlowParticles } from "./FlowParticles";
import { AnimatedLogo3D } from "./AnimatedLogo3D";
import { CountUp } from "./CountUp";

export const HeroSection = () => {
  return (
    <section className="hero-section relative min-h-screen flex items-center pt-20 pb-16 overflow-hidden bg-hero-bg">
      <FlowParticles />
      <div className="absolute inset-0 bg-gradient-hero-glow pointer-events-none" />

      <div className="container-app relative z-10">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
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
            className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold tracking-wide uppercase text-brand-emerald"
          >
            <span className="flex h-2 w-2 rounded-full bg-brand-emerald animate-pulse" />
            The YouTube Alternative for Business
          </motion.div>

          <div className="relative mb-6">
            <div className="hero-glow" aria-hidden="true" />
            <h1 className="font-heading font-extrabold tracking-tight text-white relative leading-[1.1]">
              <motion.span
                className="block text-4xl sm:text-5xl md:text-7xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                Stop losing leads to
              </motion.span>
              <motion.span
                className="block text-gradient-brand text-4xl sm:text-5xl md:text-7xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                YouTube distractions.
              </motion.span>
            </h1>
          </div>

          <motion.p
            className="text-base md:text-xl max-w-2xl mb-10 text-hero-muted leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            Host unskippable sales videos that actually convert. Built for{" "}
            <span className="text-white font-medium">Indian coaches & entrepreneurs</span>{" "}
            who value their prospects' attention.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            <Link to="/auth?tab=signup" className="relative group">
              <div className="absolute -inset-1 rounded-full bg-gradient-brand blur opacity-40 group-hover:opacity-70 transition duration-300" />
              <button className="relative px-10 py-4 rounded-full bg-gradient-brand text-white font-bold shadow-glow-brand-lg hover:scale-[1.02] transition-transform">
                Start Free →
              </button>
            </Link>
            <a
              href="#how-it-works"
              className="px-8 py-4 rounded-full font-semibold text-white/80 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <Play size={18} />
              See How It Works
            </a>
          </motion.div>

          <motion.div
            className="grid grid-cols-3 gap-6 md:gap-16 py-6 px-6 md:px-10 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-md"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            {[
              { v: 2400, s: "+", l: "Active users" },
              { v: 2, s: "x", l: "Conversions" },
              { v: 4.2, s: "x", l: "More leads", decimals: 1 },
            ].map((stat) => (
              <div key={stat.l} className="text-center">
                <CountUp
                  to={stat.v}
                  suffix={stat.s}
                  decimals={stat.decimals || 0}
                  className="block text-white font-extrabold text-2xl md:text-3xl"
                />
                <div className="text-[10px] md:text-xs uppercase mt-1 text-hero-muted tracking-widest font-bold">
                  {stat.l}
                </div>
              </div>
            ))}
          </motion.div>

          <motion.p
            className="mt-8 text-xs text-hero-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
          >
            🇮🇳 Made in India · Free forever for 1 GB
          </motion.p>
        </div>
      </div>
    </section>
  );
};
