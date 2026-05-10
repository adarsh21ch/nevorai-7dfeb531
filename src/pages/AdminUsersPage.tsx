import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { Search, AlertTriangle, Pencil } from "lucide-react";
import { planDisplay } from "@/config/planDisplay";
import { UserEditDrawer } from "@/components/admin/UserEditDrawer";
import { AdminOverrideMenu, AdminUserOverrideBadge } from "@/components/admin/AdminOverrideMenu";

const monthStartIST = (() => {
  const d = new Date();
  const ist = new Date(d.getTime() + 5.5 * 3600_000);
  const first = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1));
  return first.toISOString().slice(0, 10);
})();

const ViewsCell = ({ used, limit }: { used: number; limit: number }) => {
  const pct = limit === -1 ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const color = pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-primary";
  return (
    <div className="flex items-center gap-2 justify-end min-w-0">
      {pct >= 80 && limit !== -1 && <AlertTriangle size={12} className={pct >= 100 ? "text-destructive" : "text-warning"} />}
      <div className="flex flex-col items-end gap-1 min-w-0">
        <span className="text-[11px] tabular-nums whitespace-nowrap">
          {used.toLocaleString("en-IN")} / {limit === -1 ? "∞" : limit.toLocaleString("en-IN")}
        </span>
        <div className="h-1 w-20 bg-muted rounded-full overflow-hidden">
          <div className={`h-full ${color}`} style={{ width: `${limit === -1 ? 0 : pct}%` }} />
        </div>
      </div>
    </div>
  );
};

const AdminUsersPage = () => {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["admin-all-subs"],
    queryFn: async () => {
      const { data } = await supabase.from("user_subscriptions").select("user_id, tier, plan_key, status").eq("status", "active");
      return data || [];
    },
  });

  const { data: planConfigs = [] } = useQuery({
    queryKey: ["admin-plan-configs"],
    queryFn: async () => {
      const { data } = await supabase.from("plan_config").select("plan_name, monthly_views");
      return (data || []) as { plan_name: string; monthly_views: number | null }[];
    },
  });

  const { data: viewRows = [] } = useQuery({
    queryKey: ["admin-monthly-views"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_daily_views")
        .select("user_id, total_views")
        .gte("view_date", monthStartIST);
      return data || [];
    },
  });

  const subMap = useMemo(() => Object.fromEntries(subscriptions.map((s: any) => [s.user_id, s])), [subscriptions]);
  const planMap = useMemo(() => Object.fromEntries(planConfigs.map((p) => [p.plan_name, p.monthly_views ?? 2000])), [planConfigs]);
  const viewsMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of viewRows as any[]) m.set(r.user_id, (m.get(r.user_id) || 0) + (r.total_views || 0));
    return m;
  }, [viewRows]);

  const filtered = profiles.filter(
    (p) => !search || p.full_name?.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase())
  );

  const limitFor = (p: any) => {
    const sub = subMap[p.id];
    const planKey = sub?.plan_key || sub?.tier || "free";
    return p.custom_monthly_views_limit ?? planMap[planKey] ?? 2000;
  };

  return (
    <AdminLayout>
      <div className="w-full min-w-0 space-y-4">
        <h1 className="text-lg font-heading font-bold sm:text-2xl">User Management</h1>

        <div className="relative w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search users..." className="pl-9 bg-muted border-border" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-4 text-xs text-muted-foreground font-medium">User</th>
                  <th className="p-4 text-xs text-muted-foreground font-medium">Plan</th>
                  <th className="p-4 text-xs text-muted-foreground font-medium">KYC</th>
                  <th className="p-4 text-xs text-muted-foreground font-medium">Joined</th>
                  <th className="p-4 text-xs text-muted-foreground font-medium text-right">Views (this month)</th>
                  <th className="p-4 text-xs text-muted-foreground font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="p-4" colSpan={6}><div className="h-4 bg-muted rounded animate-pulse" /></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No users found</td></tr>
                ) : (
                  filtered.map((p: any) => {
                    const sub = subMap[p.id];
                    const used = viewsMap.get(p.id) || 0;
                    const limit = limitFor(p);
                    return (
                      <tr key={p.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="p-4">
                          <p className="font-medium">{p.full_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{p.email}</p>
                        </td>
                        <td className="p-4">
                          {(() => {
                            const d = planDisplay(sub?.tier);
                            return <AdminUserOverrideBadge user={p} plan={d} />;
                          })()}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${p.kyc_status === "verified" ? "bg-success/10 text-success" : p.kyc_status === "pending" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>
                            {p.kyc_status || "none"}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-muted-foreground">
                          {p.created_at ? new Date(p.created_at).toLocaleDateString("en-IN") : "—"}
                        </td>
                        <td className="p-4">
                          <ViewsCell used={used} limit={p.is_unlimited ? -1 : limit} />
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                              <Pencil size={13} className="mr-1" /> Edit
                            </Button>
                            <AdminOverrideMenu user={{ ...p, plan_key: sub?.plan_key ?? sub?.tier, selected_daily_views: p.selected_daily_views }} subscription={sub} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile card view */}
        <div className="sm:hidden space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <div key={i} className="glass-card p-3 h-20 animate-pulse" />)
          ) : filtered.length === 0 ? (
            <div className="glass-card p-6 text-center text-sm text-muted-foreground">No users found</div>
          ) : (
            filtered.map((p: any) => {
              const sub = subMap[p.id];
              const used = viewsMap.get(p.id) || 0;
              const limit = limitFor(p);
              return (
                <div key={p.id} className="glass-card p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.full_name || "—"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{p.email}</p>
                    </div>
                    {(() => {
                      const d = planDisplay(sub?.tier);
                      return <AdminUserOverrideBadge user={p} plan={d} />;
                    })()}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                    <span className="text-[10px] text-muted-foreground">Views</span>
                    <ViewsCell used={used} limit={p.is_unlimited ? -1 : limit} />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[10px] text-muted-foreground">
                      Joined {p.created_at ? new Date(p.created_at).toLocaleDateString("en-IN") : "—"}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(p)}>
                        <Pencil size={12} className="mr-1" /> Edit
                      </Button>
                      <AdminOverrideMenu user={{ ...p, plan_key: sub?.plan_key ?? sub?.tier, selected_daily_views: p.selected_daily_views }} subscription={sub} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <UserEditDrawer
        open={!!editing}
        onClose={() => setEditing(null)}
        user={editing}
        subscription={editing ? subMap[editing.id] : null}
      />
    </AdminLayout>
  );
};

export default AdminUsersPage;
