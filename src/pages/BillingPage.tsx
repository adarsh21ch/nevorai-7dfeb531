import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { usePlan } from "@/hooks/usePlan";
import { useWhatsAppSupport } from "@/hooks/useWhatsAppSupport";
import { useAuth } from "@/hooks/useAuth";
import { useNevoraiMember } from "@/hooks/useNevoraiMember";
import { useStorageUsage } from "@/hooks/useStorageUsage";
import { NevoraiMemberBadge } from "@/components/NevoraiMemberBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";
import {
  CreditCard, Crown, ArrowRight, MessageCircle,
  CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw, HardDrive, Check,
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RefundRequestModal } from "@/components/RefundRequestModal";
import { StorageUsageCard } from "@/components/StorageUsageCard";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  active:        { label: "Active",         icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
  expired:       { label: "Expired",        icon: XCircle,      color: "text-destructive", bg: "bg-destructive/10 border-destructive/20" },
  cancelled:     { label: "Cancelled",      icon: XCircle,      color: "text-muted-foreground", bg: "bg-muted/30 border-border" },
  payment_failed:{ label: "Payment Failed", icon: AlertTriangle,color: "text-amber-500",   bg: "bg-amber-500/10 border-amber-500/20" },
  pending:       { label: "Pending",        icon: Clock,        color: "text-amber-500",   bg: "bg-amber-500/10 border-amber-500/20" },
  replaced:      { label: "Replaced",       icon: RefreshCw,    color: "text-muted-foreground", bg: "bg-muted/30 border-border" },
};

const PLAN_LABEL: Record<string, string> = { free: "Free", basic: "Basic", pro: "Individual", trial: "Trial" };

interface PlanRow {
  plan_name: string;
  price_monthly: number | null;
  max_storage_mb: number | null;
  max_funnels: number | null;
  max_landing_pages: number | null;
  max_live_sessions: number | null;
  feature_lead_capture?: boolean | null;
  feature_whatsapp_automation?: boolean | null;
  feature_landing_pages?: boolean | null;
  feature_go_live?: boolean | null;
  feature_speaker_profile?: boolean | null;
  feature_advanced_analytics?: boolean | null;
  feature_analytics?: boolean | null;
}

const fmtStorage = (mb: number | null) => {
  if (!mb || mb <= 0) return "—";
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
  return `${mb} MB`;
};
const fmtFunnels = (n: number | null) => (n === -1 ? "Unlimited" : n ?? "—");

const buildFeatures = (p: PlanRow): string[] => {
  const items: string[] = [];
  items.push(`${fmtStorage(p.max_storage_mb)} storage`);
  items.push(p.max_funnels === -1 ? "Unlimited funnels" : `${p.max_funnels ?? 0} funnels`);
  if (p.feature_landing_pages) {
    items.push(p.max_landing_pages === -1 ? "Unlimited landing pages" : `${p.max_landing_pages ?? 0} landing pages`);
  }
  if (p.feature_go_live) {
    items.push(p.max_live_sessions === -1 ? "Unlimited live sessions" : `${p.max_live_sessions ?? 0} live sessions`);
  }
  if (p.feature_lead_capture) items.push("Lead capture");
  if (p.feature_whatsapp_automation) items.push("WhatsApp share & automation");
  if (p.feature_speaker_profile) items.push("Speaker profile");
  if (p.feature_advanced_analytics) items.push("Advanced analytics");
  else if (p.feature_analytics) items.push("Analytics");
  return items;
};

const BillingPage = () => {
  const { plan, isLoading } = usePlan();
  const { user } = useAuth();
  const { isMember } = useNevoraiMember();
  const { openSupport } = useWhatsAppSupport();
  const storage = useStorageUsage();
  const [refundModalOpen, setRefundModalOpen] = useState(false);

  const status = statusConfig[plan.status] || statusConfig.active;
  const StatusIcon = status.icon;
  const planLabel = PLAN_LABEL[plan.tier] || plan.tier;

  const { data: existingRefund, refetch: refetchRefund } = useQuery({
    queryKey: ["refund-request", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("refund_requests")
        .select("id, status, requested_at")
        .eq("user_id", user.id)
        .in("status", ["pending", "approved"])
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: tierPlans } = useQuery({
    queryKey: ["billing-tier-plans"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("plan_config")
        .select("*")
        .in("plan_name", ["basic", "growth", "pro"]);
      return (data ?? []) as PlanRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const basicPlan = tierPlans?.find(p => p.plan_name === "basic");
  const growthPlan = tierPlans?.find(p => p.plan_name === "growth");
  const proPlan = tierPlans?.find(p => p.plan_name === "pro");

  const startedAt = plan.startedAt ? new Date(plan.startedAt) : null;
  const guaranteeExpiresAt = startedAt ? new Date(startedAt.getTime() + 7 * 86400_000) : null;
  const now = new Date();
  const inGuaranteeWindow =
    plan.isPaid &&
    plan.status === "active" &&
    !isMember &&
    plan.billingType !== "nevorai_member" &&
    !!guaranteeExpiresAt &&
    now < guaranteeExpiresAt &&
    !existingRefund;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-5xl space-y-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="glass-card p-6 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-5 bg-muted animate-pulse rounded w-3/4" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const currentTier = plan.tier; // free | basic | pro | trial

  // Plan ordering for upgrade/downgrade logic
  const TIER_RANK: Record<string, number> = { free: 0, basic: 1, growth: 2, pro: 3, trial: 3 };
  const currentRank = TIER_RANK[currentTier] ?? 0;

  const renderTierCard = (p: PlanRow | undefined, label: string, accent: boolean) => {
    if (!p) return null;
    const planRank = TIER_RANK[p.plan_name] ?? 0;
    const isCurrent =
      (p.plan_name === currentTier) ||
      (p.plan_name === "pro" && currentTier === "trial");
    const features = buildFeatures(p);
    // Hide cards strictly below the user's current paid tier (e.g. on Pro, don't show Basic/Growth)
    const isBelowCurrent = planRank < currentRank && currentTier !== "free" && currentTier !== "trial";

    return (
      <div
        className={cn(
          "glass-card p-6 flex flex-col gap-4 relative",
          accent && "border-primary/30 bg-gradient-to-br from-primary/[0.04] to-transparent",
        )}
      >
        {accent && (
          <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            Recommended
          </span>
        )}
        <div>
          <h3 className="font-heading font-bold text-lg">{label}</h3>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-heading font-bold">₹{p.price_monthly ?? "—"}</span>
            <span className="text-sm text-muted-foreground">/ month</span>
          </div>
        </div>

        <ul className="space-y-2 text-sm flex-1">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check size={15} className="text-emerald-500 mt-0.5 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {isCurrent ? (
          <Badge variant="outline" className="w-full justify-center py-2 border-emerald-500/30 text-emerald-600 bg-emerald-500/5">
            <CheckCircle2 size={13} className="mr-1.5" /> Current Plan
          </Badge>
        ) : isBelowCurrent ? null : (
          <Link to="/upgrade">
            <Button className="w-full gap-1.5" variant={accent ? "default" : "outline"}>
              Upgrade to {label}
              <ArrowRight size={14} />
            </Button>
          </Link>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-heading font-bold">Billing</h1>
            <div className="page-header-accent" />
          </div>
          {plan.isPaid && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5 border-primary/30 text-primary">
                <Crown size={12} /> {planLabel}
              </Badge>
              {isMember && <NevoraiMemberBadge size="md" />}
            </div>
          )}
        </div>

        {/* Storage usage */}
        <StorageUsageCard />

        {/* Refund-request status banner */}
        {existingRefund && (
          <div className="rounded-xl p-3 border border-border bg-muted/20 flex items-start gap-3 text-sm">
            <Clock className="text-amber-500 shrink-0 mt-0.5" size={16} />
            <div className="flex-1">
              <p className="font-medium">
                Refund request {existingRefund.status === "approved" ? "approved" : "pending review"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Submitted on {format(new Date(existingRefund.requested_at), "dd MMM yyyy")}.
                {existingRefund.status === "pending" && " We'll process it within 24 hours."}
                {existingRefund.status === "approved" && " Refund will reflect in 5–7 business days."}
              </p>
            </div>
          </div>
        )}

        {/* Plan summary card */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${plan.isPaid ? "bg-primary/10" : "bg-muted"}`}>
              <CreditCard size={16} className={plan.isPaid ? "text-primary" : "text-muted-foreground"} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold capitalize truncate">{planLabel} plan</p>
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${status.bg} ${status.color}`}>
                  <StatusIcon size={10} /> {status.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground capitalize">
                {plan.billingType ? plan.billingType.replace(/_/g, " ") : "—"}
              </p>
            </div>
            {isMember ? (
              <div className="text-right">
                <p className="text-lg font-heading font-bold">₹0</p>
                <p className="text-[10px] text-muted-foreground">Included</p>
              </div>
            ) : plan.amountPaid && plan.amountPaid > 0 ? (
              <div className="text-right">
                <p className="text-lg font-heading font-bold">₹{plan.amountPaid}</p>
                <p className="text-[10px] text-muted-foreground">last paid</p>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm border-t border-border pt-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Started</p>
              <p className="font-medium mt-0.5">{plan.startedAt ? format(new Date(plan.startedAt), "dd MMM yyyy") : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Renews / Expires</p>
              <p className={`font-medium mt-0.5 ${plan.isExpiringSoon ? "text-amber-500" : ""}`}>
                {plan.expiresAt ? format(new Date(plan.expiresAt), "dd MMM yyyy") : "—"}
                {plan.daysLeft !== null && plan.daysLeft > 0 && (
                  <span className="text-[11px] text-muted-foreground"> · {plan.daysLeft}d left</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Storage</p>
              <p className="font-medium mt-0.5 flex items-center gap-1.5">
                <HardDrive size={12} className="text-muted-foreground" />
                {storage.isLoading
                  ? "—"
                  : `${storage.usedGB.toFixed(2)} / ${storage.limitGB >= 1 ? storage.limitGB + " GB" : storage.limitMB + " MB"}`}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Funnels</p>
              <p className="font-medium mt-0.5">{fmtFunnels(plan.limits.funnel_limit)}</p>
            </div>
          </div>
        </div>

        {/* Choose Your Plan — two tier cards */}
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-heading font-bold">Choose your plan</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Storage-based pricing. No view limits. Cancel anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderTierCard(basicPlan, "Basic", false)}
            {renderTierCard(growthPlan, "Growth", false)}
            {renderTierCard(proPlan, "Pro", true)}
          </div>

          {currentTier === "pro" && (
            <p className="text-xs text-center text-muted-foreground pt-1">
              You're on our highest tier. 🎉 Thanks for being a Pro member.
            </p>
          )}
        </div>

        {/* Payment failure prompt */}
        {plan.status === "payment_failed" && (
          <div className="glass-card p-4 border border-destructive/20 bg-destructive/5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-destructive" />
              <p className="font-medium text-destructive text-sm">Payment failed</p>
            </div>
            <p className="text-xs text-muted-foreground">Your last payment didn't go through. Please retry or contact support.</p>
            <div className="flex gap-2">
              <Link to="/upgrade"><Button size="sm">Retry Payment</Button></Link>
              <Button size="sm" variant="outline" onClick={() => openSupport("Hi, my payment failed on Nevorai. Can you help?")}>
                <MessageCircle size={13} className="mr-1.5" /> Get Help
              </Button>
            </div>
          </div>
        )}

        {/* Support footer */}
        <div className="text-xs text-muted-foreground text-center pt-2 pb-4 border-t border-border/40">
          Need to change, cancel,{" "}
          {inGuaranteeWindow ? (
            <>
              or{" "}
              <button
                className="text-foreground underline underline-offset-2 hover:text-primary transition-colors"
                onClick={() => setRefundModalOpen(true)}
              >
                request a refund
              </button>
              {" "}(within 7 days),{" "}
            </>
          ) : (
            "or "
          )}
          help with billing?{" "}
          <button
            className="text-primary underline underline-offset-2"
            onClick={() => openSupport("Hi, I have a billing question about my Nevorai account.")}
          >
            Contact support
          </button>
          .
        </div>
      </div>

      <RefundRequestModal
        open={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        onSuccess={() => refetchRefund()}
      />
    </DashboardLayout>
  );
};

export default BillingPage;
