import { useMemo } from "react";
import { useParams } from "@/lib/router-compat";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAuth } from "@/hooks/useAuth";
import { usePageVisible } from "@/hooks/usePageVisible";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Eye, Users, UserCheck, Radio, TrendingUp, Target } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { DrillHeader, KpiStrip } from "@/components/insights/DrillHeader";
import { formatCompact, formatRelativeDate } from "@/lib/format";
import { ExportCsvButton } from "@/components/insights/ExportCsvButton";

const PIE = ["hsl(var(--primary))", "#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

export default function LandingPageInsightsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const visible = usePageVisible();

  const { data: lp } = useQuery({
    queryKey: ["lp-insight", id],
    queryFn: async () => (await supabase.from("landing_pages").select("*").eq("id", id!).maybeSingle()).data,
    enabled: !!id && !!user?.id,
    staleTime: 60_000,
  });

  useDocumentTitle(lp?.title ? `${lp.title} · Insights` : "Landing Page Insights");

  const { data: views = [] } = useQuery({
    queryKey: ["lp-views-detail", id],
    queryFn: async () => (await (supabase as any).from("landing_page_view_events").select("started_at,last_heartbeat_at,device_type,referrer_source,session_id").eq("landing_page_id", id).order("started_at", { ascending: false }).limit(1000)).data || [],
    enabled: !!id,
    staleTime: 30_000,
    refetchInterval: visible ? 60_000 : false,
  });

  const { data: liveCount = 0 } = useQuery({
    queryKey: ["lp-live", id],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { count } = await (supabase as any).from("landing_page_view_events").select("id", { count: "exact", head: true }).eq("landing_page_id", id).gte("last_heartbeat_at", cutoff);
      return count || 0;
    },
    enabled: !!id,
    refetchInterval: visible ? 60_000 : false,
  });

  const { data: regs = [] } = useQuery({
    queryKey: ["lp-regs-detail", id],
    queryFn: async () => (await supabase.from("landing_page_registrations").select("*").eq("landing_page_id", id!).order("submitted_at", { ascending: false }).limit(500)).data || [],
    enabled: !!id,
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    const uniqueSessions = new Set(views.map((v: any) => v.session_id).filter(Boolean)).size;
    const sources: Record<string, number> = {};
    const utms: Record<string, number> = {};
    views.forEach((v: any) => { const s = v.referrer_source || "direct"; sources[s] = (sources[s] || 0) + 1; });
    regs.forEach((r: any) => { const u = r.utm_source || "direct"; utms[u] = (utms[u] || 0) + 1; });
    return {
      uniqueSessions,
      sourceData: Object.entries(sources).map(([name, value]) => ({ name, value })),
      utmData: Object.entries(utms).map(([name, value]) => ({ name, value })),
    };
  }, [views, regs]);

  const convRate = views.length ? ((regs.length / views.length) * 100).toFixed(1) + "%" : "—";
  const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <DrillHeader
          icon={FileText}
          title={lp?.title || "Landing Page"}
          subtitle={lp?.slug ? `/${lp.slug}` : undefined}
          publicHref={lp?.slug ? `/l/${lp.slug}` : null}
          liveCount={liveCount}
          backTo="/insights?tab=landing-pages"
          actions={<ExportCsvButton rows={regs as any[]} filename={`lp-${lp?.slug || id}-registrations.csv`} />}
        />

        <KpiStrip
          cards={[
            { icon: Eye, label: "Views", value: formatCompact(views.length || lp?.total_views || 0) },
            { icon: Users, label: "Unique", value: formatCompact(stats.uniqueSessions) },
            { icon: UserCheck, label: "Registrations", value: formatCompact(regs.length || lp?.total_registrations || 0) },
            { icon: TrendingUp, label: "Conv Rate", value: convRate },
            { icon: Target, label: "Sources", value: stats.utmData.length },
            { icon: Radio, label: "Live Now", value: formatCompact(liveCount) },
          ]}
        />

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="premium-card p-5">
            <h3 className="text-sm font-heading font-semibold mb-3">Registration Attribution</h3>
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
          <h3 className="text-sm font-heading font-semibold mb-3">Recent Registrations</h3>
          {regs.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase text-muted-foreground">
                  <tr className="border-b border-border/40">
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Email</th>
                    <th className="text-left py-2">Source</th>
                    <th className="text-right py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {regs.slice(0, 30).map((r: any) => (
                    <tr key={r.id} className="border-b border-border/20">
                      <td className="py-2">{r.name || "—"}</td>
                      <td className="py-2 text-muted-foreground">{r.email || "—"}</td>
                      <td className="py-2 text-muted-foreground">{r.utm_source || "direct"}</td>
                      <td className="py-2 text-right text-muted-foreground">{formatRelativeDate(r.submitted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-xs text-muted-foreground text-center py-8">No registrations yet</p>}
        </div>
      </div>
    </DashboardLayout>
  );
}
