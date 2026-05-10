import { motion } from "framer-motion";
import { Upload, Share2, UserCheck } from "lucide-react";

const steps = [
  {
    icon: Upload,
    title: "Add Your Video",
    description: "Upload your product demo, testimonial, or opportunity video in seconds.",
  },
  {
    icon: Share2,
    title: "Set the Viewing Flow",
    description: "Control how your prospect watches — add steps, restrict skipping, and guide them through a structured journey.",
  },
  {
    icon: UserCheck,
    title: "Track and Follow Up",
    description: "See who watched, how much they watched, and follow up at exactly the right time to close better.",
  },
];

export const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 relative">
      <div className="container">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Three simple steps to turn your videos into a controlled follow-up system.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              className="glass-card p-8 text-center relative group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                {i + 1}
              </div>
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary/20 transition-colors">
                <step.icon className="text-primary" size={24} />
              </div>
              <h3 className="text-lg font-heading font-semibold mb-3">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
