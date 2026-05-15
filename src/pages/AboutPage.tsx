import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { motion } from "framer-motion";
import { Lightbulb, Target, Users, Heart } from "lucide-react";

const AboutPage = () => {
  return (
    <div data-theme="dark" className="min-h-screen bg-hero-bg text-white">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="container-app max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h1 className="text-3xl md:text-5xl font-heading font-bold mb-4">
              About Nevorai —{" "}
              <span className="gradient-text">the smarter way to share business videos.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built in Indore, Madhya Pradesh, for Indian coaches, network marketers, insurance agents, real estate agents and entrepreneurs.
            </p>
          </motion.div>

          <div className="space-y-12">
            <motion.div
              className="glass-card p-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Lightbulb className="text-primary" size={20} />
                </div>
                <h2 className="text-xl font-heading font-semibold">Our story</h2>
              </div>
              <div className="text-muted-foreground leading-relaxed space-y-4">
                <p>
                  I'm Adarsh, founder of Nevorai. I built this product because every time I shared a sales video on WhatsApp, I had no idea who actually watched it.
                </p>
                <p>
                  YouTube wasn't the answer — too many distractions, no real tracking, and my prospect would watch 30 seconds before clicking into a competitor's reel. Vimeo was too expensive for what I needed. Google Drive had no analytics at all.
                </p>
                <p>
                  So I built Nevorai for myself first, then for friends in the network marketing community across India. Today we're helping coaches, agents and entrepreneurs share videos that actually get watched — and convert.
                </p>
              </div>
            </motion.div>

            <motion.div
              className="glass-card p-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="text-primary" size={20} />
                </div>
                <h2 className="text-xl font-heading font-semibold">Why "Nevorai"</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Nevorai is built in India for Indian businesses. We believe Indian entrepreneurs deserve world-class software at Indian prices — built with our context in mind. UPI payments. WhatsApp integration. ₹ pricing. Made in Indore, Madhya Pradesh, used everywhere.
              </p>
            </motion.div>

            <motion.div
              className="glass-card p-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="text-primary" size={20} />
                </div>
                <h2 className="text-xl font-heading font-semibold">Who it's for</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Network marketers and MLM leaders sharing plan videos. Insurance agents and financial advisors qualifying prospects. Online coaches and course creators converting students. Real estate agents showing properties. Anyone in India who uses video to win business.
              </p>
            </motion.div>

            <motion.div
              className="glass-card p-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Heart className="text-primary" size={20} />
                </div>
                <h2 className="text-xl font-heading font-semibold">Our mission</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed text-lg font-medium">
                "Give every business owner in India a real way to know who's interested in what they're selling — before the customer ever has to say a word."
              </p>
            </motion.div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default AboutPage;
