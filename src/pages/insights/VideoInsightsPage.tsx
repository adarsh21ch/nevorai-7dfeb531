import { useMemo } from "react";
import { useParams } from "@/lib/router-compat";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAuth } from "@/hooks/useAuth";
import { usePageVisible } from "@/hooks/usePageVisible";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Video, Eye, Users, UserCheck, Clock, TrendingUp, Radio } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { DrillHeader, KpiStrip } from "@/components/insights/DrillHeader";
import { formatCompact, formatRelativeDate, formatDuration } from "@/lib/format";
import { ExportCsvButton } from "@/components/insights/ExportCsvButton";

const PIE = ["hsl(var(--primary))", "#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

export default function VideoInsightsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const visible = usePageVisible();

  const { data: video } = useQuery({
    queryKey: ["video-insight", id],
    queryFn: async () => (await supabase.from("video_assets").select("*").eq("id", id!).maybeSingle()).data,
    enabled: !!id && !!user?.id,
    staleTime: 60_000,
  });

  useDocumentTitle(video?.title ? `${video.title} · Insights` : "Video Insights");

  const { data: views = [] } = useQuery({
    queryKey: ["video-views", id],
    queryFn: async () => (await (supabase as any).from("video_view_events").select("started_at,last_heartbeat_at,device_type,referrer_source,country,session_id").eq("video_id", id).order("started_at", { ascending: false }).limit(1000)).data || [],
    enabled: !!id,
    staleTime: 30_000,
    refetchInterval: visible ? 60_000 : false,
  });

  const { data: liveCount = 0 } = useQuery({
    queryKey: ["video-live", id],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { count } = await (supabase as any).from("video_view_events").select("id", { count: "exact", head: true }).eq("video_id", id).gte("last_heartbeat_at", cutoff);
      return count || 0;
    },
    enabled: !!id,
    refetchInterval: visible ? 60_000 : false,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["video-leads", id],
    queryFn: async () => (await supabase.from("funnel_leads").select("id,name,email,phone,submitted_at,utm_source,device_type" as any).eq("source_id" as any, id!).eq("source_type" as any, "video").order("submitted_at", { ascending: false }).limit(500)).data || [],
    enabled: !!id,
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    const uniqueSessions = new Set(views.map((v: any) => v.session_id).filter(Boolean)).size;
    const devices: Record<string, number> = {};
    const sources: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    views.forEach((v: any) => {
      const dev = v.device_type || "unknown";
      devices[dev] = (devices[dev] || 0) + 1;
      const src = v.referrer_source || "direct";
      sources[src] = (sources[src] || 0) + 1;
      const day = new Date(v.started_at).toISOString().slice(5, 10);
      byDay[day] = (byDay[day] || 0) + 1;
    });
    return {
      uniqueSessions,
      deviceData: Object.entries(devices).map(([name, value]) => ({ name, value })),
      sourceData: Object.entries(sources).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value })),
      dailyData: Object.entries(byDay).sort().map(([date, views]) => ({ date, views })),
    };
  }, [views]);

  const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <DrillHeader
          icon={Video}
          title={video?.title || "Video"}
          subtitle={video?.duration_seconds ? `${formatDuration(video.duration_seconds)} · ${formatRelativeDate(video.created_at)}` : undefined}
          publicHref={video?.id ? `/v/${video.id}` : null}
          liveCount={liveCount}
          backTo="/insights?tab=videos"
          actions={<ExportCsvButton rows={leads as any[]} filename={`video-${id}-leads.csv`} />}
        />

        <KpiStrip
          cards={[
            { icon: Eye, label: "Total Views", value: formatCompact(views.length) },
            { icon: Users, label: "Unique Viewers", value: formatCompact(stats.uniqueSessions) },
            { icon: UserCheck, label: "Leads", value: formatCompact(leads.length) },
            { icon: Radio, label: "Live Now", value: formatCompact(liveCount) },
            { icon: Clock, label: "Duration", value: video?.duration_seconds ? formatDuration(video.duration_seconds) : "—" },
            { icon: TrendingUp, label: "Conv Rate", value: views.length ? `${((leads.length / views.length) * 100).toFixed(1)}%` : "—" },
          ]}
        />

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="premium-card p-5">
            <h3 className="text-sm font-heading font-semibold mb-3">Views over Time</h3>
            {stats.dailyData.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground text-center py-12">No view data yet</p>}
          </div>
          <div className="premium-card p-5">
            <h3 className="text-sm font-heading font-semibold mb-3">Traffic Sources</h3>
            {stats.sourceData.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={stats.sourceData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {stats.sourceData.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
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
                    <th className="text-left py-2">Source</th>
                    <th className="text-right py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.slice(0, 20).map((l: any) => (
                    <tr key={l.id} className="border-b border-border/20">
                      <td className="py-2">{l.name || "—"}</td>
                      <td className="py-2 text-muted-foreground">{l.email || "—"}</td>
                      <td className="py-2 text-muted-foreground">{l.utm_source || "direct"}</td>
                      <td className="py-2 text-right text-muted-foreground">{formatRelativeDate(l.submitted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-xs text-muted-foreground text-center py-8">No leads from this video yet</p>}
        </div>
      </div>
    </DashboardLayout>
  );
}
