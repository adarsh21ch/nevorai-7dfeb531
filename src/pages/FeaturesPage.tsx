import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { motion } from "framer-motion";
import {
  Video,
  ClipboardList,
  BarChart3,
  Route,
  MessageCircle,
  Eye,
  ShieldCheck,
  Lock,
} from "lucide-react";

const features = [
  {
    icon: Video,
    title: "Unskippable Video Player — They Watch Every Word",
    description:
      "A clean, distraction-free player with no recommendations, no ads and no sidebar. You decide whether the video can be paused, scrubbed or skipped — perfect for sales pitches, plan videos and course previews where every second matters.",
  },
  {
    icon: Eye,
    title: "Real-Time Activity Tracking — See Every Viewer",
    description:
      "Watch your activity feed light up the moment a prospect taps your link. See viewer name, city, watch percentage and exact drop-off point. Stop guessing who's interested — call the people who actually watched.",
  },
  {
    icon: Route,
    title: "Video Funnels — Multi-Step Sequences That Convert",
    description:
      "Turn one long video into a guided journey: intro → product walkthrough → pricing → call booking. Each step unlocks the next. Built for coaches and network marketers who already use a multi-touch sales process.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp Share with Rich Previews — Built for Indian Business",
    description:
      "Smart links with proper preview cards in WhatsApp, Telegram and Instagram. One tap and your prospect is watching — no app install, no friction. The way Indian business actually shares video.",
  },
  {
    icon: ShieldCheck,
    title: "Speaker Verification — Build Trust with Every Viewer",
    description:
      "Verified speaker badges and branded share pages tell prospects this video is genuinely from you. No more impersonation, no more confusion about whether the link is safe to open.",
  },
  {
    icon: Lock,
    title: "Access Code Protection — Premium Videos and Courses",
    description:
      "Lock any video behind an access code or one-time link so only invited prospects, paying students or VIP partners can watch. Combine with lead capture for a full pay-to-view course preview.",
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
              Built for Indian business owners who want more control, better lead capture and a cleaner viewer journey.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-6">
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
                <h2 className="text-base font-heading font-semibold mb-2">{f.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="glass-card p-8 mt-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-muted-foreground leading-relaxed">
              Nevorai is a complete video sharing platform built for Indian business owners — coaches, network marketers, insurance agents, real estate agents, course creators and online entrepreneurs. If you've been using YouTube, Vimeo or Google Drive to share sales videos with your prospects, you're losing leads every day. YouTube shows your competitors' videos in the sidebar. Vimeo costs ₹10,000+ a month. Google Drive has no tracking. Nevorai solves all three problems in one tool.
            </p>
          </motion.div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default FeaturesPage;
