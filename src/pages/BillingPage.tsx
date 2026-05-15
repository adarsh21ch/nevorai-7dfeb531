import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { usePlan } from "@/hooks/usePlan";
import { useWhatsAppSupport } from "@/hooks/useWhatsAppSupport";
import { useAuth } from "@/hooks/useAuth";
import { useNevoraiMember } from "@/hooks/useNevoraiMember";
import { NevoraiMemberBadge } from "@/components/NevoraiMemberBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";
import {
  CreditCard, Crown, ArrowRight, MessageCircle,
  CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw, Eye, Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RefundRequestModal } from "@/components/RefundRequestModal";
import { TopUpViewsCard } from "@/components/TopUpViewsCard";
import { ViewCapacityCard } from "@/components/billing/ViewCapacityCard";
import { StorageUsageCard } from "@/components/StorageUsageCard";

const statusConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  active:        { label: "Active",         icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
  expired:       { label: "Expired",        icon: XCircle,      color: "text-destructive", bg: "bg-destructive/10 border-destructive/20" },
  cancelled:     { label: "Cancelled",      icon: XCircle,      color: "text-muted-foreground", bg: "bg-muted/30 border-border" },
  payment_failed:{ label: "Payment Failed", icon: AlertTriangle,color: "text-amber-500",   bg: "bg-amber-500/10 border-amber-500/20" },
  pending:       { label: "Pending",        icon: Clock,        color: "text-amber-500",   bg: "bg-amber-500/10 border-amber-500/20" },
  replaced:      { label: "Replaced",       icon: RefreshCw,    color: "text-muted-foreground", bg: "bg-muted/30 border-border" },
};

const PLAN_LABEL: Record<string, string> = { free: "Free", basic: "Basic", pro: "Individual", trial: "Trial" };

const BillingPage = () => {
  const { plan, isLoading } = usePlan();
  const { user, profile } = useAuth();
  const { isMember } = useNevoraiMember();
  const { openSupport } = useWhatsAppSupport();
  const [refundModalOpen, setRefundModalOpen] = useState(false);

  const status = statusConfig[plan.status] || statusConfig.active;
  const StatusIcon = status.icon;
  const planLabel = PLAN_LABEL[plan.tier] || plan.tier;
  const dailyViews = (profile as any)?.selected_daily_views ?? null;

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

  // Pricing for Pro upgrade recommendation card
  const { data: proPrice } = useQuery({
    queryKey: ["pro-base-price"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plan_view_tiers" as any)
        .select("monthly_price")
        .eq("plan_name", "pro")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      return (data as any)?.monthly_price ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

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

  const showProUpgradeCard = plan.isPaid && plan.tier === "basic" && !plan.isExpired && !isMember;

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

        {/* Existing refund-request status banner */}
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

        {/* Compact current plan summary */}
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
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Daily views</p>
              <p className="font-medium mt-0.5 flex items-center gap-1.5">
                <Eye size={12} className="text-muted-foreground" />
                {dailyViews === -1 ? "Unlimited" : dailyViews ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Flows</p>
              <p className="font-medium mt-0.5">
                {plan.limits.funnel_limit === null || plan.limits.funnel_limit === -1 ? "Unlimited" : plan.limits.funnel_limit}
              </p>
            </div>
          </div>

          {(!plan.isPaid || plan.isExpired || plan.isExpiringSoon) && !isMember && (
            <div className="flex gap-2 mt-4 pt-4 border-t border-border">
              <Link to="/upgrade" className="flex-1 sm:flex-none">
                <Button size="sm" className="w-full gap-1.5">
                  {plan.isExpired ? "Renew Plan" : plan.isExpiringSoon ? "Renew Now" : "Upgrade Plan"}
                  <ArrowRight size={13} />
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Recommended: Basic → Pro upgrade */}
        {showProUpgradeCard && (
          <div className="glass-card p-5 border border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3 flex-1 min-w-[200px]">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles size={16} className="text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">Upgrade to Individual (Pro)</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">Recommended</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Unlock higher view limits, multi-step flows, live sessions, advanced analytics & priority support.
                  </p>
                  <div className="text-xs text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>Current: <span className="font-semibold text-foreground">Basic ₹{plan.amountPaid ?? "—"}/mo</span></span>
                    <ArrowRight size={11} />
                    <span>New: <span className="font-semibold text-foreground">Pro {proPrice ? `₹${proPrice}/mo` : ""}</span></span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/80 mt-1">
                    You'll only pay the prorated difference today. Final amount shown at checkout.
                  </p>
                </div>
              </div>
              <Link to="/upgrade">
                <Button className="gap-1.5 whitespace-nowrap">
                  Upgrade to Pro <ArrowRight size={14} />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Increase view limit (within current plan) */}
        <ViewCapacityCard />

        {/* One-time extra views top-up */}
        <TopUpViewsCard />

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

        {/* Subtle support line at the bottom */}
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
