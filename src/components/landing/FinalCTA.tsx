import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";

export const FinalCTA = () => {
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
          <p className="mb-8 text-base md:text-lg text-white/90">
            Start free. No credit card. Upgrade only when you need more capacity.
          </p>
          <Link to="/auth?tab=signup">
            <Button
              size="xl"
              className="rounded-full font-bold border-0 hover:scale-105 transition-transform bg-white text-base sm:text-lg px-10 sm:px-14 py-4 min-h-11 shadow-elegant"
            >
              <span className="text-gradient-brand">Start Free →</span>
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
