import { useEffect } from "react";
import { Navigate } from "@/lib/router-compat";
// Navigate shim fallback

import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { LeakyFunnel } from "@/components/landing/LeakyFunnel";
import { ConversionCalculator } from "@/components/landing/ConversionCalculator";
import { ProspectJourney } from "@/components/landing/ProspectJourney";
import { WhyNevorai } from "@/components/landing/WhyNevorai";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { Testimonials } from "@/components/landing/Testimonials";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";
import { brand } from "@/config/brand";

/**
 * Detect when the app is launched as an installed PWA (Add to Home Screen).
 * In standalone / fullscreen / minimal-ui modes we treat the user as "in app"
 * and skip the marketing landing page — sending them straight to /dashboard
 * (which itself redirects to /auth if they aren't signed in).
 */
const isStandalonePWA = (): boolean => {
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia?.("(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)");
  // iOS Safari exposes navigator.standalone instead of the matchMedia query.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iosStandalone = (window.navigator as any).standalone === true;
  return !!(mql?.matches || iosStandalone);
};

const Index = () => {
  // Hard redirect installed-PWA launches away from the marketing site.
  // Logged-out users will then land on /auth via ProtectedRoute.
  if (isStandalonePWA()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen landing-page">
      <Navbar />
      <HeroSection />
      <LeakyFunnel />
      <ConversionCalculator />
      <ProspectJourney />
      <WhyNevorai />
      <FeaturesSection />
      <Testimonials />
      <PricingSection />
      <FAQSection />
      <FinalCTA />
      <Footer />
    </div>
  );
};

export default Index;
