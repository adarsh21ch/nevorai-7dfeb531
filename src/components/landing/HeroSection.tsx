import { Link } from "@/lib/router-compat";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { AnimatedLogo3D } from "./AnimatedLogo3D";
import { HeroMarquee } from "./HeroMarquee";

export const HeroSection = () => {
  return (
    <section
      className="hero-section relative min-h-screen flex items-center pt-20 pb-16 overflow-hidden"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      <div className="container-app relative z-10">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-8 hero-logo-halo"
            style={{ color: "var(--logo-color)" }}
          >
            <AnimatedLogo3D />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-6 badge-pill badge-pill-accent"
          >
            Built for Creators Who Sell
          </motion.div>

          <div className="relative mb-6">
            <h1
              className="font-heading font-bold leading-[0.95]"
              style={{
                color: "var(--text-primary)",
                letterSpacing: "-0.04em",
              }}
            >
              <motion.span
                className="block text-5xl sm:text-6xl md:text-8xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                Same effort.
              </motion.span>
              <motion.span
                className="block text-5xl sm:text-6xl md:text-8xl italic"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                style={{ fontWeight: 700 }}
              >
                Twice the <span className="accent-saffron-underline">conversion</span>.
              </motion.span>
            </h1>
          </div>

          <motion.p
            className="text-base md:text-xl max-w-2xl mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            style={{ color: "var(--text-secondary)" }}
          >
            The video platform built for{" "}
            <span className="accent-saffron" style={{ fontWeight: 600 }}>creators who sell</span>.
            Skip-protection, viewer tracking, and conversion insights — on every video you share.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            <Link to="/auth?tab=signup" className="w-full sm:w-auto">
              <button className="btn-saffron-premium w-full sm:w-auto">
                Start Free →
              </button>
            </Link>
            <a
              href="#how-it-works"
              className="btn-glass-premium w-full sm:w-auto inline-flex items-center justify-center gap-2"
            >
              <Play size={18} />
              See How It Works
            </a>
          </motion.div>

          <motion.p
            className="-mt-8 mb-14 text-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.75 }}
            style={{ color: "var(--text-tertiary)" }}
          >
            No credit card. 1 GB free forever. Setup in 2 minutes.
          </motion.p>

          <motion.div
            className="w-full"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <HeroMarquee />
          </motion.div>

          <motion.p
            className="mt-8 text-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            style={{ color: "var(--text-tertiary)" }}
          >
            🇮🇳 Made in India · Free forever for 1 GB
          </motion.p>
        </div>
      </div>
    </section>
  );
};
