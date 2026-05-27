import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCompact, formatInt } from "@/lib/format";
import { TrendingUp, Sparkles, Video, Flame } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function shortDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short" });
}

export function PlatformReachAnalytics() {
  const today = todayISO();

  const { data: todayReach } = useQuery({
    queryKey: ["admin-today-reach", today],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_reach_metrics" as any)
        .select("total_reach, new_reach")
        .eq("day", today)
        .maybeSingle();
      return (data as { total_reach?: number; new_reach?: number } | null) || null;
    },
  });

  const { data: activeVideos } = useQuery({
    queryKey: ["admin-active-videos"],
    queryFn: async () => {
      const { count } = await supabase
        .from("video_stats" as any)
        .select("*", { count: "exact", head: true })
        .eq("is_in_use", true);
      return count ?? 0;
    },
  });

  const { data: topVideoToday } = useQuery({
    queryKey: ["admin-top-video-today"],
    queryFn: async () => {
      const { data } = await supabase
        .from("video_stats" as any)
        .select("title, views_today")
        .order("views_today", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as { title?: string; views_today?: number } | null) || null;
    },
  });

  const { data: reachTrend = [] } = useQuery({
    queryKey: ["admin-reach-trend-7d"],
    queryFn: async () => {
      const from = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("daily_reach_metrics" as any)
        .select("day, total_reach, new_reach")
        .gte("day", from)
        .order("day", { ascending: true });
      return (data as Array<{ day: string; total_reach: number; new_reach: number }>) || [];
    },
  });

  const { data: topVideos = [] } = useQuery({
    queryKey: ["admin-top-videos-30d"],
    queryFn: async () => {
      const { data } = await supabase
        .from("video_stats" as any)
        .select("video_id, title, views_30d, unique_views")
        .order("views_30d", { ascending: false })
        .limit(10);
      return (
        (data as Array<{
          video_id: string;
          title: string | null;
          views_30d: number | null;
          unique_views: number | null;
        }>) || []
      );
    },
  });

  const cards = [
    {
      icon: TrendingUp,
      label: "Reach today",
      value: formatCompact(todayReach?.total_reach ?? 0),
    },
    {
      icon: Sparkles,
      label: "New reach today",
      value: formatCompact(todayReach?.new_reach ?? 0),
    },
    {
      icon: Video,
      label: "Active videos",
      value: formatInt(activeVideos ?? 0),
    },
    {
      icon: Flame,
      label: "Top video today",
      value: topVideoToday?.title || "—",
      sub: topVideoToday ? `${formatCompact(topVideoToday.views_today ?? 0)} views` : undefined,
    },
  ];

  const chartData = reachTrend.map((r) => ({
    label: shortDay(r.day),
    total: r.total_reach ?? 0,
    new: r.new_reach ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {cards.map((c) => (
          <div key={c.label} className="glass-card min-w-0 p-3 sm:p-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <c.icon size={15} className="text-primary" />
              </div>
              <p className="min-w-0 truncate text-xs font-medium text-muted-foreground">
                {c.label}
              </p>
            </div>
            <p className="mt-3 truncate text-base sm:text-xl font-heading font-bold" title={String(c.value)}>
              {c.value}
            </p>
            {c.sub && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{c.sub}</p>
            )}
          </div>
        ))}
      </div>

      <div className="glass-card p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold">Reach — last 7 days</h3>
          <p className="text-[11px] text-muted-foreground">
            Total reach vs. new (first-time) viewers per day
          </p>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="total"
                name="Total reach"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="new"
                name="New reach"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold">Top 10 videos — last 30 days</h3>
          <p className="text-[11px] text-muted-foreground">Ranked by total views</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="text-right">Views (30d)</TableHead>
              <TableHead className="text-right">Unique viewers</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topVideos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                  No video views recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              topVideos.map((v, i) => (
                <TableRow key={v.video_id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium truncate max-w-[280px]" title={v.title || ""}>
                    {v.title || "Untitled"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCompact(v.views_30d ?? 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCompact(v.unique_views ?? 0)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
