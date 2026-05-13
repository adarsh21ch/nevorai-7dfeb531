import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Mail, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ContactPage = () => {
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast.success("Message sent! We'll get back to you soon.");
      (e.target as HTMLFormElement).reset();
    }, 1000);
  };

  return (
    <div data-theme="dark" className="min-h-screen bg-hero-bg text-white">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="container-app max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-3xl md:text-5xl font-heading font-bold mb-4">
              Need help or have a <span className="gradient-text">question?</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              We're here to help with product questions, support issues, or feedback.
            </p>
          </motion.div>

          <motion.form
            onSubmit={handleSubmit}
            className="glass-card p-8 space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Your name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" placeholder="How can we help?" rows={5} required />
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={sending}>
              {sending ? "Sending..." : "Send Message"}
            </Button>
          </motion.form>

          <motion.div
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-primary" />
              <span>teamnevorai@gmail.com</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageCircle size={16} className="text-primary" />
              <span>WhatsApp support available</span>
            </div>
          </motion.div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            We usually respond as soon as possible.
          </p>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default ContactPage;
