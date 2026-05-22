import { useMemo } from "react";
import { useParams } from "@/lib/router-compat";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAuth } from "@/hooks/useAuth";
import { usePageVisible } from "@/hooks/usePageVisible";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Radio, Eye, Users, UserCheck, TrendingUp, Clock } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { DrillHeader, KpiStrip } from "@/components/insights/DrillHeader";
import { formatCompact, formatRelativeDate } from "@/lib/format";

export default function LiveInsightsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const visible = usePageVisible();

  const { data: session } = useQuery({
    queryKey: ["live-insight", id],
    queryFn: async () => (await supabase.from("live_sessions").select("*").eq("id", id!).maybeSingle()).data,
    enabled: !!id && !!user?.id,
    staleTime: 60_000,
  });

  useDocumentTitle(session?.title ? `${session.title} · Insights` : "Live Insights");

  const { data: views = [] } = useQuery({
    queryKey: ["live-views-detail", id],
    queryFn: async () => (await (supabase as any).from("live_session_view_events").select("started_at,last_heartbeat_at,device_type,referrer_source,session_id").eq("live_session_id", id).order("started_at", { ascending: false }).limit(1000)).data || [],
    enabled: !!id,
    staleTime: 30_000,
    refetchInterval: visible ? 60_000 : false,
  });

  const { data: liveCount = 0 } = useQuery({
    queryKey: ["live-now", id],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { count } = await (supabase as any).from("live_session_view_events").select("id", { count: "exact", head: true }).eq("live_session_id", id).gte("last_heartbeat_at", cutoff);
      return count || 0;
    },
    enabled: !!id,
    refetchInterval: visible ? 60_000 : false,
  });

  const stats = useMemo(() => {
    const uniqueSessions = new Set(views.map((v: any) => v.session_id).filter(Boolean)).size;
    const byDay: Record<string, number> = {};
    views.forEach((v: any) => {
      const day = new Date(v.started_at).toISOString().slice(5, 10);
      byDay[day] = (byDay[day] || 0) + 1;
    });
    return {
      uniqueSessions,
      dailyData: Object.entries(byDay).sort().map(([date, views]) => ({ date, views })),
    };
  }, [views]);

  const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <DrillHeader
          icon={Radio}
          title={session?.title || "Live Session"}
          subtitle={session?.slug ? `/${session.slug}` : undefined}
          publicHref={session?.slug ? `/s/${session.slug}` : null}
          liveCount={liveCount}
          backTo="/insights?tab=live"
        />

        <KpiStrip
          cards={[
            { icon: Eye, label: "Total Views", value: formatCompact(views.length) },
            { icon: Users, label: "Unique", value: formatCompact(stats.uniqueSessions) },
            { icon: Radio, label: "Live Now", value: formatCompact(liveCount) },
            { icon: UserCheck, label: "Status", value: session?.status || "—" },
            { icon: Clock, label: "Created", value: session?.created_at ? formatRelativeDate(session.created_at) : "—" },
            { icon: TrendingUp, label: "Peak Today", value: formatCompact(Math.max(0, ...Object.values(stats.dailyData.map((d) => d.views) || [0]))) },
          ]}
        />

        <div className="premium-card p-5">
          <h3 className="text-sm font-heading font-semibold mb-3">Attendance by Day</h3>
          {stats.dailyData.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground text-center py-12">No attendance data yet</p>}
        </div>
      </div>
    </DashboardLayout>
  );
}
