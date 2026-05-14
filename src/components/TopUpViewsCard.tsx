import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Zap, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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

interface TopUpConfig {
  plan_key: string;
  price_per_unit: number;
  unit_size: number;
  extra_views_purchased: number;
  extra_views_expires_at: string | null;
}

export function TopUpViewsCard({ onPurchased }: { onPurchased?: () => void }) {
  const { user, profile } = useAuth();
  const [config, setConfig] = useState<TopUpConfig | null>(null);
  const [units, setUnits] = useState(1);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    const { data } = await supabase.functions.invoke("razorpay-portal", {
      body: { action: "get_topup_config" },
    });
    if (data) setConfig(data as TopUpConfig);
  };

  useEffect(() => { if (user) refresh(); }, [user]);

  if (!config || config.price_per_unit <= 0 || config.unit_size <= 0) return null;

  const totalViews = units * config.unit_size;
  const totalPrice = units * config.price_per_unit;

  const handleBuy = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error("Failed to load payment gateway");

      const { data, error } = await supabase.functions.invoke("razorpay-portal", {
        body: { action: "create_topup_order", units },
      });
      if (error || !data?.order_id) throw new Error(error?.message || "Failed to create order");

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: "nFlow by Nevorai",
        description: `${data.total_views} extra views`,
        order_id: data.order_id,
        handler: async (response: any) => {
          try {
            const { error: vErr } = await supabase.functions.invoke("razorpay-portal", {
              body: {
                action: "verify_topup_payment",
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });
            if (vErr) throw vErr;
            toast.success(`+${data.total_views} views added! Valid until end of month.`);
            await refresh();
            onPurchased?.();
          } catch {
            toast.error("Payment received but not yet activated. Contact support.");
          }
        },
        prefill: {
          name: profile?.full_name || "",
          email: user.email,
          contact: profile?.phone || "",
        },
        theme: { color: "#2563EB" },
        modal: { ondismiss: () => setLoading(null as any) },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => toast.error("Payment failed. Please try again."));
      rzp.open();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <Zap size={16} className="text-amber-500" />
          <div>
            <h3 className="font-semibold text-sm">One-time extra views</h3>
            <p className="text-xs text-muted-foreground">
              One-time, valid until end of current month. Does not auto-renew.
            </p>
          </div>
        </div>
        {config.extra_views_purchased > 0 && config.extra_views_expires_at && (
          <span className="text-[11px] text-emerald-500 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
            +{config.extra_views_purchased.toLocaleString("en-IN")} active · until {format(new Date(config.extra_views_expires_at), "dd MMM")}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setUnits(Math.max(1, units - 1))} disabled={loading || units <= 1}>
            <Minus size={12} />
          </Button>
          <div className="w-10 text-center font-heading font-semibold">{units}</div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setUnits(Math.min(100, units + 1))} disabled={loading || units >= 100}>
            <Plus size={12} />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          ×&nbsp;{config.unit_size.toLocaleString("en-IN")} views
        </div>
        <div className="text-sm">
          = <span className="font-heading font-bold text-foreground">+{totalViews.toLocaleString("en-IN")}</span> views
        </div>
        <div className="text-sm ml-auto">
          <span className="font-heading font-bold text-foreground">₹{totalPrice.toLocaleString("en-IN")}</span>
          <span className="text-[11px] text-muted-foreground"> total</span>
        </div>
        <Button onClick={handleBuy} disabled={loading} size="sm" className="gap-1.5">
          <Zap size={13} />
          {loading ? "Opening…" : "Buy now"}
        </Button>
      </div>
    </div>
  );
}
