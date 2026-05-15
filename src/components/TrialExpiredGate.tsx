import { Link } from "@/lib/router-compat";
import { Clock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const TrialExpiredGate = ({ trialDays }: { trialDays: number }) => {
  const { data: plans } = useQuery({
    queryKey: ["trial-gate-plans"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("admin_subscription_plans")
        .select("plan_key, price_inr")
        .in("plan_key", ["basic_monthly", "pro_monthly"])
        .eq("is_active", true);
      const map: Record<string, number> = {};
      (data || []).forEach((p: any) => { map[p.plan_key] = Number(p.price_inr); });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  const basicPrice = plans?.basic_monthly ?? 499;
  const proPrice = plans?.pro_monthly ?? 999;
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-2xl my-8">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-5 mx-auto">
          <Clock className="text-emerald-500" size={28} />
        </div>
        <h2 className="text-2xl font-heading font-bold text-center mb-2">
          Your {trialDays}-Day Trial Has Ended
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          You've used your free trial. Choose a plan to keep converting prospects and never lose a lead again.
        </p>
        <div className="space-y-3 mb-6">
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm">Basic</p>
                <p className="text-xs text-emerald-400 font-medium mt-0.5">★ 2,000 views / month</p>
                <p className="text-xs text-muted-foreground mt-0.5">5 flows · Lead capture · WhatsApp</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-base">{fmt(basicPrice)}</p>
                <p className="text-[10px] text-muted-foreground">/month</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 relative">
            <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center gap-1">
              <Crown size={10} /> Most Popular
            </div>
            <div className="flex items-center justify-between gap-3 mt-1">
              <div className="min-w-0">
                <p className="font-semibold text-sm">Pro</p>
                <p className="text-xs text-emerald-400 font-medium mt-0.5">★ 20,000 views / month</p>
                <p className="text-xs text-muted-foreground mt-0.5">25 flows · Live · Custom branding</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-base">{fmt(proPrice)}</p>
                <p className="text-[10px] text-muted-foreground">/month</p>
              </div>
            </div>
          </div>
        </div>
        <Link to="/pricing" className="block">
          <Button variant="hero" size="lg" className="w-full">Choose a Plan →</Button>
        </Link>
        <p className="text-[11px] text-muted-foreground text-center mt-4">
          Questions? <Link to="/contact" className="text-primary hover:underline">Contact support</Link>
        </p>
      </div>
    </div>
  );
};
