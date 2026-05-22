import { useMemo } from "react";
import { useParams } from "@/lib/router-compat";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAuth } from "@/hooks/useAuth";
import { usePageVisible } from "@/hooks/usePageVisible";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layers, Eye, Users, UserCheck, Radio, TrendingUp, Target } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { DrillHeader, KpiStrip } from "@/components/insights/DrillHeader";
import { formatCompact, formatRelativeDate } from "@/lib/format";
import { ExportCsvButton } from "@/components/insights/ExportCsvButton";

const PIE = ["hsl(var(--primary))", "#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

export default function FunnelInsightsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const visible = usePageVisible();

  const { data: funnel } = useQuery({
    queryKey: ["funnel-insight", id],
    queryFn: async () => (await supabase.from("funnels").select("*").eq("id", id!).maybeSingle()).data,
    enabled: !!id && !!user?.id,
    staleTime: 60_000,
  });

  useDocumentTitle(funnel?.title ? `${funnel.title} · Insights` : "Funnel Insights");

  const { data: views = [] } = useQuery({
    queryKey: ["funnel-views", id],
    queryFn: async () => (await (supabase as any).from("funnel_view_events").select("started_at,last_heartbeat_at,device_type,referrer_source,session_id").eq("funnel_id", id).order("started_at", { ascending: false }).limit(1000)).data || [],
    enabled: !!id,
    staleTime: 30_000,
    refetchInterval: visible ? 60_000 : false,
  });

  const { data: liveCount = 0 } = useQuery({
    queryKey: ["funnel-live", id],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { count } = await (supabase as any).from("funnel_view_events").select("id", { count: "exact", head: true }).eq("funnel_id", id).gte("last_heartbeat_at", cutoff);
      return count || 0;
    },
    enabled: !!id,
    refetchInterval: visible ? 60_000 : false,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["funnel-leads-detail", id],
    queryFn: async () => (await supabase.from("funnel_leads").select("*").eq("funnel_id", id!).order("submitted_at", { ascending: false }).limit(500)).data || [],
    enabled: !!id,
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    const uniqueSessions = new Set(views.map((v: any) => v.session_id).filter(Boolean)).size;
    const sources: Record<string, number> = {};
    const utms: Record<string, number> = {};
    views.forEach((v: any) => {
      const s = v.referrer_source || "direct";
      sources[s] = (sources[s] || 0) + 1;
    });
    leads.forEach((l: any) => {
      const u = l.utm_source || "direct";
      utms[u] = (utms[u] || 0) + 1;
    });
    return {
      uniqueSessions,
      sourceData: Object.entries(sources).map(([name, value]) => ({ name, value })),
      utmData: Object.entries(utms).map(([name, value]) => ({ name, value })),
    };
  }, [views, leads]);

  const convRate = views.length ? ((leads.length / views.length) * 100).toFixed(1) + "%" : "—";
  const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <DrillHeader
          icon={Layers}
          title={funnel?.title || "Funnel"}
          subtitle={funnel?.slug ? `/${funnel.slug}` : undefined}
          publicHref={funnel?.slug ? `/f/${funnel.slug}` : null}
          liveCount={liveCount}
          backTo="/insights?tab=funnels"
          actions={<ExportCsvButton rows={leads as any[]} filename={`funnel-${funnel?.slug || id}-leads.csv`} />}
        />

        <KpiStrip
          cards={[
            { icon: Eye, label: "Views", value: formatCompact(views.length || funnel?.total_views || 0) },
            { icon: Users, label: "Unique", value: formatCompact(stats.uniqueSessions) },
            { icon: UserCheck, label: "Leads", value: formatCompact(leads.length || funnel?.total_leads || 0) },
            { icon: TrendingUp, label: "Conv Rate", value: convRate },
            { icon: Target, label: "Sources", value: stats.utmData.length },
            { icon: Radio, label: "Live Now", value: formatCompact(liveCount) },
          ]}
        />

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="premium-card p-5">
            <h3 className="text-sm font-heading font-semibold mb-3">Lead Attribution (UTM)</h3>
            {stats.utmData.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={stats.utmData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {stats.utmData.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground text-center py-12">No attribution yet</p>}
          </div>
          <div className="premium-card p-5">
            <h3 className="text-sm font-heading font-semibold mb-3">Traffic Sources</h3>
            {stats.sourceData.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.sourceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground text-center py-12">No source data yet</p>}
          </div>
        </div>

        <div className="premium-card p-5">
          <h3 className="text-sm font-heading font-semibold mb-3">Recent Leads</h3>
          {leads.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase text-muted-foreground">
                  <tr className="border-b border-border/40">
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Email</th>
                    <th className="text-left py-2">Phone</th>
                    <th className="text-left py-2">Source</th>
                    <th className="text-right py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.slice(0, 30).map((l: any) => (
                    <tr key={l.id} className="border-b border-border/20">
                      <td className="py-2">{l.name || "—"}</td>
                      <td className="py-2 text-muted-foreground">{l.email || "—"}</td>
                      <td className="py-2 text-muted-foreground">{l.phone || "—"}</td>
                      <td className="py-2 text-muted-foreground">{l.utm_source || "direct"}</td>
                      <td className="py-2 text-right text-muted-foreground">{formatRelativeDate(l.submitted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-xs text-muted-foreground text-center py-8">No leads yet</p>}
        </div>
      </div>
    </DashboardLayout>
  );
}
