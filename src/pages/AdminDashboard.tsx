import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Layers, Video, BarChart3, IndianRupee, Shield, TrendingUp } from "lucide-react";
import { MemberGatewayDashboardCard } from "@/components/admin/MemberGatewayDashboardCard";
import { ViewsAnalyticsCard } from "@/components/admin/ViewsAnalyticsCard";
import { PlatformReachAnalytics } from "@/components/admin/PlatformReachAnalytics";
import { formatCompact, formatINR, formatInt } from "@/lib/format";
import { Link } from "@/lib/router-compat";
import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const AdminDashboard = () => {
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email, created_at, kyc_status");
      return data || [];
    },
  });

  const { data: funnels = [] } = useQuery({
    queryKey: ["admin-funnels-count"],
    queryFn: async () => {
      const { data } = await supabase.from("funnels").select("id, total_views, total_leads, total_payments");
      return data || [];
    },
  });

  const { data: videos = [] } = useQuery({
    queryKey: ["admin-videos-count"],
    queryFn: async () => {
      const { data } = await supabase.from("video_assets").select("id");
      return data || [];
    },
  });

  const { data: subs = [] } = useQuery({
    queryKey: ["admin-subs"],
    queryFn: async () => {
      const { data } = await supabase.from("user_subscriptions").select("amount_paid, tier, status");
      return data || [];
    },
  });

  const { data: kycPending = [] } = useQuery({
    queryKey: ["admin-kyc-pending"],
    queryFn: async () => {
      const { data } = await supabase.from("user_kyc_submissions").select("id").eq("status", "pending");
      return data || [];
    },
  });

  const mrr = subs.filter((s) => s.status === "active" && s.tier !== "free").reduce((a, s) => a + (s.amount_paid || 0), 0);
  const totalViews = funnels.reduce((a, f) => a + ((f as any).total_views || 0), 0);
  const totalLeads = funnels.reduce((a, f) => a + ((f as any).total_leads || 0), 0);

  // 14-day signups series
  const signupSeries = useMemo(() => {
    const days = 14;
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
    const map = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      map.set(d.toISOString().slice(0, 10), 0);
    }
    for (const p of profiles as any[]) {
      if (!p.created_at) continue;
      const k = new Date(p.created_at).toISOString().slice(0, 10);
      if (map.has(k)) map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map.entries()).map(([k, v]) => ({
      label: new Date(k).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      signups: v,
    }));
  }, [profiles]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todaySignups = (profiles as any[]).filter(
    (p) => p.created_at && p.created_at.slice(0, 10) === todayKey,
  ).length;

  const kpis = [
    { icon: Users, label: "Total Users", value: formatInt(profiles.length) },
    { icon: TrendingUp, label: "Signups Today", value: formatInt(todaySignups) },
    { icon: Layers, label: "Total Funnels", value: formatInt(funnels.length) },
    { icon: Video, label: "Total Videos", value: formatInt(videos.length) },
    { icon: BarChart3, label: "Total Views", value: formatCompact(totalViews) },
    { icon: Users, label: "Total Leads", value: formatCompact(totalLeads) },
    { icon: IndianRupee, label: "Revenue", value: formatINR(mrr) },
    { icon: Shield, label: "KYC Pending", value: formatInt(kycPending.length) },
  ];

  return (
    <AdminLayout>
      <div className="w-full min-w-0 space-y-4">
        <div>
          <h1 className="text-lg font-heading font-bold sm:text-2xl">Admin Dashboard</h1>
          <div className="page-header-accent" />
          <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">Platform overview and management.</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 sm:gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="glass-card min-w-0 p-3 sm:p-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <k.icon size={15} className="text-primary" />
                </div>
                <p className="min-w-0 truncate text-xs font-medium text-muted-foreground">{k.label}</p>
              </div>
              <p className="mt-3 truncate text-xl font-heading font-bold sm:text-2xl">{k.value}</p>
            </div>
          ))}
          <MemberGatewayDashboardCard />
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold">Daily signups</h3>
              <p className="text-[11px] text-muted-foreground">Last 14 days</p>
            </div>
            <Link to="/admin/revenue" className="text-[11px] font-semibold text-primary hover:underline">
              View revenue →
            </Link>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={signupSeries} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={1} />
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

        <PlatformReachAnalytics />

        <ViewsAnalyticsCard />
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
