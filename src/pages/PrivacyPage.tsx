import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { motion } from "framer-motion";

const PrivacyPage = () => {
  return (
    <div data-theme="dark" className="min-h-screen bg-hero-bg text-white">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="container-app max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10 pb-8 border-b border-border">
            <h1 className="text-3xl md:text-4xl font-heading font-bold mb-2">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground mb-6">Last updated: May 2026</p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              <strong className="text-foreground">Legal Entity:</strong> Nevorai Technologies
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nevorai respects your privacy. This policy explains what data we collect, how we use it,
              and how we protect it. We comply with the Information Technology Act, 2000 and its amendments
              applicable in India.
            </p>
          </motion.div>

          <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">1. Who We Are</h2>
              <p className="mb-3">
                Nevorai is a product of <strong className="text-foreground">Nevorai Technologies</strong>. We build a distraction-free video funnel platform for creators,
                coaches, and educators. When we say "Nevorai", "we", "us", or "our" in this policy, we mean
                Nevorai Technologies and the Nevorai application.
              </p>
              <p>
                For any privacy-related concerns, contact us at{" "}
                <a href="mailto:teamnevorai@gmail.com" className="text-primary hover:underline">teamnevorai@gmail.com</a>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">2. What Data We Collect</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-foreground">Account data:</strong> Name, email, phone number (when provided), and password (stored encrypted).</li>
                <li><strong className="text-foreground">Lead data:</strong> Names, emails, phone numbers, and details your viewers submit through your funnels and landing pages.</li>
                <li><strong className="text-foreground">Funnel content:</strong> Videos, thumbnails, copy, and any media you upload to Nevorai.</li>
                <li><strong className="text-foreground">Engagement data:</strong> Video views, watch progress, session timestamps, and viewer interactions.</li>
                <li><strong className="text-foreground">Usage data:</strong> Pages visited, features used, session duration, device type, and browser.</li>
                <li><strong className="text-foreground">Payment data:</strong> Plan type and payment status. We do NOT store card numbers — payments are processed by Razorpay.</li>
                <li><strong className="text-foreground">KYC data:</strong> If you submit KYC for payouts (PAN, Aadhaar reference), it is encrypted and used solely for verification.</li>
                <li><strong className="text-foreground">Device data:</strong> IP address, device type, operating system, browser type.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">3. How We Use Your Data</h2>
              <p className="mb-3">We use your data to:</p>
              <ul className="list-disc pl-5 space-y-2 mb-3">
                <li>Provide and improve the Nevorai service.</li>
                <li>Send you account-related emails (verification, payment receipts, plan updates).</li>
                <li>Show you funnel analytics, lead activity, and viewer engagement inside the app.</li>
                <li>Enforce plan limits (monthly views, funnels, videos) and manage your subscription.</li>
                <li>Respond to your support requests.</li>
                <li>Prevent fraud, abuse, and unauthorized access.</li>
              </ul>
              <p>
                We do <strong className="text-foreground">NOT</strong> sell your data. We do <strong className="text-foreground">NOT</strong> share your lead data with any third party for marketing purposes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">4. Data We Share With Third Parties</h2>
              <p className="mb-3">We share limited data with these trusted services only:</p>
              <ul className="list-disc pl-5 space-y-2 mb-3">
                <li><strong className="text-foreground">Supabase:</strong> Database and authentication infrastructure.</li>
                <li><strong className="text-foreground">Cloudflare R2 + CDN:</strong> Video storage and streaming delivery.</li>
                <li><strong className="text-foreground">Razorpay:</strong> Payment processing (they handle card data, we never see it).</li>
                <li><strong className="text-foreground">Google (Gmail API):</strong> Sending transactional emails on our behalf.</li>
              </ul>
              <p>
                All third-party services are bound by their own privacy policies and data processing agreements.
                We do not share data with any other parties.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">5. Your Lead Data</h2>
              <p className="mb-3">
                The leads captured through your funnels and landing pages belong to you. We store them securely
                to power the app. We do not access, use, or share your lead data for any purpose other than
                displaying it to you and the team members you invite.
              </p>
              <p>
                If you delete your account, all your lead data is permanently deleted within 30 days.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">6. Data Storage and Security</h2>
              <p className="mb-3">
                Your data is stored on Supabase servers with industry-standard encryption. Passwords are hashed.
                Payment data is handled entirely by Razorpay's PCI-compliant infrastructure — we never store
                card details.
              </p>
              <p>
                We use HTTPS for all data transmission. Access to production data is restricted to authorised
                Nevorai team members only. Row-Level Security policies isolate every creator's data.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">7. Cookies and Tracking</h2>
              <p>
                We use essential cookies only — these are required for login sessions and app functionality.
                We do not use advertising cookies or third-party tracking pixels.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">8. Your Rights</h2>
              <p className="mb-3">You have the right to:</p>
              <ul className="list-disc pl-5 space-y-2 mb-3">
                <li>Access the data we hold about you.</li>
                <li>Correct any incorrect data.</li>
                <li>Request deletion of your account and all associated data.</li>
                <li>Export your lead data as CSV at any time.</li>
              </ul>
              <p>
                To exercise any of these rights, email us at{" "}
                <a href="mailto:teamnevorai@gmail.com" className="text-primary hover:underline">teamnevorai@gmail.com</a>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">9. Data Retention</h2>
              <p>
                We retain your account data for as long as your account is active. If you delete your account,
                all personal data is removed within 30 days. Payment records may be retained for up to 7 years
                as required by Indian financial regulations.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">10. Children's Privacy</h2>
              <p>
                Nevorai is not intended for users under the age of 18. We do not knowingly collect data from minors.
                If you believe a minor has created an account, contact us and we will delete it immediately.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">11. Changes to This Policy</h2>
              <p>
                We may update this policy from time to time. We will notify you via email or an in-app notice
                if we make significant changes. Continued use of Nevorai after changes means you accept the
                updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-3">12. Contact Us</h2>
              <p>
                Questions about this privacy policy?<br />
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

export default PrivacyPage;
