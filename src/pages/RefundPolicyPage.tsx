import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { motion } from "framer-motion";

const RefundPolicyPage = () => {
  return (
    <div data-theme="dark" className="min-h-screen bg-hero-bg text-white">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="container-app max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10 pb-8 border-b border-border">
            <h1 className="text-3xl md:text-4xl font-heading font-bold mb-2">Refund Policy</h1>
            <p className="text-sm text-muted-foreground mb-6">Last updated: May 2026</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We offer a 7-day money-back guarantee on all paid plans. If Nevorai Flow doesn't work for you,
              we'll refund you — no difficult questions.
            </p>
          </motion.div>

          <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">1. Our Guarantee</h2>
              <p className="mb-3">
                We believe in Nevorai Flow. If you subscribe to any paid plan and are not satisfied within
                <strong className="text-foreground"> 7 days of your payment date</strong>, you can request a full refund.
              </p>
              <p>
                This is in addition to our free trial — so you have tried Nevorai Flow for free before paying, and
                you still have 7 days after paying to change your mind. That is our commitment to you.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">2. Who Is Eligible</h2>
              <p className="mb-3">You are eligible for a refund if:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>You request it within 7 days of your payment date.</li>
                <li>This is your first paid subscription (not a renewal).</li>
                <li>You have not previously received a refund from Nevorai.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">3. Who Is Not Eligible</h2>
              <p className="mb-3">Refunds are not available if:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>More than 7 days have passed since payment.</li>
                <li>You are requesting a refund for a renewal charge (plan auto-renewed).</li>
                <li>Your account was suspended for violation of our Terms of Service.</li>
                <li>You have already received a refund from Nevorai previously.</li>
                <li>You have heavily used the platform during the period — for example, consumed a large share of monthly funnel views or uploaded a high volume of content (indicating active use, at our discretion).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">4. How to Request a Refund</h2>
              <p className="mb-3">To request a refund:</p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Email <a href="mailto:teamnevorai@gmail.com" className="text-primary hover:underline">teamnevorai@gmail.com</a> with subject line: "Refund Request — [your email]".</li>
                <li>Include your registered email and payment date.</li>
                <li>We will respond within 24 hours on business days.</li>
                <li>Approved refunds are processed within 5–7 business days back to your original payment method.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">5. Renewal Charges</h2>
              <p className="mb-3">
                We send a reminder email 3 days before your plan renews. If you do not wish to renew, cancel
                before the renewal date from your Profile settings.
              </p>
              <p>
                Renewal charges are generally non-refundable. However, if you contact us within 24 hours of an
                accidental renewal, we will consider a refund on a case-by-case basis.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">6. Plan Upgrades</h2>
              <p>
                If you upgrade from a lower plan to a higher plan mid-cycle, you are charged only the difference
                for the remaining period. This upgrade charge follows the same 7-day refund policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">7. Processing Time</h2>
              <p className="mb-3">Once a refund is approved by our team:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Razorpay processes the refund within 2–3 business days.</li>
                <li>Your bank may take an additional 3–5 business days to credit the amount.</li>
                <li>UPI refunds are typically faster (1–2 business days).</li>
                <li>Total time: 5–7 business days in most cases.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">8. Contact for Refunds</h2>
              <p>
                Email: <a href="mailto:teamnevorai@gmail.com" className="text-primary hover:underline">teamnevorai@gmail.com</a><br />
                WhatsApp: <a href="https://wa.me/919329040508" target="_blank" rel="noreferrer" className="text-primary hover:underline">+91 93290 40508</a><br />
                Response time: within 24 hours on business days.
              </p>
            </section>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default RefundPolicyPage;
