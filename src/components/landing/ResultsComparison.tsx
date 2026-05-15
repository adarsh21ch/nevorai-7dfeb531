import { motion } from "framer-motion";
import { useLandingContent } from "@/hooks/useLandingContent";
import { AnimatedImage, type AnimationKind } from "./AnimatedImage";
import combinedRoutes from "@/assets/landing/section-8-combined-routes.png";

const SLOT_ID = "compare.combined";

export const ResultsComparison = () => {
  const { data } = useLandingContent();
  const row = data?.map?.[SLOT_ID];

  const heading = row?.title || "Same prospect. 2x the conversion.";
  const sub =
    row?.subtitle ||
    "Here's the side-by-side: same link, two journeys, two completely different outcomes.";
  const image = row?.image_url || combinedRoutes;
  const animation = (row?.animation as AnimationKind) || "fade-up";

  // Split bullets into two columns: first half = YouTube weaknesses, rest = Nevorai wins.
  // Admins can edit them in /admin/settings#landing.
  const bullets = row?.bullets ?? [
    "Viewers see 5+ suggested videos",
    "Comments distract them",
    "Autoplay confuses them",
    "Most leave before your pitch ends",
    "Can't skip, so they watch",
    "Zero distractions, stays focused",
    "Automatic lead capture",
    "Follow-up scheduled instantly",
  ];
  const half = Math.ceil(bullets.length / 2);
  const ytBullets = bullets.slice(0, half);
  const nvBullets = bullets.slice(half);

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
            {heading.includes("2x") ? (
              <>
                Same prospect.{" "}
                <span className="text-gradient-brand">2x the conversion.</span>
              </>
            ) : (
              heading
            )}
          </h2>
          <p className="text-hero-muted text-base md:text-lg">{sub}</p>
        </motion.div>

        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-8 backdrop-blur-md"
          >
            <AnimatedImage
              src={image}
              alt="YouTube Route vs Nevorai Route — side-by-side conversion flow"
              animation={animation}
              className="!aspect-[3/2]"
            />

            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 mt-8">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-destructive mb-3">
                  ❌ YouTube Route — 6–8%
                </p>
                <ul className="space-y-2">
                  {ytBullets.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-2 text-sm md:text-base text-white/85"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-destructive" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-brand-emerald mb-3">
                  ✅ Nevorai Route — 16–18%
                </p>
                <ul className="space-y-2">
                  {nvBullets.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-2 text-sm md:text-base text-white/85"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-brand-emerald" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
