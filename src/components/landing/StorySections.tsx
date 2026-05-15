import { ProblemSolutionSection } from "./ProblemSolutionSection";
import { useLandingContent } from "@/hooks/useLandingContent";
import skipImg from "@/assets/landing/section-2-skip-button.jpg";
import noSkipImg from "@/assets/landing/section-3-no-skip.jpg";
import unknownImg from "@/assets/landing/section-4-unknown-viewers.jpg";
import realtimeImg from "@/assets/landing/section-5-realtime-activity.jpg";
import clutterImg from "@/assets/landing/section-6-youtube-clutter.jpg";
import cleanImg from "@/assets/landing/section-7-clean-player.jpg";
import type { AnimationKind } from "./AnimatedImage";

const FALLBACKS: Record<
  string,
  { image: string; tone: "problem" | "solution-green" | "solution-blue"; position: "left" | "right"; eyebrow: string; defaultAnim: AnimationKind; alt: string }
> = {
  "story.skip":     { image: skipImg,     tone: "problem",         position: "right", eyebrow: "The Problem", defaultAnim: "fade-up",   alt: "Cursor about to click skip on a video player" },
  "story.no-skip":  { image: noSkipImg,   tone: "solution-green",  position: "left",  eyebrow: "The Fix",     defaultAnim: "ken-burns", alt: "Clean player with full progress bar" },
  "story.unknown":  { image: unknownImg,  tone: "problem",         position: "right", eyebrow: "The Problem", defaultAnim: "fade-up",   alt: "Creator staring at a blank dashboard" },
  "story.realtime": { image: realtimeImg, tone: "solution-blue",   position: "left",  eyebrow: "The Fix",     defaultAnim: "parallax",  alt: "Real-time viewer activity dashboard" },
  "story.clutter":  { image: clutterImg,  tone: "problem",         position: "right", eyebrow: "The Problem", defaultAnim: "fade-up",   alt: "Cluttered YouTube interface" },
  "story.clean":    { image: cleanImg,    tone: "solution-green",  position: "left",  eyebrow: "The Fix",     defaultAnim: "zoom-hover",alt: "Minimal full-screen video player" },
};

const ORDER = ["story.skip", "story.no-skip", "story.unknown", "story.realtime", "story.clutter", "story.clean"] as const;

export const StorySections = () => {
  const { data } = useLandingContent();
  const map = data?.map ?? {};

  return (
    <>
      {ORDER.map((id) => {
        const fb = FALLBACKS[id];
        const row = map[id];
        const title = row?.title ?? "";
        const subtitle = row?.subtitle ?? "";
        const metric = row?.bullets?.[0];
        const image = row?.image_url || fb.image;
        const animation = (row?.animation as AnimationKind) || fb.defaultAnim;

        return (
          <ProblemSolutionSection
            key={id}
            tone={fb.tone}
            imagePosition={fb.position}
            eyebrow={fb.eyebrow}
            headline={title}
            subheading={subtitle}
            metric={metric}
            image={image}
            imageAlt={fb.alt}
            animation={animation}
          />
        );
      })}
    </>
  );
};
