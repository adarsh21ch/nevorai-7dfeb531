import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Users, TrendingUp, Layers, FileText, BarChart3, Target, UserCheck } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend,
} from "recharts";
import { formatCompact, formatInt } from "@/lib/format";

const COLORS = ["hsl(var(--primary))", "#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

const InsightsPage = ({ embedded = false }: { embedded?: boolean } = {}) => {
  useDocumentTitle(embedded ? "Tools" : "Insights");
  const { user } = useAuth();

  const { data: flows = [] } = useQuery({
    queryKey: ["my-flows", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("funnels").select("*").eq("owner_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: landingPages = [] } = useQuery({
    queryKey: ["my-landing-pages", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("landing_pages").select("*").eq("owner_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["all-leads-insights", user?.id, flows],
    queryFn: async () => {
      const ids = flows.map((f) => f.id);
      if (!ids.length) return [];
      const { data } = await supabase.from("funnel_leads").select("*").in("funnel_id", ids);
      return data || [];
    },
    enabled: flows.length > 0,
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["all-registrations-insights", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("landing_page_registrations").select("*").eq("owner_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: videoAnalytics = [] } = useQuery({
    queryKey: ["video-analytics-insights", user?.id, flows],
    queryFn: async () => {
      const ids = flows.map((f) => f.id);
      if (!ids.length) return [];
      const { data } = await supabase.from("funnel_video_analytics").select("*").in("funnel_id", ids).order("recorded_at", { ascending: true });
      return data || [];
    },
    enabled: flows.length > 0,
  });

  // KPIs
  const totalFunnelViews = flows.reduce((a, f) => a + (f.total_views || 0), 0);
  const totalLPViews = landingPages.reduce((a, lp) => a + (lp.total_views || 0), 0);
  const totalViews = totalFunnelViews + totalLPViews;
  const uniqueLeads = leads.length;
  const totalRegistrations = registrations.length;
  const funnelConvRate = totalFunnelViews > 0 ? ((uniqueLeads / totalFunnelViews) * 100).toFixed(1) : "0";
  const lpConvRate = totalLPViews > 0 ? ((totalRegistrations / totalLPViews) * 100).toFixed(1) : "0";

  // Unique emails across leads + registrations
  const allEmails = new Set([
    ...leads.filter((l) => l.email).map((l) => l.email!),
    ...registrations.filter((r) => r.email).map((r) => r.email!),
  ]);

  const kpis = [
    { icon: Eye, label: "Total Views", value: formatCompact(totalViews), sub: "Flows + Landing Pages" },
    { icon: Users, label: "Unique Leads", value: formatInt(uniqueLeads), sub: "From flows" },
    { icon: UserCheck, label: "Registrations", value: formatInt(totalRegistrations), sub: "From landing pages" },
    { icon: Target, label: "Flow Conv.", value: `${funnelConvRate}%`, sub: "Leads / Views" },
    { icon: TrendingUp, label: "LP Conv.", value: `${lpConvRate}%`, sub: "Regs / Views" },
    { icon: BarChart3, label: "Unique Contacts", value: formatInt(allEmails.size), sub: "Across all sources" },
  ];

  // Lead status breakdown
  const statusCounts = leads.reduce((acc, l) => {
    acc[l.status || "new"] = (acc[l.status || "new"] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Top flows by views
  const topFunnels = [...funnels].sort((a, b) => (b.total_views || 0) - (a.total_views || 0)).slice(0, 6)
    .map((f) => ({ name: f.title.length > 15 ? f.title.slice(0, 15) + "…" : f.title, views: f.total_views || 0, leads: f.total_leads || 0 }));

  // Top landing pages
  const topLPs = [...landingPages].sort((a, b) => (b.total_views || 0) - (a.total_views || 0)).slice(0, 6)
    .map((lp) => ({ name: lp.title.length > 15 ? lp.title.slice(0, 15) + "…" : lp.title, views: lp.total_views || 0, regs: lp.total_registrations || 0 }));

  // Device breakdown from leads
  const deviceCounts = leads.reduce((acc, l) => {
    const d = l.device_type || "unknown";
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const deviceData = Object.entries(deviceCounts).map(([name, value]) => ({ name, value }));

  // Daily leads trend (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dailyLeads: Record<string, number> = {};
  leads.forEach((l) => {
    if (!l.submitted_at) return;
    const d = new Date(l.submitted_at);
    if (d >= thirtyDaysAgo) {
      const key = d.toISOString().slice(5, 10);
      dailyLeads[key] = (dailyLeads[key] || 0) + 1;
    }
  });
  const dailyLeadData = Object.entries(dailyLeads).sort().map(([date, count]) => ({ date, leads: count }));

  // UTM source breakdown
  const utmCounts = leads.reduce((acc, l) => {
    const src = l.utm_source || "direct";
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const utmData = Object.entries(utmCounts).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 5).map(([name, value]) => ({ name, value }));

  const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" };

  const content = (
    <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold">Insights</h1>
          <div className="page-header-accent" />
          <p className="text-sm text-muted-foreground mt-2">Track your numbers, grow your business.</p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="premium-card p-4 group">
              <div className="flex items-center gap-2 mb-2">
                <div className="stat-icon group-hover:scale-105 transition-transform">
                  <k.icon size={16} className="text-primary" />
                </div>
                <span className="text-[11px] text-muted-foreground font-medium">{k.label}</span>
              </div>
              <div className="text-xl font-heading font-bold">{k.value}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="premium-card p-5">
            <h3 className="text-sm font-heading font-semibold mb-4 flex items-center gap-2">
              <Layers size={14} className="text-primary" /> Top Flows
            </h3>
            {topFunnels.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topFunnels}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="leads" fill="#6366F1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">No flows yet</p>}
          </div>

          <div className="premium-card p-5">
            <h3 className="text-sm font-heading font-semibold mb-4 flex items-center gap-2">
              <FileText size={14} className="text-primary" /> Top Landing Pages
            </h3>
            {topLPs.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topLPs}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="views" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="regs" name="registrations" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">No landing pages yet</p>}
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="premium-card p-5">
            <h3 className="text-sm font-heading font-semibold mb-4">Lead Status</h3>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">No leads yet</p>}
          </div>

          <div className="premium-card p-5">
            <h3 className="text-sm font-heading font-semibold mb-4">Device Breakdown</h3>
            {deviceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={deviceData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {deviceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">No data yet</p>}
          </div>

          <div className="premium-card p-5">
            <h3 className="text-sm font-heading font-semibold mb-4">Traffic Sources</h3>
            {utmData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={utmData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={60} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="leads" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">No data yet</p>}
          </div>
        </div>

        {/* Leads trend */}
        <div className="premium-card p-5">
          <h3 className="text-sm font-heading font-semibold mb-4">Lead Acquisition (Last 30 Days)</h3>
          {dailyLeadData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyLeadData}>
                <defs>
                  <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="leads" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#leadGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-12">No leads captured in the last 30 days</p>}
        </div>

        {/* Retention / Engagement summary */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="premium-card p-4 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg Watch Events</p>
            <p className="text-xl font-heading font-bold">
              {videoAnalytics.length > 0 ? (videoAnalytics.length / Math.max(flows.length, 1)).toFixed(0) : "0"}
            </p>
            <p className="text-[10px] text-muted-foreground">per flow</p>
          </div>
          <div className="premium-card p-4 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Published Flows</p>
            <p className="text-xl font-heading font-bold">{flows.filter((f) => f.is_published).length}</p>
            <p className="text-[10px] text-muted-foreground">of {flows.length} total</p>
          </div>
          <div className="premium-card p-4 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Active Landing Pages</p>
            <p className="text-xl font-heading font-bold">{landingPages.filter((lp) => lp.status === "published").length}</p>
            <p className="text-[10px] text-muted-foreground">of {landingPages.length} total</p>
          </div>
          <div className="premium-card p-4 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Retention Rate</p>
            <p className="text-xl font-heading font-bold">
              {allEmails.size > 0 ? ((leads.filter((l) => l.status === "converted").length / allEmails.size) * 100).toFixed(1) : "0"}%
            </p>
            <p className="text-[10px] text-muted-foreground">converted / unique</p>
          </div>
        </div>
    </div>
  );
  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
};

export default InsightsPage;
