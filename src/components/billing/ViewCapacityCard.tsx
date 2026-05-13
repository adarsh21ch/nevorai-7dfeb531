import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Eye, Check, Loader2, ArrowRight, Zap } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { calculateProratedUpgrade, formatProratedSummary } from "@/utils/prorateUpgrade";
import { getSupabaseFunctionErrorMessage } from "@/lib/supabase-function-error";

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

interface Tier {
  id: string;
  plan_name: string;
  daily_views: number;
  monthly_price: number;
  is_popular: boolean;
  is_base: boolean;
  display_order: number;
}

const fmt = (n: number) => n.toLocaleString("en-IN");

export function ViewCapacityCard() {
  const { user, profile } = useAuth();
  const { plan } = usePlan();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [confirmTier, setConfirmTier] = useState<Tier | null>(null);
  const [busy, setBusy] = useState(false);
  const [params] = useSearchParams();
  const ref = useRef<HTMLDivElement>(null);

  const planBase = (plan.tier === "trial" || plan.tier === "free") ? null : plan.tier;
  const currentDailyViews = (profile as any)?.selected_daily_views ?? null;
  const selectedTierId = (profile as any)?.selected_tier_id ?? null;
  const expiresAt = plan.expiresAt ? new Date(plan.expiresAt) : null;

  useEffect(() => {
    if (!planBase) return;
    (async () => {
      const { data } = await supabase
        .from("plan_view_tiers")
        .select("id, plan_name, daily_views, monthly_price, is_popular, is_base, display_order")
        .eq("plan_name", planBase)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      setTiers((data || []) as Tier[]);
    })();
  }, [planBase]);

  useEffect(() => {
    const wantsScroll = params.get("upgrade") === "views" || params.get("section") === "views";
    if (wantsScroll && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [params, tiers]);

  const currentTier = useMemo(
    () =>
      tiers.find((t) => t.id === selectedTierId)
      || tiers.find((t) => t.daily_views === currentDailyViews)
      || tiers.find((t) => t.is_base)
      || null,
    [tiers, selectedTierId, currentDailyViews]
  );

  const higherTiers = useMemo(() => {
    const baseline = currentTier?.daily_views ?? -Infinity;
    return tiers.filter((t) => (t.daily_views === -1 ? true : t.daily_views > baseline));
  }, [tiers, currentTier]);

  const prorated = useMemo(() => {
    if (!confirmTier || !currentTier || !expiresAt) return null;
    return calculateProratedUpgrade(currentTier.monthly_price, confirmTier.monthly_price, expiresAt);
  }, [confirmTier, currentTier, expiresAt]);

  if (!planBase || tiers.length === 0) return null;

  const handleConfirmUpgrade = async () => {
    if (!user || !confirmTier) return;
    setBusy(true);
    try {
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error("Failed to load payment gateway");

      const { data, error } = await supabase.functions.invoke("razorpay-portal", {
        body: { action: "create_tier_upgrade_order", tier_id: confirmTier.id },
      });
      if (error || !data?.order_id) {
        const msg = await getSupabaseFunctionErrorMessage(error, data?.error || "Failed to create order");
        throw new Error(msg);
      }

      const tier = confirmTier;
      const proratedCharge = data.prorated_charge as number;

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: "Nevorai Flow",
        description: `Upgrade to ${tier.daily_views}/day (prorated)`,
        order_id: data.order_id,
        handler: async (response: any) => {
          try {
            const { error: vErr, data: vData } = await supabase.functions.invoke("razorpay-portal", {
              body: {
                action: "verify_tier_upgrade",
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });
            if (vErr || !vData?.success) {
              const msg = await getSupabaseFunctionErrorMessage(vErr, vData?.error || "Verification failed");
              throw new Error(msg);
            }
            toast.success(`You're all set — now ${tier.daily_views} views/day!`);
            setConfirmTier(null);
            setTimeout(() => window.location.reload(), 1200);
          } catch (err: any) {
            toast.error(err?.message || "Payment received but not yet activated. Contact support.");
          }
        },
        prefill: {
          name: profile?.full_name || "",
          email: user.email,
          contact: profile?.phone || "",
        },
        theme: { color: "#2563EB" },
        modal: { ondismiss: () => setBusy(false) },
        notes: { prorated_charge: String(proratedCharge) },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => toast.error("Payment failed. Please try again."));
      rzp.open();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <div ref={ref} id="view-capacity" className="glass-card p-5 space-y-4 scroll-mt-24">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <Eye size={16} className="text-primary" />
          <div>
            <h3 className="font-semibold text-sm">Increase View Limit</h3>
            <p className="text-xs text-muted-foreground">
              Upgrade your daily view limit within your current plan. Pay only the prorated difference today.
            </p>
          </div>
        </div>
        {currentTier && (
          <div className="text-xs px-2.5 py-1 rounded-md border border-border bg-muted/30 text-muted-foreground">
            Current: <span className="font-semibold text-foreground">{currentTier.daily_views === -1 ? "∞" : currentTier.daily_views}</span>/day · ₹{fmt(currentTier.monthly_price)}/mo
          </div>
        )}
      </div>

      {higherTiers.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
          {higherTiers.map((t) => (
            <div
              key={t.id}
              className={`relative rounded-xl border p-3 transition-all flex flex-col ${
                t.is_popular ? "border-primary/50 bg-primary/5" : "border-border bg-card/40 hover:border-border/80"
              }`}
            >
              {t.is_popular && (
                <span className="absolute -top-2 right-2 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">
                  Popular
                </span>
              )}
              <div className="text-lg font-heading font-extrabold leading-none">
                {t.daily_views === -1 ? "∞" : t.daily_views}
                <span className="text-[11px] font-normal text-muted-foreground"> /day</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {t.daily_views === -1 ? "Unlimited monthly" : `${fmt(t.daily_views * 30)} /mo`}
              </p>
              <div className="mt-2 mb-2.5 text-sm font-heading font-bold">
                ₹{fmt(t.monthly_price)}<span className="text-[10px] font-normal text-muted-foreground">/mo</span>
              </div>
              <Button
                size="sm"
                variant={t.is_popular ? "default" : "outline"}
                className="w-full h-8 text-xs gap-1 mt-auto"
                onClick={() => setConfirmTier(t)}
              >
                Upgrade <ArrowRight size={11} />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          You're on the highest {planBase} tier.
          {planBase === "basic" && (
            <> <a className="text-primary underline" href="/pricing">Switch to Pro</a> for higher limits.</>
          )}
        </div>
      )}

      {/* Confirm modal — prorated breakdown */}
      <Dialog open={!!confirmTier} onOpenChange={(o) => !o && !busy && setConfirmTier(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upgrade View Capacity</DialogTitle>
          </DialogHeader>
          {confirmTier && currentTier && prorated && (
            <div className="space-y-4">
              {/* Current → After */}
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-xl border border-border p-3 text-center">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Current</div>
                  <div className="text-lg font-bold mt-1">{currentTier.daily_views}/day</div>
                  <div className="text-[11px] text-muted-foreground">₹{fmt(currentTier.monthly_price)}/mo</div>
                </div>
                <ArrowRight size={18} className="text-muted-foreground shrink-0" />
                <div className="flex-1 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 text-center">
                  <div className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">After upgrade</div>
                  <div className="text-lg font-bold mt-1">{confirmTier.daily_views}/day</div>
                  <div className="text-[11px] text-emerald-500/80">₹{fmt(confirmTier.monthly_price)}/mo</div>
                </div>
              </div>

              {/* Breakdown */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5 text-sm">
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                  Payment breakdown
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Days remaining in your cycle</span>
                  <span className="text-right">
                    {prorated.daysRemaining} days
                    <div className="text-[10px] text-muted-foreground">
                      until {format(prorated.renewalDate, "dd MMM yyyy")}
                    </div>
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Price difference</span>
                  <span>₹{fmt(confirmTier.monthly_price)} − ₹{fmt(currentTier.monthly_price)} = ₹{fmt(prorated.priceDifference)}</span>
                </div>

                <div className="h-px bg-border my-1" />

                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div className="font-semibold text-foreground">You pay today</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{formatProratedSummary(prorated)}</div>
                  </div>
                  <div className="text-2xl font-heading font-extrabold text-emerald-500">₹{fmt(prorated.proratedCharge)}</div>
                </div>

                <div className="flex justify-between gap-3 text-muted-foreground">
                  <div>
                    <div>From {format(prorated.renewalDate, "dd MMM yyyy")}</div>
                    <div className="text-[10px]">your regular renewal</div>
                  </div>
                  <span>₹{fmt(confirmTier.monthly_price)}/month</span>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[12px] text-muted-foreground">
                <Zap size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  Your new limit of <strong className="text-foreground">{confirmTier.daily_views} views/day</strong> activates
                  immediately after payment. Your renewal date stays the same.
                </span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirmTier(null)} disabled={busy}>Cancel</Button>
            <Button onClick={handleConfirmUpgrade} disabled={busy || !prorated} className="gap-1">
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}
              Pay ₹{prorated ? fmt(prorated.proratedCharge) : ""} <ArrowRight size={14} />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
