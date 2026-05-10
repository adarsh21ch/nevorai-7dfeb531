import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, AlertTriangle, TrendingUp } from "lucide-react";

type PlanRow = { plan_name: string; monthly_views: number | null };

export const ViewsAnalyticsCard = () => {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-monthly-views"],
    queryFn: async () => {
      const monthStartIST = (() => {
        const d = new Date();
        const ist = new Date(d.getTime() + 5.5 * 3600_000);
        const first = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1));
        return first.toISOString().slice(0, 10);
      })();

      const { data: views } = await supabase
        .from("user_daily_views")
        .select("user_id, total_views")
        .gte("view_date", monthStartIST);

      const totals = new Map<string, number>();
      for (const r of views || []) {
        totals.set((r as any).user_id, (totals.get((r as any).user_id) || 0) + ((r as any).total_views || 0));
      }
      const userIds = [...totals.keys()];
      if (userIds.length === 0) return [];

      const [{ data: profiles }, { data: subs }, { data: plans }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, custom_monthly_views_limit").in("id", userIds),
        supabase.from("user_subscriptions").select("user_id, tier, plan_key, status").in("user_id", userIds).eq("status", "active"),
        supabase.from("plan_config").select("plan_name, monthly_views"),
      ]);

      const subMap = new Map<string, any>();
      for (const s of subs || []) subMap.set((s as any).user_id, s);
      const planMap = new Map<string, number | null>();
      for (const p of (plans || []) as PlanRow[]) planMap.set(p.plan_name, p.monthly_views);

      return (profiles || []).map((p: any) => {
        const sub = subMap.get(p.id);
        const planKey = sub?.plan_key || sub?.tier || "free";
        const planLimit = planMap.get(planKey) ?? 2000;
        const limit = p.custom_monthly_views_limit ?? planLimit ?? 2000;
        const used = totals.get(p.id) || 0;
        const pct = limit === -1 ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
        return { id: p.id, name: p.full_name || p.email || "—", email: p.email, used, limit, pct };
      });
    },
  });

  const sorted = [...rows].sort((a, b) => b.used - a.used);
  const top5 = sorted.slice(0, 5);
  const totalViews = rows.reduce((a, r) => a + r.used, 0);
  const at80 = rows.filter((r) => r.limit !== -1 && r.pct >= 80 && r.pct < 100).length;
  const at100 = rows.filter((r) => r.limit !== -1 && r.pct >= 100).length;

  return (
    <div className="glass-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <BarChart3 size={15} className="text-primary" />
        </div>
        <h2 className="text-sm font-heading font-semibold sm:text-base">Views Analytics — This Month</h2>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-lg border border-border/40 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><TrendingUp size={11} /> Total views</div>
          <p className="mt-1 text-lg font-bold sm:text-xl">{totalViews.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-lg border border-border/40 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-warning"><AlertTriangle size={11} /> ≥80% used</div>
          <p className="mt-1 text-lg font-bold sm:text-xl">{at80}</p>
        </div>
        <div className="rounded-lg border border-border/40 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-destructive"><AlertTriangle size={11} /> At limit</div>
          <p className="mt-1 text-lg font-bold sm:text-xl">{at100}</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold mb-2">Top consumers</p>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-muted/40 rounded animate-pulse" />)}
          </div>
        ) : top5.length === 0 ? (
          <p className="text-xs text-muted-foreground">No views yet this month.</p>
        ) : (
          <div className="space-y-2">
            {top5.map((r) => (
              <div key={r.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium">{r.name}</span>
                  <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
                    {r.used.toLocaleString("en-IN")} / {r.limit === -1 ? "∞" : r.limit.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${r.pct >= 100 ? "bg-destructive" : r.pct >= 80 ? "bg-warning" : "bg-primary"}`}
                    style={{ width: `${r.limit === -1 ? 0 : r.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
