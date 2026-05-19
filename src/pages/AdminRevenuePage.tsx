import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { IndianRupee, TrendingUp, Users as UsersIcon, CalendarDays } from "lucide-react";
import { formatINR, formatInt } from "@/lib/format";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";

const DAYS = 30;

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const fmtDay = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

const startOfDayISO = (offsetDays: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString();
};

const AdminRevenuePage = () => {
  const { data: subs = [] } = useQuery({
    queryKey: ["admin-revenue-subs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_subscriptions")
        .select("id, user_id, tier, plan_key, amount_paid, status, created_at, started_at, current_period_end, billing_type, payment_gateway")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-revenue-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email, created_at");
      return data || [];
    },
  });

  const profileMap = useMemo(
    () => Object.fromEntries(profiles.map((p: any) => [p.id, p])),
    [profiles],
  );

  // Paid transactions only
  const paidTx = useMemo(
    () => subs.filter((s: any) => (s.amount_paid || 0) > 0 && s.tier !== "free"),
    [subs],
  );

  const now = new Date();
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const start7 = new Date(startToday); start7.setDate(start7.getDate() - 6);
  const start30 = new Date(startToday); start30.setDate(start30.getDate() - 29);

  const sumIn = (from: Date) =>
    paidTx
      .filter((s: any) => s.created_at && new Date(s.created_at) >= from)
      .reduce((a: number, s: any) => a + (s.amount_paid || 0), 0);

  const todayRev = sumIn(startToday);
  const week = sumIn(start7);
  const month = sumIn(start30);
  const all = paidTx.reduce((a: number, s: any) => a + (s.amount_paid || 0), 0);
  const mrr = subs
    .filter((s: any) => s.status === "active" && s.tier !== "free")
    .reduce((a: number, s: any) => a + (s.amount_paid || 0), 0);

  // Daily series (last 30d)
  const series = useMemo(() => {
    const rev = new Map<string, number>();
    const sign = new Map<string, number>();
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(startToday); d.setDate(d.getDate() - i);
      const k = dayKey(d);
      rev.set(k, 0);
      sign.set(k, 0);
    }
    for (const t of paidTx) {
      if (!t.created_at) continue;
      const k = dayKey(new Date(t.created_at));
      if (rev.has(k)) rev.set(k, (rev.get(k) || 0) + (t.amount_paid || 0));
    }
    for (const p of profiles as any[]) {
      if (!p.created_at) continue;
      const k = dayKey(new Date(p.created_at));
      if (sign.has(k)) sign.set(k, (sign.get(k) || 0) + 1);
    }
    return Array.from(rev.keys()).map((k) => ({
      date: k,
      label: fmtDay(k),
      revenue: rev.get(k) || 0,
      signups: sign.get(k) || 0,
    }));
  }, [paidTx, profiles]);

  const todaySignups = (profiles as any[]).filter(
    (p) => p.created_at && new Date(p.created_at) >= startToday,
  ).length;
  const weekSignups = (profiles as any[]).filter(
    (p) => p.created_at && new Date(p.created_at) >= start7,
  ).length;

  const kpis = [
    { icon: IndianRupee, label: "Today", value: formatINR(todayRev), sub: `${todaySignups} new signups` },
    { icon: CalendarDays, label: "Last 7 days", value: formatINR(week), sub: `${weekSignups} new signups` },
    { icon: TrendingUp, label: "Last 30 days", value: formatINR(month) },
    { icon: IndianRupee, label: "All-time", value: formatINR(all) },
    { icon: UsersIcon, label: "Active MRR pool", value: formatINR(mrr) },
  ];

  const recent = paidTx.slice(0, 25);

  return (
    <AdminLayout>
      <div className="w-full min-w-0 space-y-5">
        <div>
          <h1 className="text-lg font-heading font-bold sm:text-2xl">Revenue</h1>
          <div className="page-header-accent" />
          <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
            Earnings, signups and transactions across the platform.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 sm:gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="glass-card min-w-0 p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <k.icon size={15} className="text-primary" />
                </div>
                <p className="truncate text-[11px] font-medium text-muted-foreground">{k.label}</p>
              </div>
              <p className="mt-2 truncate text-lg font-heading font-bold sm:text-xl">{k.value}</p>
              {k.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</p>}
            </div>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Daily revenue (last 30 days)</h3>
              <span className="text-[11px] text-muted-foreground">{formatINR(month)} total</span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={4} />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [formatINR(v), "Revenue"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revG)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Daily signups (last 30 days)</h3>
              <span className="text-[11px] text-muted-foreground">{formatInt(profiles.length)} total users</span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={4} />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="signups" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-sm font-semibold">Recent transactions</h3>
            <span className="text-[11px] text-muted-foreground">{paidTx.length} paid total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-3 text-xs text-muted-foreground font-medium">User</th>
                  <th className="p-3 text-xs text-muted-foreground font-medium">Plan</th>
                  <th className="p-3 text-xs text-muted-foreground font-medium">Cycle</th>
                  <th className="p-3 text-xs text-muted-foreground font-medium text-right">Amount</th>
                  <th className="p-3 text-xs text-muted-foreground font-medium">Date</th>
                  <th className="p-3 text-xs text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No transactions yet</td></tr>
                ) : recent.map((t: any) => {
                  const p = profileMap[t.user_id];
                  return (
                    <tr key={t.id} className="border-b border-border hover:bg-muted/40">
                      <td className="p-3">
                        <p className="font-medium text-sm">{p?.full_name || "—"}</p>
                        <p className="text-[11px] text-muted-foreground">{p?.email}</p>
                      </td>
                      <td className="p-3 capitalize text-xs">{t.tier}</td>
                      <td className="p-3 text-xs capitalize text-muted-foreground">{t.billing_type || "—"}</td>
                      <td className="p-3 text-right tabular-nums font-medium">{formatINR(t.amount_paid || 0)}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {t.created_at ? new Date(t.created_at).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] capitalize ${
                          t.status === "active" ? "bg-success/10 text-success"
                          : t.status === "cancelled" ? "bg-muted text-muted-foreground"
                          : "bg-warning/10 text-warning"
                        }`}>{t.status || "—"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminRevenuePage;
