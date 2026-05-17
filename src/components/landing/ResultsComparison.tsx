import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLandingContent } from "@/hooks/useLandingContent";
import { AnimatedImage, type AnimationKind } from "./AnimatedImage";
import youtubeFlow from "@/assets/landing/section-8-youtube-flow.jpg";
import nevoraiFlow from "@/assets/landing/section-8-nevorai-flow.jpg";

type RouteKey = "youtube" | "nevorai";

export const ResultsComparison = () => {
  const { data } = useLandingContent();
  const [active, setActive] = useState<RouteKey>("youtube");

  const yt = data?.map?.["compare.youtube"];
  const nv = data?.map?.["compare.nevorai"];

  const routes = {
    youtube: {
      title: yt?.title || "YouTube Route → 6–8% conversion",
      subtitle:
        yt?.subtitle ||
        "Share link → opens YouTube → distractions → leaves without buying.",
      image: yt?.image_url || youtubeFlow,
      animation: (yt?.animation as AnimationKind) || "fade-up",
      bullets:
        yt?.bullets?.length
          ? yt.bullets
          : [
              "Viewers see 5+ suggested videos",
              "Comments distract them",
              "Autoplay confuses them",
              "Most leave before your pitch ends",
            ],
    },
    nevorai: {
      title: nv?.title || "Nevorai Route → 16–18% conversion",
      subtitle:
        nv?.subtitle ||
        "Share link → opens Nevorai → watches full video → captures lead → converts.",
      image: nv?.image_url || nevoraiFlow,
      animation: (nv?.animation as AnimationKind) || "ken-burns",
      bullets:
        nv?.bullets?.length
          ? nv.bullets
          : [
              "Can't skip, so they watch",
              "Zero distractions, stays focused",
              "Automatic lead capture",
              "Follow-up scheduled instantly",
            ],
    },
  } as const;

  const current = routes[active];
  const isNev = active === "nevorai";

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
            Here's the side-by-side: same link, two journeys, two completely
            different outcomes.
          </p>
        </motion.div>

        <div className="max-w-5xl mx-auto">
          {/* Toggle */}
          <div className="flex justify-center mb-6">
            <div
              role="tablist"
              aria-label="Compare routes"
              className="inline-flex p-1 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md"
            >
              {(["youtube", "nevorai"] as RouteKey[]).map((key) => {
                const isActive = active === key;
                const label =
                  key === "youtube" ? "YouTube Route" : "Nevorai Route";
                return (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActive(key)}
                    className={[
                      "relative px-4 sm:px-6 py-2 text-xs sm:text-sm font-semibold rounded-full transition-colors",
                      isActive
                        ? key === "youtube"
                          ? "text-white"
                          : "text-white"
                        : "text-white/60 hover:text-white/90",
                    ].join(" ")}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="routePillBg"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        className={[
                          "absolute inset-0 rounded-full",
                          key === "youtube"
                            ? "bg-destructive/90 shadow-[0_6px_20px_-6px_hsl(var(--destructive)/0.6)]"
                            : "bg-gradient-brand shadow-glow-brand-lg",
                        ].join(" ")}
                      />
                    )}
                    <span className="relative">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className={[
              "rounded-2xl border p-4 md:p-8 backdrop-blur-md transition-colors duration-500",
              isNev
                ? "border-brand-emerald/30 bg-brand-emerald/[0.04]"
                : "border-destructive/30 bg-destructive/[0.04]",
            ].join(" ")}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <p
                  className={[
                    "text-[11px] font-bold uppercase tracking-widest mb-3",
                    isNev ? "text-brand-emerald" : "text-destructive",
                  ].join(" ")}
                >
                  {isNev ? "✅ " : "❌ "}
                  {current.title}
                </p>
                <p className="text-white/80 text-sm md:text-base mb-5">
                  {current.subtitle}
                </p>

                <AnimatedImage
                  src={current.image}
                  alt={current.title}
                  animation={current.animation}
                  className="!aspect-[3/2]"
                />

                <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3 mt-6">
                  {current.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-2 text-sm md:text-base text-white/85"
                    >
                      <span
                        className={[
                          "mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
                          isNev ? "bg-brand-emerald" : "bg-destructive",
                        ].join(" ")}
                      />
                      {b}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
