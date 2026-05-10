import { motion } from "framer-motion";
import { Star } from "lucide-react";

const items = [
  {
    name: "Priya S.",
    role: "Network Marketing Leader, Pune",
    quote:
      "I used to send YouTube links and follow up manually for days. With nFlow, my prospect watches the full video, their number is captured automatically, and I get a WhatsApp lead instantly. My conversion went from 6% to almost 20%.",
  },
  {
    name: "Rahul M.",
    role: "Direct Sales Entrepreneur, Mumbai",
    quote:
      "The control over what prospects can skip changed everything. They actually watch the important parts now. My team started using it too — everyone noticed the difference.",
  },
  {
    name: "Divya K.",
    role: "Team Leader, Ahmedabad",
    quote:
      "The analytics alone are worth it. I know exactly which prospect watched till the end and who dropped off. I follow up with those who watched 80%+ — they convert almost every time.",
  },
];

export const Testimonials = () => {
  return (
    <section className="py-24 relative">
      <div className="container max-w-6xl">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-3">
            What Our <span className="gradient-text">Users Say</span>
          </h2>
          <p style={{ color: "#8896B3" }}>
            Network marketers and entrepreneurs using nFlow.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5">
          {items.map((t, i) => (
            <motion.div
              key={t.name}
              className="rounded-2xl p-6 flex flex-col"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="text-4xl gradient-text leading-none mb-2">"</div>
              <p className="text-sm italic flex-1" style={{ color: "#C8D0E0" }}>
                {t.quote}
              </p>
              <div className="flex gap-0.5 mt-4">
                {Array.from({ length: 5 }).map((_, k) => (
                  <Star
                    key={k}
                    size={14}
                    fill="url(#starGrad)"
                    stroke="url(#starGrad)"
                  />
                ))}
              </div>
              <div className="mt-3">
                <div className="text-sm font-semibold text-white">{t.name}</div>
                <div className="text-xs" style={{ color: "#8896B3" }}>{t.role}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <svg width="0" height="0" className="absolute">
          <defs>
            <linearGradient id="starGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00C896" />
              <stop offset="100%" stopColor="#0066FF" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </section>
  );
};
