import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";

const chips = [
  "No credit card needed",
  "1 GB free forever",
  "Setup in 2 minutes",
];

export const FinalCTA = () => {
  return (
    <section className="py-20 sm:py-32 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(249,115,22,0.10) 0%, transparent 60%)" }}
      />
      <div className="container-app relative z-10">
        <motion.div
          className="text-center max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="font-heading font-extrabold text-white text-3xl md:text-5xl leading-[1.1] mb-4">
            Ready to convert twice as much?
          </h2>
          <p className="text-base md:text-lg text-white/90 mb-8">
            Same effort. Twice the conversion. Start free in 2 minutes.
          </p>

          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8">
            {chips.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-xs sm:text-sm font-medium text-white backdrop-blur-sm"
              >
                <Check className="h-3.5 w-3.5" />
                {c}
              </span>
            ))}
          </div>

          <Link to="/auth?tab=signup" className="block sm:inline-block">
            <button className="btn-saffron-premium w-full sm:w-auto text-base sm:text-lg">
              Start Free →
            </button>
          </Link>

          <div className="mt-5 text-sm text-white/80">
            Or{" "}
            <Link
              to="/contact"
              className="underline underline-offset-4 font-semibold text-white hover:text-white/90"
            >
              book a 5-minute walkthrough →
            </Link>
          </div>

          <p className="mt-8 text-xs text-white/70">
            Built for creators who sell. Made in India 🇮🇳
          </p>
        </motion.div>
      </div>
    </section>
  );
};
