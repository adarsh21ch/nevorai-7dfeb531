import { Navbar } from "@/components/landing/Navbar";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Check, X, Crown, Shield, Loader2, User, Lock, Tag, Sparkles, ArrowUp } from "lucide-react";
import { GuaranteeBanner, GuaranteePill } from "@/components/GuaranteeBanner";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { useNevoraiMember } from "@/hooks/useNevoraiMember";
import { useWhatsAppSupport } from "@/hooks/useWhatsAppSupport";
import { useCurrency, formatPrice } from "@/hooks/useCurrency";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

declare global {
  interface Window { Razorpay: any; }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

interface FeatureItem {
  text: string;
  enabled: boolean;
  locked?: boolean;
}

const buildFeatureList = (config: any): FeatureItem[] => {
  const items: FeatureItem[] = [];

  // Funnels
  if (config.max_funnels === -1) items.push({ text: "Unlimited Funnels", enabled: true });
  else if (config.max_funnels > 0) items.push({ text: `Up to ${config.max_funnels} Funnels`, enabled: true });
  else items.push({ text: "Funnels", enabled: false });

  // Landing Pages
  if (config.feature_landing_pages && config.max_landing_pages === -1) items.push({ text: "Unlimited Landing Pages", enabled: true });
  else if (config.feature_landing_pages && config.max_landing_pages > 0) items.push({ text: `Up to ${config.max_landing_pages} Landing Pages`, enabled: true });
  else items.push({ text: "Landing Pages", enabled: false });

  // Live Sessions
  if (config.feature_go_live && config.max_live_sessions === -1) items.push({ text: "Unlimited Live Sessions", enabled: true });
  else if (config.feature_go_live && config.max_live_sessions > 0) items.push({ text: `Up to ${config.max_live_sessions} Live Sessions`, enabled: true });
  else items.push({ text: "Live Sessions", enabled: false });

  // Feature flags
  items.push({ text: "Lead Capture", enabled: !!config.feature_lead_capture });
  items.push({ text: "Analytics", enabled: !!config.feature_analytics });
  items.push({ text: "WhatsApp Automation", enabled: !!config.feature_whatsapp_automation });

  if (config.multilevel_funnel_enabled) items.push({ text: "Multi-level Funnels", enabled: true });
  else items.push({ text: "Multi-level Funnels", enabled: false, locked: true });

  if (config.feature_team_members !== false && config.max_team_members !== 0) {
    if (config.max_team_members === -1) items.push({ text: "Unlimited Team Members", enabled: true });
    else if (config.max_team_members > 0) items.push({ text: `Team Members (up to ${config.max_team_members})`, enabled: true });
    else items.push({ text: "Team Members", enabled: false, locked: true });
  } else {
    items.push({ text: "Team Members", enabled: false, locked: true });
  }

  if (config.feature_team_analytics) items.push({ text: "Team Analytics Dashboard", enabled: true });
  else items.push({ text: "Team Analytics", enabled: false, locked: true });

  if (config.feature_video_sharing) items.push({ text: "Video Sharing", enabled: true });
  if (config.feature_advanced_analytics) items.push({ text: "Advanced Analytics", enabled: true });
  if (config.feature_priority_support) items.push({ text: "Priority Support", enabled: true });

  return items;
};

const FeatureRow = ({ item }: { item: FeatureItem }) => {
  if (item.enabled) {
    return (
      <li className="flex items-center gap-2 text-sm">
        <Check size={14} className="text-primary shrink-0" /> {item.text}
      </li>
    );
  }
  if (item.locked) {
    return (
      <li className="flex items-center gap-2 text-sm text-muted-foreground/60">
        <Lock size={14} className="shrink-0" /> {item.text}
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2 text-sm text-muted-foreground/60">
      <X size={14} className="shrink-0" /> {item.text}
    </li>
  );
};

const ComparisonCell = ({ value }: { value: boolean | string }) => {
  if (typeof value === "string") {
    return <span className="text-muted-foreground">{value}</span>;
  }
  return value
    ? <Check size={16} className="text-primary mx-auto" />
    : <X size={16} className="text-muted-foreground/40 mx-auto" />;
};

const PricingFullPage = () => {
  useDocumentTitle("Pricing");
  const { user, profile } = useAuth();
  const { plan, refreshPlan } = usePlan();
  const { isMember: isNevoraiMember } = useNevoraiMember();
  const { openSupport } = useWhatsAppSupport();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const { currency, gateway } = useCurrency();
  
  const autoTriggeredRef = useRef(false);

  // Mobile carousel state
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (!carouselApi) return;
    setActiveSlide(carouselApi.selectedScrollSnap());
    const onSelect = () => setActiveSlide(carouselApi.selectedScrollSnap());
    carouselApi.on("select", onSelect);
    carouselApi.on("reInit", onSelect);
    return () => {
      carouselApi.off("select", onSelect);
      carouselApi.off("reInit", onSelect);
    };
  }, [carouselApi]);

  const { data: planConfigs = [] } = useQuery({
    queryKey: ["plan-configs"],
    queryFn: async () => {
      const { data } = await supabase.from("plan_config").select("*");
      return (data || []) as any[];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // INR prices live in plan_view_tiers. Fetch base tier per plan and merge into config.
  const { data: viewTiers = [] } = useQuery({
    queryKey: ["plan-view-tiers-pricingfull"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plan_view_tiers" as any)
        .select("plan_name, daily_views, monthly_price, yearly_price, is_base, is_active")
        .eq("is_active", true);
      return (data || []) as any[];
    },
    staleTime: 60_000,
  });

  const baseTierFor = (planName: string) => {
    const list = viewTiers.filter((t: any) => t.plan_name === planName);
    if (!list.length) return null;
    const explicit = list.find((t: any) => t.is_base);
    return explicit || [...list].sort((a: any, b: any) => a.daily_views - b.daily_views)[0];
  };

  const withBasePrice = (config: any, planName: string) => {
    if (!config) return config;
    const base = baseTierFor(planName);
    if (!base) return { ...config, monthly_price: config.monthly_price ?? 0, yearly_price: config.yearly_price ?? 0 };
    return { ...config, monthly_price: base.monthly_price, yearly_price: base.yearly_price };
  };

  const freeConfig = planConfigs.find((c: any) => c.plan_name === "free");
  const basicConfig = withBasePrice(planConfigs.find((c: any) => c.plan_name === "basic"), "basic");
  const proConfig = withBasePrice(planConfigs.find((c: any) => c.plan_name === "pro"), "pro");
  const basicEnabled = basicConfig?.is_enabled !== false;
  const proEnabled = proConfig?.is_enabled !== false;

  const getPrice = (config: any) => {
    if (!config) return 0;
    if (currency === "USD") {
      return billing === "monthly"
        ? Number(config.usd_price_monthly || 0)
        : Number(config.usd_price_yearly || 0);
    }
    return billing === "monthly" ? config.monthly_price : config.yearly_price;
  };

  const getSavings = (config: any) => {
    if (!config) return 0;
    if (currency === "USD") {
      return Number(config.usd_price_monthly || 0) * 12 - Number(config.usd_price_yearly || 0);
    }
    return config.monthly_price * 12 - config.yearly_price;
  };

  const handlePayment = useCallback(async (planName: string) => {
    if (!user) {
      navigate(`/auth?tab=signup&redirect=/pricing&plan=${planName}`);
      return;
    }
    const config = planConfigs.find((c: any) => c.plan_name === planName);
    if (!config) return;

    const planKey = `${planName}_${billing}`;

    // Razorpay (INR) is the only payment gateway in use.

    // Indian users → Razorpay (INR). Server reads authoritative price from plan_view_tiers.
    setLoading(planKey);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error("Failed to load payment gateway");

      const { data, error } = await supabase.functions.invoke("razorpay-portal", {
        body: { action: "create_order", plan_key: planKey },
      });
      if (error || !data?.order_id) throw new Error(error?.message || "Failed to create order");

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: "nFlow",
        description: `${planName.charAt(0).toUpperCase() + planName.slice(1)} Plan — ${billing}`,
        order_id: data.order_id,
        handler: async (response: any) => {
          try {
            const { error: verifyError } = await supabase.functions.invoke("razorpay-portal", {
              body: {
                action: "verify_payment",
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan_key: planKey,
              },
            });
            if (verifyError) throw verifyError;
            toast.success(`Payment successful! Welcome to ${planName.charAt(0).toUpperCase() + planName.slice(1)} 🎉 You're covered by our 7-day money-back guarantee.`, {
              duration: 7000,
            });
            refreshPlan();
            setTimeout(() => navigate("/billing"), 1500);
          } catch {
            toast.error("Payment received but verification pending. Contact support.");
            openSupport("Hi, my payment was successful but access not unlocked. Payment ID: " + response.razorpay_payment_id);
          }
        },
        prefill: {
          name: profile?.full_name || "",
          email: user.email,
          contact: profile?.phone || "",
        },
        theme: { color: "#2563EB" },
        modal: { ondismiss: () => setLoading(null) },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => {
        toast.error("Payment failed. Please try again or use a different payment method.");
        setLoading(null);
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(null);
    }
  }, [user, profile, navigate, openSupport, refreshPlan, billing, planConfigs, gateway]);

  // Auto-trigger checkout after returning from /auth with ?plan=basic|pro
  useEffect(() => {
    if (autoTriggeredRef.current) return;
    const planParam = searchParams.get("plan");
    if (!planParam || !user || planConfigs.length === 0) return;
    const target = planParam.toLowerCase();
    if (target !== "basic" && target !== "pro") return;
    const config = planConfigs.find((c: any) => c.plan_name === target);
    if (!config || config.is_enabled === false) return;
    autoTriggeredRef.current = true;
    // Clear the param so refreshes don't re-trigger
    const next = new URLSearchParams(searchParams);
    next.delete("plan");
    setSearchParams(next);
    // Slight delay so the modal opens cleanly after mount
    setTimeout(() => handlePayment(target), 250);
  }, [searchParams, user, planConfigs, handlePayment, setSearchParams]);

  const isCurrentTier = (t: string) => plan.isPaid && plan.tier === t && !plan.isExpired;
  // Treat verified Nevorai members as already on Basic for UI purposes only
  // (their actual plan record is managed by the gateway; they shouldn't pay
  // for Basic again).
  const effectiveBasic = isCurrentTier("basic") || (!plan.isPaid && isNevoraiMember);
  const effectivePro = isCurrentTier("pro");

  // Dynamic comparison table — Free column is now driven by `freeConfig`
  const buildComparisonRows = () => {
    const limitDisplay = (val: number | undefined | null) => {
      if (val === undefined || val === null) return "—";
      if (val === -1) return "Unlimited";
      if (val === 0) return "—";
      return String(val);
    };

    const freeFunnels = freeConfig?.feature_funnel_creation === false ? "—" : limitDisplay(freeConfig?.max_funnels);
    const freeLanding = freeConfig?.feature_landing_pages ? limitDisplay(freeConfig?.max_landing_pages) : "—";
    const freeLive = freeConfig?.feature_go_live ? limitDisplay(freeConfig?.max_live_sessions) : "—";

    const rows: { name: string; free: boolean | string; basic: boolean | string; pro: boolean | string }[] = [
      { name: "Funnels", free: freeFunnels, basic: limitDisplay(basicConfig?.max_funnels), pro: limitDisplay(proConfig?.max_funnels) },
      { name: "Landing Pages", free: freeLanding, basic: basicConfig?.feature_landing_pages ? limitDisplay(basicConfig?.max_landing_pages) : "—", pro: proConfig?.feature_landing_pages ? limitDisplay(proConfig?.max_landing_pages) : "—" },
      { name: "Live Sessions", free: freeLive, basic: basicConfig?.feature_go_live ? limitDisplay(basicConfig?.max_live_sessions) : "—", pro: proConfig?.feature_go_live ? limitDisplay(proConfig?.max_live_sessions) : "—" },
      { name: "Lead Capture", free: !!freeConfig?.feature_lead_capture, basic: !!basicConfig?.feature_lead_capture, pro: !!proConfig?.feature_lead_capture },
      { name: "Analytics", free: !!freeConfig?.feature_analytics, basic: !!basicConfig?.feature_analytics, pro: !!proConfig?.feature_analytics },
      { name: "WhatsApp Automation", free: !!freeConfig?.feature_whatsapp_automation, basic: !!basicConfig?.feature_whatsapp_automation, pro: !!proConfig?.feature_whatsapp_automation },
      { name: "Multi-level Funnels", free: !!freeConfig?.multilevel_funnel_enabled, basic: !!basicConfig?.multilevel_funnel_enabled, pro: !!proConfig?.multilevel_funnel_enabled },
      { name: "Team Members", free: false, basic: false, pro: proConfig?.max_team_members === -1 ? true : (proConfig?.max_team_members > 0 ? `Up to ${proConfig?.max_team_members}` : false) },
      { name: "Video Sharing", free: !!freeConfig?.feature_video_sharing, basic: !!basicConfig?.feature_video_sharing, pro: !!proConfig?.feature_video_sharing },
      { name: "Advanced Analytics", free: !!freeConfig?.feature_advanced_analytics, basic: !!basicConfig?.feature_advanced_analytics, pro: !!proConfig?.feature_advanced_analytics },
      { name: "Priority Support", free: !!freeConfig?.feature_priority_support, basic: !!basicConfig?.feature_priority_support, pro: !!proConfig?.feature_priority_support },
      { name: "Team Analytics", free: !!freeConfig?.feature_team_analytics, basic: !!basicConfig?.feature_team_analytics, pro: !!proConfig?.feature_team_analytics },
    ];
    return rows;
  };

  const basicFeatures = basicConfig ? buildFeatureList(basicConfig) : [];
  const proFeatures = proConfig ? buildFeatureList(proConfig) : [];

  // ---- Card builders (rendered into both desktop grid + mobile carousel) ----
  // Free card features are fully driven by `freeConfig` from admin panel.
  const freeIncluded: string[] = [];
  const freeExcluded: string[] = [];

  if (freeConfig?.feature_funnel_creation !== false) {
    if (freeConfig?.max_funnels === -1) freeIncluded.push("Unlimited funnels");
    else if ((freeConfig?.max_funnels ?? 0) > 0) freeIncluded.push(`Create up to ${freeConfig.max_funnels} funnel${freeConfig.max_funnels === 1 ? "" : "s"}`);
  }
  if (freeConfig?.feature_video_upload) {
    if (freeConfig?.max_videos === -1) freeIncluded.push("Unlimited video uploads");
    else if ((freeConfig?.max_videos ?? 0) > 0) freeIncluded.push(`Upload up to ${freeConfig.max_videos} video${freeConfig.max_videos === 1 ? "" : "s"}`);
  }
  freeIncluded.push("Add videos via nFlow Video Link");
  if (freeConfig?.daily_view_limit === -1) freeIncluded.push("Unlimited daily views");
  else if ((freeConfig?.daily_view_limit ?? 0) > 0) freeIncluded.push(`${freeConfig.daily_view_limit} views/day total`);
  freeIncluded.push("Access public content");
  freeIncluded.push("Browse marketplace");

  if (!freeConfig?.feature_landing_pages) freeExcluded.push("Create landing pages");
  if (!freeConfig?.feature_go_live) freeExcluded.push("Go live");
  if (!freeConfig?.feature_lead_capture) freeExcluded.push("Lead capture");

  const freeCard: ReactNode = (
    <motion.div className="glass-card p-6 flex flex-col h-full" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-6">
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Free</span>
        <div className="flex items-baseline gap-1 mt-3">
          <span className="text-3xl font-heading font-bold">{formatPrice(0, currency)}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Forever free · no credit card</p>
      </div>
      <ul className="space-y-2.5 mb-6 max-h-[260px] md:max-h-[360px] overflow-y-auto pr-1 md:flex-1">
        {freeIncluded.map(f => (
          <li key={f} className="flex items-center gap-2 text-sm"><Check size={14} className="text-primary shrink-0" /> {f}</li>
        ))}
        {freeExcluded.map(f => (
          <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground/60"><X size={14} className="shrink-0" /> {f}</li>
        ))}
      </ul>
      {!plan.isPaid && !plan.isExpired && !isNevoraiMember ? (
        <>
          <Button variant="outline" disabled className="w-full">Current Plan</Button>
          <p className="text-[11px] text-muted-foreground text-center mt-2 leading-snug">
            No credit card required. Start building your first funnel in minutes.
          </p>
        </>
      ) : (
        <>
          <Button variant="outline" onClick={() => navigate(user ? "/dashboard" : "/auth?tab=signup")} className="w-full">
            {user ? "Stay Free" : "Get Started"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center mt-2 leading-snug">
            No credit card required. Start building your first funnel in minutes.
          </p>
        </>
      )}
    </motion.div>
  );

  const basicCard: ReactNode = basicEnabled && basicConfig ? (
    <motion.div className="glass-card p-6 flex flex-col h-full relative" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      {basicConfig.plan_badge_text && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-card border border-border text-xs font-semibold flex items-center gap-1 whitespace-nowrap">
          <User size={12} /> {basicConfig.plan_badge_text}
        </div>
      )}
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-400/30 font-semibold">Basic</span>
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
            <Tag size={10} /> Launch Price
          </span>
        </div>
        <div className="flex items-baseline gap-1 mt-3">
          <span className="text-3xl font-heading font-bold">{formatPrice(getPrice(basicConfig), currency)}</span>
          <span className="text-sm text-muted-foreground">/{billing === "monthly" ? "mo" : "yr"}</span>
        </div>
        <p className="text-[11px] text-muted-foreground italic mt-1">Introductory pricing — limited time</p>
        {billing === "monthly" && getSavings(basicConfig) > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            or {formatPrice(currency === "USD" ? Number(basicConfig.usd_price_yearly || 0) : basicConfig.yearly_price, currency)}/year — save {formatPrice(getSavings(basicConfig), currency)}
          </p>
        )}
      </div>
      <ul className="space-y-2.5 mb-6 max-h-[260px] md:max-h-[360px] overflow-y-auto pr-1 md:flex-1">
        {basicFeatures.map((item, i) => <FeatureRow key={i} item={item} />)}
      </ul>
      {effectiveBasic ? (
        <Button disabled className="w-full gap-2">
          {isNevoraiMember && !plan.isPaid ? (
            <><Sparkles size={14} /> Active via Nevorai membership</>
          ) : (
            "Current Plan"
          )}
        </Button>
      ) : effectivePro ? (
        <Button disabled variant="outline" className="w-full">Included in Pro</Button>
      ) : (
        <>
          <GuaranteePill />
          <Button className="w-full gap-2" onClick={() => handlePayment("basic")} disabled={loading === `basic_${billing}`}>
            {loading === `basic_${billing}` ? <Loader2 size={16} className="animate-spin" /> : null}
            Subscribe — {formatPrice(getPrice(basicConfig), currency)}/{billing === "monthly" ? "mo" : "yr"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
            <Shield size={10} className="text-emerald-500" /> Secure payment via Razorpay · UPI · Cards · NetBanking
          </p>
        </>
      )}
    </motion.div>
  ) : null;

  // Compute Pro upgrade-difference price (monthly)
  const upgradeDiffMonthly = (() => {
    if (!effectiveBasic || effectivePro) return null;
    if (!basicConfig || !proConfig) return null;
    const proPrice = getPrice(proConfig);
    const basicPrice = getPrice(basicConfig);
    const diff = Math.max(0, proPrice - basicPrice);
    return diff;
  })();

  const proCard: ReactNode = proEnabled && proConfig ? (
    <motion.div className="glass-card p-6 flex flex-col h-full relative border-primary/40 glow-primary" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-xs font-semibold text-white flex items-center gap-1 whitespace-nowrap shadow-lg shadow-emerald-500/30">
        <Crown size={12} /> Most Popular
      </div>
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 font-medium">Pro</span>
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
            <Tag size={10} /> Launch Price
          </span>
        </div>
        <div className="flex items-baseline gap-1 mt-3">
          <span className="text-3xl font-heading font-bold">{formatPrice(getPrice(proConfig), currency)}</span>
          <span className="text-sm text-muted-foreground">/{billing === "monthly" ? "mo" : "yr"}</span>
        </div>
        <p className="text-[11px] text-muted-foreground italic mt-1">Introductory pricing — limited time</p>
        {billing === "monthly" && getSavings(proConfig) > 0 && (
          <p className="text-xs text-primary mt-1">
            or {formatPrice(currency === "USD" ? Number(proConfig.usd_price_yearly || 0) : proConfig.yearly_price, currency)}/year — save {formatPrice(getSavings(proConfig), currency)}
          </p>
        )}
      </div>
      <ul className="space-y-2.5 mb-6 max-h-[260px] md:max-h-[360px] overflow-y-auto pr-1 md:flex-1">
        {proFeatures.map((item, i) => <FeatureRow key={i} item={item} />)}
      </ul>
      {effectivePro ? (
        <Button disabled className="w-full">Current Plan</Button>
      ) : (
        <>
          <GuaranteePill />
          <Button className="w-full gap-2" onClick={() => handlePayment("pro")} disabled={loading === `pro_${billing}`}>
            {loading === `pro_${billing}` ? <Loader2 size={16} className="animate-spin" /> : effectiveBasic ? <ArrowUp size={16} /> : <Crown size={16} />}
            {effectiveBasic
              ? `Upgrade to Pro${upgradeDiffMonthly !== null && billing === "monthly" ? ` — +${formatPrice(upgradeDiffMonthly, currency)}/mo` : ""}`
              : `Subscribe — ${formatPrice(getPrice(proConfig), currency)}/${billing === "monthly" ? "mo" : "yr"}`}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
            <Shield size={10} className="text-emerald-500" /> Secure payment via Razorpay · UPI · Cards · NetBanking
          </p>
        </>
      )}
    </motion.div>
  ) : null;

  const cards: { key: string; node: ReactNode }[] = [
    { key: "free", node: freeCard },
    ...(basicCard ? [{ key: "basic", node: basicCard }] : []),
    ...(proCard ? [{ key: "pro", node: proCard }] : []),
  ];

  const enabledPaidPlans = [basicEnabled, proEnabled].filter(Boolean).length;
  const desktopGridCols =
    enabledPaidPlans === 0
      ? "md:grid-cols-1 max-w-md mx-auto"
      : enabledPaidPlans === 1
      ? "md:grid-cols-2 max-w-3xl mx-auto"
      : "md:grid-cols-3 max-w-5xl mx-auto";

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container-app">
          <motion.div className="text-center mb-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl md:text-5xl font-heading font-bold mb-4">
              Choose Your <span className="gradient-text">Growth Plan</span>
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto mb-6">
              Start risk-free. 7-day money-back guarantee on all paid plans.
            </p>
            {plan.isExpired && (
              <p className="text-sm text-destructive font-medium">Your plan has expired. Renew to restore access.</p>
            )}
            {isNevoraiMember && !plan.isPaid && (
              <div className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-600 dark:text-emerald-400">
                <Sparkles size={14} /> You have free Individual access via your Nevorai Pro membership
              </div>
            )}
          </motion.div>

          {/* Billing toggle */}
          {(basicEnabled || proEnabled) && (
            <div className="flex items-center justify-center gap-3 mb-10">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${billing === "monthly" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all relative ${billing === "yearly" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                Yearly
                {(() => {
                  const refConfig = basicEnabled ? basicConfig : proConfig;
                  if (refConfig && refConfig.monthly_price > 0) {
                    const pct = Math.round((1 - refConfig.yearly_price / (refConfig.monthly_price * 12)) * 100);
                    if (pct > 0) return (
                      <span className="absolute -top-2 -right-2 text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                        Save {pct}%
                      </span>
                    );
                  }
                  return null;
                })()}
              </button>
            </div>
          )}

          {/* Mobile: swipeable carousel with dots */}
          <div className="md:hidden mb-10">
            <Carousel
              setApi={setCarouselApi}
              opts={{ align: "center", loop: false }}
              className="w-full"
            >
              {/* py-4 prevents the absolute -top-3 badges from being clipped
                  by Embla's overflow-hidden viewport. */}
              <CarouselContent className="-ml-4 py-4 items-stretch">
                {cards.map((c) => (
                  <CarouselItem key={c.key} className="pl-4 basis-[88%] sm:basis-[70%] h-auto">
                    {c.node}
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
            {/* Dot indicators */}
            <div className="flex items-center justify-center gap-2 mt-3">
              {cards.map((c, i) => (
                <button
                  key={c.key}
                  type="button"
                  aria-label={`Show ${c.key} plan`}
                  onClick={() => carouselApi?.scrollTo(i)}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    activeSlide === i ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30",
                  )}
                />
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-2">
              Swipe to compare plans
            </p>
          </div>

          {/* Desktop: original grid */}
          <div className={`hidden md:grid gap-6 mb-16 ${desktopGridCols}`}>
            {cards.map((c) => (
              <div key={c.key} className="h-full">
                {c.node}
              </div>
            ))}
          </div>

          {/* Dynamic comparison table */}
          <div className="glass-card overflow-hidden max-w-5xl mx-auto mb-12">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium">Feature</th>
                    <th className="text-center p-4 font-medium">Free</th>
                    {basicEnabled && <th className="text-center p-4 font-medium">Basic</th>}
                    {proEnabled && <th className="text-center p-4 font-medium text-primary">Pro</th>}
                  </tr>
                </thead>
                <tbody>
                  {buildComparisonRows().map((row) => (
                    <tr key={row.name} className="border-b border-border/50">
                      <td className="p-4">{row.name}</td>
                      <td className="p-4 text-center"><ComparisonCell value={row.free} /></td>
                      {basicEnabled && <td className="p-4 text-center"><ComparisonCell value={row.basic} /></td>}
                      {proEnabled && <td className="p-4 text-center"><ComparisonCell value={row.pro} /></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <GuaranteeBanner />

          <div className="max-w-lg mx-auto text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Shield size={16} /> Secure payments via Razorpay
            </div>
            <p className="text-sm text-muted-foreground">
              Need help choosing a plan?{" "}
              <button className="text-primary underline" onClick={() => openSupport("Hi, I need help choosing a nFlow plan.")}>
                Chat with us on WhatsApp
              </button>
            </p>
          </div>
        </div>
      </div>
      <Footer />

    </div>
  );
};

export default PricingFullPage;
