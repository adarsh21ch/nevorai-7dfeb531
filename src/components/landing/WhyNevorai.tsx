import { motion } from "framer-motion";
import { X, Check } from "lucide-react";

const rows = [
  {
    yt: "Viewers get distracted with recommendations, comments, and other videos",
    nf: "Distraction-free experience — no recommendations, no noise, full focus",
  },
  {
    yt: "Viewers can skip content and miss key information",
    nf: "Control watching — restrict skipping, ensure content is consumed properly",
  },
  {
    yt: "No visibility into who watched, how much, or where they dropped off",
    nf: "Track viewer behavior — know exactly who watched, how far, and engagement level",
  },
  {
    yt: "Videos are random — no structured journey or conversion flow",
    nf: "Turn videos into structured funnels with steps, actions, and progression",
  },
  {
    yt: "No built-in lead capture or follow-up system",
    nf: "Capture leads directly — collect name, phone, email, and more",
  },
  {
    yt: "Views don't equal business results",
    nf: "Built for conversion — guide users toward action",
  },
];

export const WhyNevorai = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 gradient-bg-subtle" />

      <div className="container relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-destructive/20 bg-destructive/5 mb-6">
            <span className="text-xs font-medium text-destructive">
              Stop sending random video links
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
            Why Not Just Use <span className="gradient-text">YouTube?</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-base md:text-lg leading-relaxed">
            Because YouTube gives you views — not control, follow-up, or a guided conversion path.
          </p>
        </motion.div>

        {/* Column Headers */}
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 gap-3 md:gap-5 mb-4">
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-center">
              <span className="font-heading font-bold text-sm md:text-base text-destructive">
                ❌ YouTube
              </span>
            </div>
            <div className="rounded-xl bg-success/10 border border-success/20 px-4 py-3 text-center">
              <span className="font-heading font-bold text-sm md:text-base text-success">
                ✅ nFlow
              </span>
            </div>
          </div>

          {/* Rows */}
          <div className="flex flex-col gap-3">
            {rows.map((row, i) => (
              <motion.div
                key={i}
                className="grid grid-cols-2 gap-3 md:gap-5"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
              >
                {/* YouTube side */}
                <div className="rounded-xl border border-destructive/10 bg-destructive/[0.04] p-4 flex items-start gap-3">
                  <X
                    size={18}
                    className="text-destructive shrink-0 mt-0.5"
                  />
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                    {row.yt}
                  </p>
                </div>

                {/* Nevorai side */}
                <div className="rounded-xl border border-success/15 bg-success/[0.06] p-4 flex items-start gap-3">
                  <Check
                    size={18}
                    className="text-success shrink-0 mt-0.5"
                  />
                  <p className="text-xs md:text-sm text-foreground leading-relaxed font-medium">
                    {row.nf}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom CTA reinforcement */}
        <motion.div
          className="text-center mt-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="text-lg md:text-xl font-heading font-semibold text-foreground">
            YouTube gives views.{" "}
            <span className="gradient-text">
              nFlow gives control + data + conversion.
            </span>
          </p>
        </motion.div>
      </div>
    </section>
  );
};
