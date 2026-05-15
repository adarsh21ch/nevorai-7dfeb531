import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AnimatedImage, type AnimationKind } from "./AnimatedImage";

export type Tone = "problem" | "solution-green" | "solution-blue";

interface Props {
  tone: Tone;
  imagePosition: "left" | "right";
  eyebrow?: string;
  headline: React.ReactNode;
  subheading: string;
  metric?: string;
  image: string;
  imageAlt: string;
  animation?: AnimationKind;
}

const toneStyles: Record<Tone, { bg: string; eyebrow: string; metric: string; ring: string }> = {
  problem: {
    bg: "bg-hero-bg",
    eyebrow: "text-destructive border-destructive/30 bg-destructive/10",
    metric: "text-destructive",
    ring: "ring-destructive/20",
  },
  "solution-green": {
    bg: "bg-[oklch(0.18_0.04_165_/_0.4)]",
    eyebrow: "text-brand-emerald border-brand-emerald/30 bg-brand-emerald/10",
    metric: "text-brand-emerald",
    ring: "ring-brand-emerald/20",
  },
  "solution-blue": {
    bg: "bg-[oklch(0.20_0.06_240_/_0.4)]",
    eyebrow: "text-brand-blue border-brand-blue/30 bg-brand-blue/10",
    metric: "text-brand-blue",
    ring: "ring-brand-blue/20",
  },
};

export const ProblemSolutionSection = ({
  tone,
  imagePosition,
  eyebrow,
  headline,
  subheading,
  metric,
  image,
  imageAlt,
  imageWidth = 1024,
  imageHeight = 768,
}: Props) => {
  const s = toneStyles[tone];
  const imageFirst = imagePosition === "left";
  const xText = imageFirst ? 40 : -40;
  const xImage = imageFirst ? -40 : 40;

  return (
    <section className={cn("relative py-20 sm:py-28 overflow-hidden", s.bg)}>
      <div className="container-app relative z-10">
        <div
          className={cn(
            "grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center",
          )}
        >
          {/* Text */}
          <motion.div
            initial={{ opacity: 0, x: xText }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={cn(
              "order-2",
              imageFirst ? "md:order-2" : "md:order-1",
            )}
          >
            {eyebrow && (
              <span
                className={cn(
                  "inline-block text-[11px] font-bold tracking-widest uppercase px-3 py-1 rounded-full border mb-5",
                  s.eyebrow,
                )}
              >
                {eyebrow}
              </span>
            )}
            <h2 className="font-heading font-extrabold text-white text-3xl md:text-4xl lg:text-5xl leading-[1.1] mb-5">
              {headline}
            </h2>
            <p className="text-base md:text-lg text-hero-muted leading-relaxed max-w-xl">
              {subheading}
            </p>
            {metric && (
              <p className={cn("mt-6 text-sm md:text-base font-semibold", s.metric)}>
                {metric}
              </p>
            )}
          </motion.div>

          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: xImage, scale: 0.96 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className={cn(
              "order-1",
              imageFirst ? "md:order-1" : "md:order-2",
            )}
          >
            <div
              className={cn(
                "rounded-2xl overflow-hidden ring-1 shadow-elegant bg-black/30 backdrop-blur-sm",
                s.ring,
              )}
            >
              <img
                src={image}
                alt={imageAlt}
                width={imageWidth}
                height={imageHeight}
                loading="lazy"
                className="w-full h-auto block"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
