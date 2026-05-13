import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, X, Crown, Info, Loader2, Sparkles, ArrowUp } from "lucide-react";
import { Link, useNavigate } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { useNevoraiMember } from "@/hooks/useNevoraiMember";
import { useWhatsAppSupport } from "@/hooks/useWhatsAppSupport";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getSupabaseFunctionErrorMessage } from "@/lib/supabase-function-error";

// Trial system disabled. Free tier is the new entry point.


const VIEWS_TOOLTIP = "Total unique viewers across all your funnels per day. Resets at midnight IST.";

const FREE_CTA = "Start Free";
const FREE_VARIANT = "outline" as const;

/**
 * Build the Free-plan feature list entirely from the admin `plan_config` row.
 * Always shows: marketplace + public content + Nevorai Flow video link (constant
 * platform capabilities). Everything else is driven by DB so admin edits to
 * max_funnels / max_videos / daily_view_limit / feature_* immediately reflect
 * on the public pricing card.
 */
const buildFreeFeatures = (config: any): { text: string; included: boolean; tooltip?: string }[] => {
  const items: { text: string; included: boolean; tooltip?: string }[] = [];

  // Funnels (only show if creation is allowed AND at least 1 funnel)
  if (config?.feature_funnel_creation !== false) {
    if (config?.max_funnels === -1) items.push({ text: "Unlimited funnels", included: true });
    else if ((config?.max_funnels ?? 0) > 0) items.push({ text: `Create up to ${config.max_funnels} funnel${config.max_funnels === 1 ? "" : "s"}`, included: true });
  }

  // Video uploads
  if (config?.feature_video_upload) {
    if (config?.max_videos === -1) items.push({ text: "Unlimited video uploads", included: true });
    else if ((config?.max_videos ?? 0) > 0) items.push({ text: `Upload up to ${config.max_videos} video${config.max_videos === 1 ? "" : "s"}`, included: true });
  }

  // Always-on platform capabilities for free users
  items.push({ text: "Add videos via Nevorai Flow Video Link", included: true });

  // Daily view limit
  const dv = formatDailyViews(config?.daily_view_limit);
  if (dv) items.push({ text: dv.text, included: true, tooltip: dv.tooltip });

  items.push({ text: "Access public content", included: true });
  items.push({ text: "Browse marketplace", included: true });

  // Negative feature flags — show as crossed out so users see what's gated
  items.push({ text: "Lead capture", included: !!config?.feature_lead_capture });
  items.push({ text: "Live broadcast", included: !!config?.feature_go_live });

  return items;
};

const formatStorage = (mb: number | null | undefined): string | null => {
  if (mb == null) return null;
  if (mb === -1) return "Unlimited storage";
  if (mb <= 0) return null;
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${gb % 1 === 0 ? gb : gb.toFixed(1)} GB storage`;
  }
  return `${mb} MB storage`;
};

const formatDailyViews = (limit: number | null | undefined): { text: string; tooltip: string } | null => {
  if (limit == null) return null;
  if (limit === -1) return { text: "Unlimited daily views", tooltip: VIEWS_TOOLTIP };
  if (limit <= 0) return null;
  return { text: `${limit.toLocaleString("en-IN")} views/day total`, tooltip: VIEWS_TOOLTIP };
};

const buildFeatures = (config: any) => {
  const features: { text: string; included: boolean; tooltip?: string }[] = [];

  // Funnels
  if (config.max_funnels === -1) features.push({ text: "Unlimited funnels", included: true });
  else if (config.max_funnels > 0) features.push({ text: `Up to ${config.max_funnels} funnels`, included: true });

  // Landing pages
  if (config.feature_landing_pages) {
    if (config.max_landing_pages === -1) features.push({ text: "Unlimited landing pages", included: true });
    else if (config.max_landing_pages > 0) features.push({ text: `Up to ${config.max_landing_pages} landing pages`, included: true });
  }

  // Live sessions
  if (config.feature_go_live) {
    if (config.max_live_sessions === -1) features.push({ text: "Unlimited live sessions", included: true });
    else if (config.max_live_sessions > 0) features.push({ text: `Up to ${config.max_live_sessions} live sessions`, included: true });
  }

  // Storage
  const storageText = formatStorage(config.max_storage_mb);
  if (storageText) features.push({ text: storageText, included: true });

  // Daily views — always show with tooltip. May be overridden by selected tier at render time.
  const dv = formatDailyViews(config.daily_view_limit);
  if (dv) features.push({ text: dv.text, included: true, tooltip: dv.tooltip, isDailyViews: true } as any);

  // Feature toggles (admin source of truth)
  features.push({ text: "YouTube video import", included: !!config.feature_youtube_import });
  features.push({ text: "Video sharing", included: !!config.feature_video_sharing });
  features.push({ text: "Custom branding", included: !!config.feature_custom_branding });
  features.push({ text: "Lead capture", included: !!config.feature_lead_capture });
  features.push({ text: "WhatsApp auto-message", included: !!config.feature_whatsapp_automation });
  features.push({ text: "Smart follow-up reminders", included: !!config.feature_smart_reminders });
  features.push({ text: "Live broadcast", included: !!config.feature_go_live });
  features.push({ text: "Analytics dashboard", included: !!config.feature_analytics });
  features.push({ text: "Per-prospect watch analytics", included: !!config.feature_prospect_analytics });
  features.push({ text: "Team dashboard", included: !!config.feature_team_analytics });
  features.push({ text: "Priority support", included: !!config.feature_priority_support });

  return features;
};

export const PricingSection = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { plan: userPlan, refreshPlan } = usePlan();
  const { isMember: isNevoraiMember } = useNevoraiMember();
  const { openSupport } = useWhatsAppSupport();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const isCurrentTier = (t: string) => userPlan.isPaid && userPlan.tier === t && !userPlan.isExpired;
  const onBasic = isCurrentTier("basic") || (!userPlan.isPaid && isNevoraiMember);
  const onPro = isCurrentTier("pro");

  const { data: planConfigs = [] } = useQuery({
    queryKey: ["plan-configs-landing"],
    queryFn: async () => {
      const { data } = await supabase.from("plan_config").select("*");
      return (data || []) as any[];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // View tiers per plan (Basic / Pro). Used to derive the base tier price + daily views
  // shown on each card. Tier selection happens inside the app on the billing page.
  const { data: viewTiers = [] } = useQuery({
    queryKey: ["plan-view-tiers-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plan_view_tiers" as any)
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      return (data || []) as any[];
    },
    staleTime: 60_000,
  });

  // Resolve base tier for a plan: explicit `is_base` flag → lowest daily_views fallback.
  const getBaseTier = (planName: string) => {
    const planTiers = viewTiers.filter((t: any) => t.plan_name === planName.toLowerCase());
    if (!planTiers.length) return null;
    const explicit = planTiers.find((t: any) => t.is_base);
    if (explicit) return explicit;
    return [...planTiers].sort(
      (a: any, b: any) => (a.daily_views || 0) - (b.daily_views || 0),
    )[0];
  };

  const loadRazorpayScript = (): Promise<boolean> => new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

  const handlePlanClick = useCallback(async (planName: string) => {
    const lname = planName.toLowerCase();
    // Guard: don't let users re-purchase the plan they're already on
    if ((lname === "basic" && onBasic) || (lname === "pro" && onPro)) {
      toast.info("You're already on this plan.");
      return;
    }
    if (planName === "Free") {
      navigate(user ? "/dashboard" : "/auth?tab=signup");
      return;
    }
    if (!user) {
      // After login, return user to /pricing where checkout opens via the same flow
      navigate(`/auth?tab=signup&redirect=/pricing&plan=${planName.toLowerCase()}`);
      return;
    }
    const config = planConfigs.find((c: any) => c.plan_name === planName.toLowerCase());
    if (!config) {
      toast.error("Plan not available right now.");
      return;
    }
    const planKey = `${planName.toLowerCase()}_monthly`;
    setLoadingPlan(planKey);
    try {
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error("Failed to load payment gateway");
      // tier_id omitted on signup → server resolves the plan's base tier automatically.
      const { data, error } = await supabase.functions.invoke("razorpay-portal", {
        body: { action: "create_order", plan_key: planKey },
      });
      if (error || !data?.order_id) {
        const message = await getSupabaseFunctionErrorMessage(error, data?.error || "Failed to create order");
        throw new Error(message);
      }

      const requiresUpgradePricing = planName === "Pro" && userPlan.isPaid && userPlan.tier === "basic" && !userPlan.isExpired;
      if (requiresUpgradePricing && !data.is_plan_upgrade) {
        throw new Error("Upgrade pricing could not be calculated. Full-price checkout was blocked.");
      }

      const payableToday = Number(data.prorated_charge ?? (Number(data.amount) / 100));

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: "Nevorai Flow",
        description: data.is_plan_upgrade
          ? `Upgrade to ${planName} — pay ₹${payableToday} today for ${data.days_remaining} day${data.days_remaining === 1 ? "" : "s"} left (renews at ₹${data.target_price}/mo)`
          : `${planName} Plan — monthly`,
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
            toast.success(`Payment successful! Welcome to ${planName} 🎉`, { duration: 6000 });
            refreshPlan();
            setTimeout(() => navigate("/billing"), 1500);
          } catch {
            toast.error("Payment received but verification pending. Contact support.");
            openSupport(`Hi, my ${planName} payment was successful but access not unlocked. Payment ID: ${response.razorpay_payment_id}`);
          }
        },
        prefill: {
          name: profile?.full_name || "",
          email: user.email,
          contact: profile?.phone || "",
        },
        theme: { color: "#2563EB" },
        modal: { ondismiss: () => setLoadingPlan(null) },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", () => {
        toast.error("Payment failed. Please try again.");
        setLoadingPlan(null);
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
      setLoadingPlan(null);
    }
  }, [user, profile, planConfigs, navigate, openSupport, refreshPlan]);


  const freeConfig = planConfigs.find((c: any) => c.plan_name === "free");
  const basicConfig = planConfigs.find((c: any) => c.plan_name === "basic");
  const proConfig = planConfigs.find((c: any) => c.plan_name === "pro");
  const basicEnabled = basicConfig?.is_enabled !== false && !!basicConfig;
  const proEnabled = proConfig?.is_enabled !== false && !!proConfig;

  const cards: {
    name: string;
    price: string;
    period: string;
    daily: string;
    badge: string | null;
    features: { text: string; included: boolean; tooltip?: string }[];
    cta: string;
    variant: "outline" | "default" | "hero";
    highlight: boolean;
  }[] = [];

  // Free card — fully driven by admin plan_config row. Always shown first
  // when its plan_config row is enabled.
  if (freeConfig && freeConfig.is_enabled !== false) {
    cards.push({
      name: "Free",
      price: "₹0",
      period: "/forever",
      daily: freeConfig.daily_view_limit && freeConfig.daily_view_limit > 0
        ? `${Number(freeConfig.daily_view_limit).toLocaleString("en-IN")} views/day`
        : "Start building free",
      badge: freeConfig.plan_badge_text || null,
      features: buildFreeFeatures(freeConfig),
      cta: FREE_CTA,
      variant: FREE_VARIANT,
      highlight: false,
    });
  }

  // Replace the generic "X views/day total" feature line with copy that makes
  // it obvious the cap is the *starting* tier and can be upgraded in-app.
  const overrideDailyViewsBase = (
    feats: ReturnType<typeof buildFeatures>,
    baseTier: any,
  ) => {
    if (!baseTier?.daily_views) return feats;
    return feats.map((f: any) =>
      f.isDailyViews
        ? {
            ...f,
            text: `Daily view limit — starts at ${Number(baseTier.daily_views).toLocaleString("en-IN")}/day, upgrade inside app`,
          }
        : f,
    );
  };

  if (basicEnabled && basicConfig) {
    const baseTier = getBaseTier("Basic");
    const price = baseTier?.monthly_price ?? 149;
    cards.push({
      name: "Basic",
      price: `₹${Number(price).toLocaleString("en-IN")}`,
      period: "/month",
      daily: baseTier?.daily_views
        ? `Starts at ${baseTier.daily_views} views/day · upgrade anytime`
        : "",
      badge: basicConfig.plan_badge_text || null,
      features: overrideDailyViewsBase(buildFeatures(basicConfig), baseTier),
      cta: "Get Basic",
      variant: "default",
      highlight: false,
    });
  }

  if (proEnabled && proConfig) {
    const baseTier = getBaseTier("Pro");
    const price = baseTier?.monthly_price ?? 599;
    cards.push({
      name: "Pro",
      price: `₹${Number(price).toLocaleString("en-IN")}`,
      period: "/month",
      daily: baseTier?.daily_views
        ? `Starts at ${baseTier.daily_views} views/day · upgrade anytime`
        : "",
      badge: proConfig.plan_badge_text || "Most Popular",
      features: overrideDailyViewsBase(buildFeatures(proConfig), baseTier),
      cta: "Go Pro",
      variant: "hero",
      highlight: true,
    });
  }

  // Enterprise card content (DB-driven)
  const { data: enterpriseConfig } = useQuery({
    queryKey: ["enterprise-plan-config-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("enterprise_plan_config" as any)
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      return data as any;
    },
    staleTime: 120_000, // 2-minute cache per spec
  });

  // Enterprise WhatsApp contact settings (admin-controlled)
  const { data: enterpriseWa } = useQuery({
    queryKey: ["enterprise-whatsapp-settings-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings" as any)
        .select("key, value")
        .in("key", ["enterprise_whatsapp_number", "enterprise_whatsapp_message"]);
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => { map[s.key] = s.value || ""; });
      return {
        number: (map.enterprise_whatsapp_number || "").replace(/\D/g, ""),
        message: map.enterprise_whatsapp_message
          || "Hi! I'm interested in the Enterprise plan for Nevorai Flow. I want to build a dedicated app for my network team. Can you share more details?",
      };
    },
    staleTime: 120_000,
  });

  const enterpriseVisible = enterpriseConfig?.is_visible !== false;
  const enterpriseFeaturesRaw: { text: string; enabled: boolean }[] = Array.isArray(
    enterpriseConfig?.features,
  )
    ? enterpriseConfig.features
    : [];
  const enterpriseFeatures = enterpriseFeaturesRaw.filter((f) => f?.enabled && f?.text);

  const totalCards = cards.length + (enterpriseVisible ? 1 : 0);
  const gridCols =
    totalCards === 1
      ? "max-w-md mx-auto"
      : totalCards === 2
      ? "md:grid-cols-2 max-w-3xl mx-auto"
      : totalCards === 3
      ? "md:grid-cols-3 max-w-5xl mx-auto"
      : "md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto";

  return (
    <section id="pricing" className="py-24 relative">
      <div className="container-app">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
            Start Free. <span className="text-gradient-brand">Upgrade When You Get Results.</span>
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Pick the plan that fits your network size. Start free — no credit card needed.
          </p>
        </motion.div>

        {/* Build all card render nodes once, used by both mobile carousel and desktop grid */}
        {(() => {
          const planNodes: { key: string; node: ReactNode }[] = cards.map((plan, i) => ({
            key: plan.name,
            node: (
              <motion.div
                key={plan.name}
                className={`glass-card p-6 relative flex flex-col h-full ${
                  plan.highlight ? "border-primary/40 glow-primary" : ""
                }`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gradient-primary text-xs font-semibold text-primary-foreground shadow-md whitespace-nowrap z-10">
                    {plan.badge}
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="text-lg font-heading font-semibold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[13px] text-muted-foreground/70 font-normal">from</span>
                    <span className="text-3xl font-heading font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  {plan.daily ? (
                    <p className="text-xs text-primary mt-1.5">{plan.daily}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1.5">{"\u00A0"}</p>
                  )}
                </div>
                {/* Cap list height on both mobile and desktop so all cards stay
                    visually balanced. Internal scroll keeps the grid aligned. */}
                <ul className="space-y-3 mb-6 max-h-[260px] md:max-h-[340px] overflow-y-auto pr-1 md:flex-1">
                  {plan.features.map((f) => (
                    <li key={f.text} className="flex items-center gap-2 text-sm">
                      {f.included ? (
                        <Check size={16} className="text-success shrink-0" />
                      ) : (
                        <X size={16} className="text-muted-foreground/40 shrink-0" />
                      )}
                      <span className={f.included ? "text-foreground" : "text-muted-foreground/60"}>
                        {f.text}
                      </span>
                      {(f as any).tooltip && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                                <Info size={11} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px] text-xs">
                              {(f as any).tooltip}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </li>
                  ))}
                </ul>
                {(() => {
                  const lname = plan.name.toLowerCase();
                  if (lname === "free") {
                    if (!user || (!userPlan.isPaid && !isNevoraiMember)) {
                      return (
                        <Button variant={plan.variant} className="w-full gap-2" onClick={() => handlePlanClick(plan.name)}>
                          {plan.cta}
                        </Button>
                      );
                    }
                    return <Button variant="outline" disabled className="w-full">Current Plan</Button>;
                  }
                  if (lname === "basic") {
                    if (onBasic) {
                      return (
                        <Button disabled className="w-full gap-2">
                          {isNevoraiMember && !userPlan.isPaid ? (<><Sparkles size={14} /> Active via Nevorai membership</>) : "Current Plan"}
                        </Button>
                      );
                    }
                    if (onPro) return <Button disabled variant="outline" className="w-full">Included in Pro</Button>;
                  }
                  if (lname === "pro" && onPro) {
                    return <Button disabled className="w-full">Current Plan</Button>;
                  }
                  const isUpgrade = lname === "pro" && onBasic;
                  return (
                    <Button
                      variant={plan.variant}
                      className="w-full gap-2"
                      onClick={() => handlePlanClick(plan.name)}
                      disabled={loadingPlan === `${lname}_monthly`}
                    >
                      {loadingPlan === `${lname}_monthly` && <Loader2 size={16} className="animate-spin" />}
                      {isUpgrade ? <><ArrowUp size={14} /> Upgrade to Pro</> : plan.cta}
                    </Button>
                  );
                })()}
              </motion.div>
            ),
          }));

          const enterpriseNode: ReactNode = enterpriseVisible ? (
            <motion.div
              className="relative flex flex-col h-full p-6 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/[0.06] via-background to-background shadow-[0_0_40px_-15px_rgba(245,158,11,0.4)]"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: cards.length * 0.1 }}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-xs font-semibold text-background flex items-center gap-1 whitespace-nowrap shadow-md z-10">
                <Crown size={12} /> {enterpriseConfig?.badge_text || "For Large Networks"}
              </div>
              <div className="mb-5">
                <h3 className="text-lg font-heading font-semibold mb-1">Enterprise</h3>
                <p className="text-[11px] text-amber-500 font-medium mb-2">
                  {enterpriseConfig?.subheading || "100+ active team members"}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-heading font-bold">
                    ₹{(enterpriseConfig?.monthly_price ?? 5999).toLocaleString("en-IN")}
                  </span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                {enterpriseConfig?.price_note ? (
                  <p className="text-xs text-amber-500 mt-1">{enterpriseConfig.price_note}</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">&nbsp;</p>
                )}
              </div>
              {/* Same height cap on desktop so all four cards stay aligned. */}
              <ul className="space-y-3 mb-6 max-h-[260px] md:max-h-[340px] overflow-y-auto pr-1 md:flex-1">
                {(enterpriseFeatures.length > 0
                  ? enterpriseFeatures
                  : [{ text: "Loading…", enabled: true }]
                ).map((f, idx) => (
                  <li key={`${f.text}-${idx}`} className="flex items-center gap-2 text-sm">
                    <Check size={16} className="text-amber-500 shrink-0" />
                    <span className="text-foreground">{f.text}</span>
                  </li>
                ))}
              </ul>
              {(() => {
                const num = enterpriseWa?.number || "";
                const msg = enterpriseWa?.message || "";
                const waLink = num
                  ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
                  : null;
                const ctaLabel = enterpriseConfig?.cta_text || "Chat on WhatsApp";
                if (!waLink) {
                  return (
                    <Link to="/enterprise">
                      <Button
                        variant="outline"
                        className="w-full border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-500"
                      >
                        {ctaLabel}
                      </Button>
                    </Link>
                  );
                }
                return (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-white text-sm transition-all hover:opacity-90 bg-gradient-to-br from-[#25D366] to-[#128C7E] min-h-11"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                      <path fillRule="evenodd" d="M12 0C5.373 0 0 5.373 0 12c0 2.126.554 4.122 1.522 5.854L0 24l6.336-1.49A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.838 9.838 0 01-5.011-1.369l-.36-.214-3.732.878.944-3.641-.235-.374A9.834 9.834 0 012.118 12C2.118 6.53 6.53 2.118 12 2.118 17.47 2.118 21.882 6.53 21.882 12c0 5.47-4.412 9.882-9.882 9.882z" />
                    </svg>
                    {ctaLabel.toLowerCase().includes("whatsapp") ? ctaLabel : "Chat on WhatsApp"} →
                  </a>
                );
              })()}
            </motion.div>
          ) : null;

          const allNodes: { key: string; node: ReactNode }[] = [
            ...planNodes,
            ...(enterpriseNode ? [{ key: "enterprise", node: enterpriseNode }] : []),
          ];

          return (
            <>
              {/* Mobile: swipeable carousel with dots */}
              <MobilePricingCarousel items={allNodes} />

              {/* Desktop: original grid */}
              <div className={`hidden md:grid gap-6 ${gridCols}`}>
                {allNodes.map((n) => (
                  <div key={n.key} className="h-full">
                    {n.node}
                  </div>
                ))}
              </div>
            </>
          );
        })()}

        {/* Disclaimer */}
        <p className="text-center text-xs mt-6 max-w-lg mx-auto text-hero-muted">
          * Conversion rates based on video funnels with lead capture and WhatsApp follow-up enabled. Results vary based on content quality and audience.
        </p>
      </div>
    </section>
  );
};

// Mobile-only swipeable pricing carousel with dot indicators.
// Kept inside this file (not extracted) to keep the change scoped to one
// component, per the user's UI-only request.
const MobilePricingCarousel = ({ items }: { items: { key: string; node: ReactNode }[] }) => {
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!api) return;
    setActive(api.selectedScrollSnap());
    const onSelect = () => setActive(api.selectedScrollSnap());
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  return (
    <div className="md:hidden">
      {/* py-4 on the carousel gives breathing room so the absolute -top-3 badges
          aren't clipped by Embla's overflow-hidden viewport. items-stretch is
          removed by passing no extra classes — children size to their own
          content (md:h-full only kicks in on desktop). */}
      <Carousel setApi={setApi} opts={{ align: "center", loop: false }} className="w-full">
        <CarouselContent className="-ml-4 py-4 items-stretch">
          {items.map((it) => (
            <CarouselItem key={it.key} className="pl-4 basis-[88%] sm:basis-[70%] h-auto">
              {it.node}
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <div className="flex items-center justify-center gap-2 mt-3">
        {items.map((it, i) => (
          <button
            key={it.key}
            type="button"
            aria-label={`Show ${it.key} plan`}
            onClick={() => api?.scrollTo(i)}
            className={cn(
              "h-2 rounded-full transition-all",
              active === i ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30",
            )}
          />
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-2">Swipe to compare plans</p>
    </div>
  );
};
