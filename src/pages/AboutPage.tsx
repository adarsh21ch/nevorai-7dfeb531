import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { motion } from "framer-motion";
import { Users, Lightbulb, Target, Heart } from "lucide-react";

const AboutPage = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="container-app max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h1 className="text-3xl md:text-5xl font-heading font-bold mb-4">
              Built to turn video attention into{" "}
              <span className="gradient-text">real business outcomes.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              nFlow by Nevorai helps digital entrepreneurs turn ordinary videos into structured funnels, track engagement, capture leads, and guide viewers step by step.
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
                <h2 className="text-xl font-heading font-semibold">What is nFlow by Nevorai?</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                nFlow by Nevorai is a smart video funnel platform that helps creators and digital entrepreneurs turn random video sharing into structured journeys that generate leads, attention, and action. Instead of sending viewers to platforms full of distractions, you give them a focused, trackable experience.
              </p>
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
                <h2 className="text-xl font-heading font-semibold">Why we built it</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Most people share videos on platforms where viewers get distracted, skip content, or disappear without taking action. There was no simple tool to turn a video into a structured experience with lead capture, progress tracking, and guided next steps. nFlow by Nevorai was built to solve exactly that.
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
                nFlow by Nevorai is designed for digital entrepreneurs, creators, coaches, educators, and audience-based businesses — anyone who uses video to grow their reach and wants more control over how their content is consumed and converted.
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
                "Our mission is to help people turn content into structured business growth."
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
