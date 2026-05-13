import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "What is Nevorai Flow?",
    a: "Nevorai Flow is a video-based follow-up system that helps you control how prospects watch, understand, and respond to your message.",
  },
  {
    q: "Do I need technical skills?",
    a: "No. You can create and manage your funnels easily without any technical knowledge.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. You can explore shared funnels and public content for free.",
  },
  {
    q: "Who is Nevorai Flow for?",
    a: "Built for entrepreneurs, creators, and teams who want better follow-up and higher conversion.",
  },
  {
    q: "Can I track how much of a video someone watched?",
    a: "Yes. You can see engagement, watch time, and exact drop-off points for every prospect.",
  },
  {
    q: "Can I create step-by-step funnels?",
    a: "Yes. You can guide viewers through a structured journey with actions and clear progression.",
  },
  {
    q: "Can my team use this?",
    a: "Yes. You can share funnels and build systems your entire team can use.",
  },
  {
    q: "What if I need help?",
    a: "Support is available to help you set up and use the system effectively.",
  },
];

export const FAQSection = () => {
  return (
    <section id="faq" className="py-24">
      <div className="container-app max-w-3xl">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
            Frequently Asked <span className="text-gradient-brand">Questions</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="glass-card px-6 border-white/[0.06]"
              >
                <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline py-4">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};
