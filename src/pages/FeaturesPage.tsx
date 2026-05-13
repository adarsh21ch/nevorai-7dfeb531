import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { motion } from "framer-motion";
import { Video, ClipboardList, BarChart3, Route, MessageCircle, Eye, MousePointerClick } from "lucide-react";

const features = [
  {
    icon: Video,
    title: "Video Funnels",
    description: "Controlled playback, timed CTAs, and structured viewer flow — your video, your rules.",
  },
  {
    icon: ClipboardList,
    title: "Lead Capture",
    description: "Collect name, phone, email, city, and custom details directly from viewers.",
  },
  {
    icon: Eye,
    title: "Viewer Progress Tracking",
    description: "See how much viewers watched and exactly where they dropped off.",
  },
  {
    icon: Route,
    title: "Step-by-Step Journeys",
    description: "Turn one video into a guided progression with unlock rules and structured steps.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp Auto-message",
    description: "Automatically follow up with leads on WhatsApp the moment they submit.",
  },
  {
    icon: BarChart3,
    title: "Real-time Analytics",
    description: "Track engagement, conversions, and viewer behavior across all your funnels.",
  },
  {
    icon: MousePointerClick,
    title: "CTA / Action Control",
    description: "Guide viewers toward the next step intentionally with timed, locked, or conditional CTAs.",
  },
];

const FeaturesPage = () => {
  return (
    <div data-theme="dark" className="min-h-screen bg-hero-bg text-white">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="container-app max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h1 className="text-3xl md:text-5xl font-heading font-bold mb-4">
              Everything you need to turn videos into{" "}
              <span className="gradient-text">structured funnels.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built for digital entrepreneurs who want more control, better lead capture, and a cleaner viewer journey.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                className="glass-card p-6 group"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="text-primary" size={22} />
                </div>
                <h3 className="text-base font-heading font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default FeaturesPage;
