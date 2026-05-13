import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { motion } from "framer-motion";

const TermsPage = () => {
  return (
    <div data-theme="dark" className="min-h-screen bg-hero-bg text-white">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="container-app max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10 pb-8 border-b border-border">
            <h1 className="text-3xl md:text-4xl font-heading font-bold mb-2">Terms of Service</h1>
            <p className="text-sm text-muted-foreground mb-6">Last updated: May 2026</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By creating an account or using nFlow by Nevorai, you agree to these Terms of Service. Please read them
              carefully. If you do not agree, do not use nFlow by Nevorai.
            </p>
          </motion.div>

          <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">1. About nFlow by Nevorai</h2>
              <p>
                nFlow by Nevorai is a distraction-free video funnel platform built by Nevorai for creators, coaches, and
                educators. These terms govern your use of the nFlow by Nevorai application and all related services.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">2. Your Account</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>You must be at least 18 years old to create an account.</li>
                <li>You are responsible for keeping your login credentials secure.</li>
                <li>You may not share your account or create accounts on behalf of others without permission.</li>
                <li>One account per person — multiple accounts for the same individual are not permitted.</li>
                <li>You must provide accurate information when signing up.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">3. Free Trial</h2>
              <p className="mb-3">
                New users receive a free trial period (duration shown at signup). During the trial you get full
                access to all features. No payment is required to start a trial.
              </p>
              <p>
                After the trial ends, you must subscribe to a paid plan to continue using nFlow by Nevorai. Your data is
                retained for 30 days after trial expiry before being eligible for deletion.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">4. Paid Plans and Billing</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Paid plans are billed monthly or yearly as selected at checkout.</li>
                <li>All prices are in Indian Rupees (₹) and inclusive of applicable taxes.</li>
                <li>Payments are processed securely by Razorpay.</li>
                <li>Your plan renews automatically on the renewal date unless cancelled.</li>
                <li>We reserve the right to change plan prices with 30 days notice to existing subscribers.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">5. Acceptable Use</h2>
              <p className="mb-3">You agree NOT to use nFlow by Nevorai to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Spam, harass, or send unsolicited messages to leads or contacts.</li>
                <li>Capture or store data of individuals without their consent.</li>
                <li>Upload illegal, infringing, or harmful video content.</li>
                <li>Violate any applicable Indian or international law.</li>
                <li>Attempt to reverse-engineer, hack, or disrupt the service.</li>
                <li>Create fake accounts or misrepresent your identity.</li>
                <li>Run pyramid schemes or any deceptive multi-level marketing activity.</li>
                <li>Resell or white-label nFlow by Nevorai without written permission from Nevorai.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">6. Your Content & Data</h2>
              <p>
                You own your content — videos, funnels, landing pages, leads, and any media you upload to nFlow by Nevorai.
                By using nFlow by Nevorai, you grant Nevorai a limited licence to store, process, transcode, and stream
                this content solely to provide the service to you and your viewers. We do not use your content
                for any other purpose.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">7. Plan Limits</h2>
              <p>
                Each plan has usage limits — monthly funnel views, number of funnels, videos, landing pages,
                and team members — as described on our pricing page. If you exceed your plan limits, certain
                features (such as public funnel access) may be paused until the next billing cycle or until
                you upgrade. We show clear warnings before limits are reached.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">8. Service Availability</h2>
              <p>
                We aim for 99% uptime but do not guarantee uninterrupted access. Planned maintenance will be
                announced in advance where possible. We are not liable for losses caused by service downtime.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">9. Termination</h2>
              <p className="mb-3">
                You may cancel your account at any time from your profile settings. We may suspend or terminate
                accounts that violate these terms, with or without notice depending on severity.
              </p>
              <p>
                Upon termination, your data will be retained for 30 days and then permanently deleted, unless
                legal requirements mandate longer retention.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">10. Limitation of Liability</h2>
              <p className="mb-3">
                nFlow by Nevorai is provided "as is". Nevorai is not liable for any indirect, incidental, or consequential
                damages arising from your use of the service, including but not limited to lost profits, lost
                leads, or missed business opportunities.
              </p>
              <p>
                Our total liability to you in any circumstance is limited to the amount you paid us in the
                3 months preceding the claim.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">11. Governing Law</h2>
              <p>
                These terms are governed by the laws of India. Any disputes will be subject to the exclusive
                jurisdiction of the courts of India. This service complies with the Information Technology Act,
                2000 and its amendments.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">12. Changes to Terms</h2>
              <p>
                We may update these terms. Significant changes will be communicated via email or in-app
                notification with at least 14 days notice. Continued use after that date constitutes acceptance
                of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">13. Contact</h2>
              <p>
                Questions about these terms?<br />
                Email: <a href="mailto:teamnevorai@gmail.com" className="text-primary hover:underline">teamnevorai@gmail.com</a><br />
                WhatsApp: <a href="https://wa.me/919329040508" target="_blank" rel="noreferrer" className="text-primary hover:underline">+91 93290 40508</a>
              </p>
            </section>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default TermsPage;
