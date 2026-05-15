import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLandingContent } from "@/hooks/useLandingContent";
import { AnimatedImage, type AnimationKind } from "./AnimatedImage";
import youtubeFlow from "@/assets/landing/section-8-youtube-flow.jpg";
import nevoraiFlow from "@/assets/landing/section-8-nevorai-flow.jpg";

type Mode = "youtube" | "nevorai";

const FALLBACKS: Record<Mode, { id: string; image: string; defaultAnim: AnimationKind; accent: string }> = {
  youtube: { id: "compare.youtube", image: youtubeFlow, defaultAnim: "fade-up",   accent: "text-destructive" },
  nevorai: { id: "compare.nevorai", image: nevoraiFlow, defaultAnim: "ken-burns", accent: "text-brand-emerald" },
};

export const ResultsComparison = () => {
  const [mode, setMode] = useState<Mode>("nevorai");
  const { data } = useLandingContent();
  const map = data?.map ?? {};

  const fb = FALLBACKS[mode];
  const row = map[fb.id];
  const header = row?.title || (mode === "youtube" ? "YouTube Route → 6–8% conversion" : "Nevorai Route → 16–18% conversion");
  const sub = row?.subtitle || "";
  const bullets = row?.bullets?.length ? row.bullets : [];
  const image = row?.image_url || fb.image;
  const animation = (row?.animation as AnimationKind) || fb.defaultAnim;

  return (
    <section className="py-20 sm:py-28 relative overflow-hidden bg-hero-bg">
      <div className="container-app relative z-10">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="font-heading font-extrabold text-white text-3xl md:text-5xl leading-[1.1] mb-4">
            Same prospect.{" "}
            <span className="text-gradient-brand">2x the conversion.</span>
          </h2>
          <p className="text-hero-muted text-base md:text-lg">
            Here's what changes when you use Nevorai instead of YouTube:
          </p>
        </motion.div>

        <div className="sticky top-20 z-20 flex justify-center mb-8">
          <div role="tablist" className="inline-flex p-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            {(["youtube", "nevorai"] as Mode[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "px-5 sm:px-7 py-2.5 rounded-full text-sm font-semibold transition-all",
                  mode === m
                    ? m === "nevorai"
                      ? "bg-gradient-brand text-white shadow-glow-brand"
                      : "bg-destructive/90 text-white"
                    : "text-white/70 hover:text-white",
                )}
              >
                {m === "youtube" ? "📊 YouTube Route" : "✅ Nevorai Route"}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-10 backdrop-blur-md"
            >
              <h3 className={cn("font-heading font-bold text-xl md:text-2xl mb-2", fb.accent)}>
                {header}
              </h3>
              {sub && <p className="text-hero-muted text-sm md:text-base mb-6">{sub}</p>}

              <div className="mb-8">
                <AnimatedImage
                  src={image}
                  alt={`${mode} conversion flow`}
                  animation={animation}
                />
              </div>

              {bullets.length > 0 && (
                <ul className="grid sm:grid-cols-2 gap-3">
                  {bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm md:text-base text-white/85">
                      <span className={cn("mt-1 h-1.5 w-1.5 rounded-full shrink-0", mode === "nevorai" ? "bg-brand-emerald" : "bg-destructive")} />
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};
