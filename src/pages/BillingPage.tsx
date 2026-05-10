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
  CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw, Shield,
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RefundRequestModal } from "@/components/RefundRequestModal";
import { TopUpViewsCard } from "@/components/TopUpViewsCard";
import { ViewCapacityCard } from "@/components/billing/ViewCapacityCard";

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  active: { label: "Active", icon: CheckCircle2, color: "text-green-600" },
  expired: { label: "Expired", icon: XCircle, color: "text-destructive" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-muted-foreground" },
  payment_failed: { label: "Payment Failed", icon: AlertTriangle, color: "text-amber-600" },
  pending: { label: "Pending", icon: Clock, color: "text-amber-600" },
  replaced: { label: "Replaced", icon: RefreshCw, color: "text-muted-foreground" },
};

const BillingPage = () => {
  const { plan, isLoading } = usePlan();
  const { user, profile } = useAuth();
  const { isMember } = useNevoraiMember();
  const { openSupport } = useWhatsAppSupport();
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const status = statusConfig[plan.status] || statusConfig.active;
  const StatusIcon = status.icon;

  // Check existing refund request
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

  // Compute guarantee window from started_at.
  // Nevorai Members didn't pay — guarantee does not apply to them.
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
        <div className="max-w-6xl space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="glass-card p-6 space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-5 bg-muted animate-pulse rounded w-3/4" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold">Billing</h1>
            <div className="page-header-accent" />
          </div>
          {plan.isPaid && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5 border-primary/30 text-primary">
                <Crown size={12} /> {plan.tier === "pro" ? "Individual" : "Basic"} Plan
              </Badge>
              {isMember && <NevoraiMemberBadge size="md" />}
            </div>
          )}
        </div>

        {/* 7-day guarantee window banner */}
        {inGuaranteeWindow && startedAt && guaranteeExpiresAt && (
          <div className="rounded-2xl p-5 border border-emerald-500/30 bg-emerald-500/[0.06] space-y-3">
            <div className="flex items-start gap-3">
              <Shield className="text-emerald-500 shrink-0 mt-0.5" size={20} />
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-foreground">You're within your 7-day guarantee window.</p>
                <p className="text-xs text-muted-foreground">
                  Subscribed on {format(startedAt, "dd MMM yyyy")} · Guarantee valid until {format(guaranteeExpiresAt, "dd MMM yyyy")}
                </p>
                <p className="text-sm text-muted-foreground pt-1">Not satisfied? Request a refund — no questions asked.</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"
              onClick={() => setRefundModalOpen(true)}
            >
              Request Refund
            </Button>
          </div>
        )}

        {/* Existing refund-request status banner */}
        {existingRefund && (
          <div className="rounded-2xl p-4 border border-border bg-muted/30 flex items-start gap-3">
            <Clock className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <div className="flex-1 text-sm">
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

        {/* Plan Status Card */}
        <div className="glass-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${plan.isPaid ? "bg-primary/10" : "bg-muted"}`}>
                <CreditCard size={20} className={plan.isPaid ? "text-primary" : "text-muted-foreground"} />
              </div>
              <div>
                <p className="font-medium capitalize">{plan.planKey.replace(/_/g, " ")}</p>
                <div className="flex items-center gap-1.5">
                  <StatusIcon size={13} className={status.color} />
                  <span className={`text-xs ${status.color}`}>{status.label}</span>
                </div>
              </div>
            </div>
            {isMember ? (
              <div className="text-right">
                <p className="text-xl font-heading font-bold">₹0</p>
                <p className="text-[11px] text-muted-foreground">Included with Nevorai Pro</p>
              </div>
            ) : plan.amountPaid && plan.amountPaid > 0 ? (
              <p className="text-xl font-heading font-bold">₹{plan.amountPaid}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            {plan.startedAt && (
              <div>
                <p className="text-muted-foreground text-xs">Started</p>
                <p className="font-medium">{format(new Date(plan.startedAt), "dd MMM yyyy")}</p>
              </div>
            )}
            {plan.expiresAt && (
              <div>
                <p className="text-muted-foreground text-xs">Expires</p>
                <p className="font-medium">{format(new Date(plan.expiresAt), "dd MMM yyyy")}</p>
              </div>
            )}
            {plan.billingType && (
              <div>
                <p className="text-muted-foreground text-xs">Billing</p>
                <p className="font-medium capitalize">{plan.billingType.replace(/_/g, " ")}</p>
              </div>
            )}
            {plan.daysLeft !== null && plan.daysLeft > 0 && (
              <div>
                <p className="text-muted-foreground text-xs">Days Left</p>
                <p className={`font-medium ${plan.isExpiringSoon ? "text-amber-600" : ""}`}>{plan.daysLeft}</p>
              </div>
            )}
          </div>

          {plan.razorpayPaymentId && !isMember && (
            <div className="text-xs text-muted-foreground border-t border-border pt-3">
              Payment ID: {plan.razorpayPaymentId}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {/* Members already have Individual; show only the Leaders upsell (future plan).
              Non-members see standard Upgrade/Renew CTA. */}
          {!isMember && (!plan.isPaid || plan.isExpired || plan.isExpiringSoon) && (
            <Link to="/upgrade">
              <Button className="gap-2">
                {plan.isExpired ? "Renew Plan" : plan.isExpiringSoon ? "Renew Now" : "Upgrade to Pro"}
                <ArrowRight size={16} />
              </Button>
            </Link>
          )}
          <Button variant="outline" className="gap-2" onClick={() => openSupport("Hi, I have a billing question about my nFlow account.")}>
            <MessageCircle size={16} /> Contact Support
          </Button>
        </div>

        {/* View capacity upgrades (in-app tier picker) */}
        <ViewCapacityCard />

        {/* Top-up extra views */}
        <TopUpViewsCard />

        {/* Support prompt for payment issues */}
        {plan.status === "payment_failed" && (
          <div className="glass-card p-5 border-destructive/20 bg-destructive/5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              <p className="font-medium text-destructive">Payment failed</p>
            </div>
            <p className="text-sm text-muted-foreground">Your last payment didn't go through. Please try again or contact support.</p>
            <div className="flex gap-3">
              <Link to="/upgrade"><Button size="sm">Retry Payment</Button></Link>
              <Button size="sm" variant="outline" onClick={() => openSupport("Hi, my payment failed on nFlow. Can you help?")}>
                <MessageCircle size={14} className="mr-1.5" /> Get Help
              </Button>
            </div>
          </div>
        )}

        {plan.isPaid && !plan.isExpired && plan.status === "active" && (
          <div className="glass-card p-5 bg-primary/5 border-primary/10">
            <p className="text-sm text-muted-foreground">
              Need to change or cancel your plan? <button className="text-primary underline" onClick={() => openSupport("Hi, I'd like to change/cancel my nFlow plan.")}>Contact support</button> and we'll help you right away.
            </p>
          </div>
        )}
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
