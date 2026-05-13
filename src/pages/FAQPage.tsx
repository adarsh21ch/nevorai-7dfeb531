import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  { q: "Is there a free plan?", a: "Yes! You can start with our free plan — 2 funnels, 5 videos, and basic lead capture. Upgrade anytime when you're ready for more." },
  { q: "Who is Nevorai Flow for?", a: "Nevorai Flow is built for digital entrepreneurs, creators, coaches, educators, and anyone who uses video to grow their audience and business." },
  { q: "Can I use my own videos?", a: "Absolutely. Upload your own videos and turn them into structured funnels with lead capture, progress tracking, and guided steps." },
  { q: "Can I collect leads from viewers?", a: "Yes. You can capture name, phone, email, city, and even custom fields — before, during, or after video playback." },
  { q: "Can I track how much of a video someone watched?", a: "Yes! Viewer progress tracking shows exactly who watched, how far they got, and where they dropped off — so you can follow up smarter." },
  { q: "Can I create step-by-step funnels?", a: "Yes. Turn a single video into a multi-step guided journey with unlock rules, progression, and structured viewer flow." },
  { q: "Do I need technical skills to use it?", a: "Not at all. Nevorai Flow is designed for non-technical users. Upload, configure, share — it's that simple." },
  { q: "What if I need help?", a: "We offer priority WhatsApp support for paid plans. Free users can reach us via email. We're always here to help." },
];

const FAQPage = () => {
  return (
    <div data-theme="dark" className="min-h-screen bg-hero-bg text-white">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="container-app max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-3xl md:text-5xl font-heading font-bold mb-4">
              Frequently Asked <span className="gradient-text">Questions</span>
            </h1>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="glass-card px-6 border-white/[0.06]">
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
      <Footer />
    </div>
  );
};

export default FAQPage;
