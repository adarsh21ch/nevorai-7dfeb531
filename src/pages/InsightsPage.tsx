import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePageVisible } from "@/hooks/usePageVisible";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Users, UserCheck, Radio, Layers, FileText, Video, BarChart3, TrendingUp, Target } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend,
} from "recharts";
import { formatCompact, formatInt } from "@/lib/format";
import { KpiCard } from "@/components/insights/KpiCard";
import { LivePulseDot } from "@/components/insights/LivePulseDot";
import { ActivityFeed, type ActivityItem } from "@/components/insights/ActivityFeed";
import { cn } from "@/lib/utils";

const COLORS = ["hsl(var(--primary))", "#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

type Period = "today" | "7d" | "30d" | "all";
type Tab = "overview" | "videos" | "funnels" | "landing-pages" | "live";

const VALID_TABS: Tab[] = ["overview", "videos", "funnels", "landing-pages", "live"];

function getInitialTab(): Tab {
  if (typeof window === "undefined") return "overview";
  const sp = new URLSearchParams(window.location.search);
  const t = sp.get("tab");
  return (VALID_TABS.includes(t as Tab) ? t : "overview") as Tab;
}

function getInitialPeriod(): Period {
  if (typeof window === "undefined") return "7d";
  const stored = window.localStorage.getItem("insights:period") as Period | null;
  if (stored && ["today", "7d", "30d", "all"].includes(stored)) return stored;
  return "7d";
}

function periodStart(p: Period): Date | null {
  const now = new Date();
  if (p === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (p === "7d") return new Date(now.getTime() - 7 * 86400_000);
  if (p === "30d") return new Date(now.getTime() - 30 * 86400_000);
  return null;
}

function bucketByDay(rows: { at: string }[], days: number): number[] {
  const out = new Array(days).fill(0);
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  rows.forEach((r) => {
    const t = new Date(r.at).getTime();
    const dayIdx = Math.floor((startOfToday.getTime() - new Date(t).setHours(0, 0, 0, 0)) / 86400_000);
    const i = days - 1 - dayIdx;
    if (i >= 0 && i < days) out[i] += 1;
  });
  return out;
}

const PERIOD_LABELS: Record<Period, string> = { today: "Today", "7d": "7 days", "30d": "30 days", all: "All time" };

const InsightsPage = ({ embedded = false }: { embedded?: boolean } = {}) => {
  const isMobile = useIsMobile();
  useDocumentTitle(embedded ? "Tools" : isMobile ? "Activity" : "Insights");
  const { user, loading: authLoading } = useAuth();
  const visible = usePageVisible();

  const [tab, setTab] = useState<Tab>(getInitialTab);
  const [period, setPeriod] = useState<Period>(getInitialPeriod);

  // Sync tab → URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("tab") !== tab) {
      sp.set("tab", tab);
      window.history.replaceState({}, "", `${window.location.pathname}?${sp.toString()}`);
    }
  }, [tab]);

  // Persist period
  useEffect(() => {
    try { window.localStorage.setItem("insights:period", period); } catch {/* ignore */}
  }, [period]);

  const start = periodStart(period);
  const startIso = start?.toISOString() ?? null;

  // Previous-period bounds for trend chips
  const prevBounds = useMemo(() => {
    if (!start) return null;
    const len = Date.now() - start.getTime();
    return { from: new Date(start.getTime() - len).toISOString(), to: start.toISOString() };
  }, [start]);

  // Owned entities (always-on, for joins/titles)
  const { data: funnels = [], isLoading: funnelsLoading, error: funnelsError, refetch: refetchFunnels } = useQuery({
    queryKey: ["my-funnels", user?.id],
    queryFn: async () => (await supabase.from("funnels").select("id,title,slug,total_views,total_leads,is_published").eq("owner_id", user!.id)).data || [],
    enabled: !!user?.id,
  });

  const { data: landingPages = [], isLoading: lpLoading, error: lpError, refetch: refetchLPs } = useQuery({
    queryKey: ["my-landing-pages", user?.id],
    queryFn: async () => (await supabase.from("landing_pages").select("id,title,slug,total_views,total_registrations,status").eq("owner_id", user!.id)).data || [],
    enabled: !!user?.id,
  });

  const { data: videos = [] } = useQuery({
    queryKey: ["my-videos-insights", user?.id],
    queryFn: async () => (await supabase.from("video_assets").select("id,title,view_count,duration_seconds,created_at").eq("owner_id", user!.id)).data || [],
    enabled: !!user?.id,
  });

  const funnelIds = funnels.map((f) => f.id);
  const lpIds = landingPages.map((l) => l.id);
  const videoIds = videos.map((v) => v.id);

  // === Leads (current period) ===
  const { data: leads = [], refetch: refetchLeads } = useQuery({
    queryKey: ["leads-insights", user?.id, period, funnelIds.length],
    queryFn: async () => {
      if (!funnelIds.length) return [];
      let q = supabase.from("funnel_leads").select("*").in("funnel_id", funnelIds);
      if (startIso) q = q.gte("submitted_at", startIso);
      return (await q.order("submitted_at", { ascending: false }).limit(500)).data || [];
    },
    enabled: !!user?.id,
    refetchInterval: visible ? 60_000 : false,
  });

  const { data: leadsPrev = [] } = useQuery({
    queryKey: ["leads-prev", user?.id, period],
    queryFn: async () => {
      if (!funnelIds.length || !prevBounds) return [];
      const { data } = await supabase.from("funnel_leads").select("id").in("funnel_id", funnelIds).gte("submitted_at", prevBounds.from).lt("submitted_at", prevBounds.to);
      return data || [];
    },
    enabled: !!user?.id && !!prevBounds,
  });

  // === Registrations ===
  const { data: registrations = [], refetch: refetchRegs } = useQuery({
    queryKey: ["regs-insights", user?.id, period],
    queryFn: async () => {
      let q = supabase.from("landing_page_registrations").select("*").eq("owner_id", user!.id);
      if (startIso) q = q.gte("submitted_at", startIso);
      return (await q.order("submitted_at", { ascending: false }).limit(500)).data || [];
    },
    enabled: !!user?.id,
    refetchInterval: visible ? 60_000 : false,
  });

  const { data: regsPrev = [] } = useQuery({
    queryKey: ["regs-prev", user?.id, period],
    queryFn: async () => {
      if (!prevBounds) return [];
      const { data } = await supabase.from("landing_page_registrations").select("id").eq("owner_id", user!.id).gte("submitted_at", prevBounds.from).lt("submitted_at", prevBounds.to);
      return data || [];
    },
    enabled: !!user?.id && !!prevBounds,
  });

  // === View events: video, funnel, landing page (current period) ===
  const { data: videoViews = [] } = useQuery({
    queryKey: ["video-views", user?.id, period, videoIds.length],
    queryFn: async () => {
      if (!videoIds.length) return [] as any[];
      let q = (supabase as any).from("video_view_events").select("started_at,video_id").in("video_id", videoIds);
      if (startIso) q = q.gte("started_at", startIso);
      return (await q.limit(2000)).data || [];
    },
    enabled: !!user?.id,
    refetchInterval: visible ? 60_000 : false,
  });

  const { data: funnelViews = [] } = useQuery({
    queryKey: ["funnel-views", user?.id, period, funnelIds.length],
    queryFn: async () => {
      if (!funnelIds.length) return [] as any[];
      let q = (supabase as any).from("funnel_view_events").select("started_at,funnel_id").in("funnel_id", funnelIds);
      if (startIso) q = q.gte("started_at", startIso);
      return (await q.limit(2000)).data || [];
    },
    enabled: !!user?.id,
    refetchInterval: visible ? 60_000 : false,
  });

  const { data: lpViews = [] } = useQuery({
    queryKey: ["lp-views", user?.id, period, lpIds.length],
    queryFn: async () => {
      if (!lpIds.length) return [] as any[];
      let q = (supabase as any).from("landing_page_view_events").select("started_at,landing_page_id").in("landing_page_id", lpIds);
      if (startIso) q = q.gte("started_at", startIso);
      return (await q.limit(2000)).data || [];
    },
    enabled: !!user?.id,
    refetchInterval: visible ? 60_000 : false,
  });

  // === Live viewer counts (15s polling, recent heartbeats across all owned entities) ===
  const { data: liveViewers = 0 } = useQuery({
    queryKey: ["live-viewers", user?.id, funnelIds.length, lpIds.length, videoIds.length],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const queries: Promise<any>[] = [];
      if (videoIds.length) queries.push((supabase as any).from("video_view_events").select("id", { count: "exact", head: true }).in("video_id", videoIds).gte("last_heartbeat_at", cutoff));
      if (funnelIds.length) queries.push((supabase as any).from("funnel_view_events").select("id", { count: "exact", head: true }).in("funnel_id", funnelIds).gte("last_heartbeat_at", cutoff));
      if (lpIds.length) queries.push((supabase as any).from("landing_page_view_events").select("id", { count: "exact", head: true }).in("landing_page_id", lpIds).gte("last_heartbeat_at", cutoff));
      const results = await Promise.all(queries);
      return results.reduce((a, r) => a + (r.count || 0), 0);
    },
    enabled: !!user?.id,
    refetchInterval: visible ? 15_000 : false,
  });

  // === Recent activity feed (30s polling) ===
  const { data: feedItems = [] } = useQuery<ActivityItem[]>({
    queryKey: ["activity-feed", user?.id, funnelIds.length, lpIds.length],
    queryFn: async () => {
      const items: ActivityItem[] = [];
      if (funnelIds.length) {
        const { data: rows } = await supabase.from("funnel_leads").select("id,name,email,submitted_at,funnel_id,source_type,utm_source").in("funnel_id", funnelIds).order("submitted_at", { ascending: false }).limit(20);
        const titleMap = new Map(funnels.map((f) => [f.id, { title: f.title, slug: f.slug }]));
        (rows || []).forEach((r: any) => {
          const f = titleMap.get(r.funnel_id);
          items.push({
            id: `lead-${r.id}`,
            kind: "lead",
            entityType: "funnel",
            entityTitle: f?.title ?? "Funnel",
            entityHref: f ? `/funnels/${r.funnel_id}` : undefined,
            who: r.name ?? r.email ?? null,
            at: r.submitted_at,
            meta: r.utm_source ? `via ${r.utm_source}` : undefined,
          });
        });
      }
      const { data: regs } = await supabase.from("landing_page_registrations").select("id,name,email,submitted_at,landing_page_id,utm_source").eq("owner_id", user!.id).order("submitted_at", { ascending: false }).limit(20);
      const lpTitleMap = new Map(landingPages.map((l) => [l.id, { title: l.title, slug: l.slug }]));
      (regs || []).forEach((r: any) => {
        const lp = lpTitleMap.get(r.landing_page_id);
        items.push({
          id: `reg-${r.id}`,
          kind: "registration",
          entityType: "landing_page",
          entityTitle: lp?.title ?? "Landing page",
          entityHref: lp ? `/landing-pages/${r.landing_page_id}` : undefined,
          who: r.name ?? r.email ?? null,
          at: r.submitted_at,
          meta: r.utm_source ? `via ${r.utm_source}` : undefined,
        });
      });
      items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      return items.slice(0, 30);
    },
    enabled: !!user?.id,
    refetchInterval: visible ? 30_000 : false,
  });

  const isLoading = authLoading || funnelsLoading || lpLoading;
  const error = funnelsError || lpError;

  if (isLoading) {
    const loadingState = <div className="premium-card p-10 text-center"><p className="text-sm text-muted-foreground">Loading insights…</p></div>;
    return embedded ? loadingState : <DashboardLayout>{loadingState}</DashboardLayout>;
  }

  if (error) {
    const errorState = (
      <div className="premium-card p-10 text-center">
        <h1 className="text-xl font-heading font-semibold">Couldn't load insights</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please try again.</p>
        <Button variant="outline" className="mt-4" onClick={() => { refetchFunnels(); refetchLPs(); refetchLeads(); refetchRegs(); }}>Retry</Button>
      </div>
    );
    return embedded ? errorState : <DashboardLayout>{errorState}</DashboardLayout>;
  }

  // === Compute KPIs ===
  const totalEventViews = videoViews.length + funnelViews.length + lpViews.length;
  const uniqueLeads = leads.length + registrations.length;
  const prevLeads = leadsPrev.length + regsPrev.length;

  // Sparklines (last 7 days regardless of period for hero KPIs)
  const allViewRows = [
    ...videoViews.map((v: any) => ({ at: v.started_at })),
    ...funnelViews.map((v: any) => ({ at: v.started_at })),
    ...lpViews.map((v: any) => ({ at: v.started_at })),
  ];
  const viewsSpark = bucketByDay(allViewRows, 7);
  const leadsSpark = bucketByDay(
    [...leads.map((l: any) => ({ at: l.submitted_at })), ...registrations.map((r: any) => ({ at: r.submitted_at }))],
    7,
  );
  const uniqueViewerEstimate = totalEventViews; // proxy until session_id dedupe is added
  const viewerSpark = viewsSpark;

  const pageTitle = isMobile ? "Activity" : "Insights";
  const pageSubtitle = isMobile ? "Live pulse of what's happening." : "Track your numbers, grow your business.";

  // Top performers
  const topVideos = [...videos].sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 5);
  const topFunnels = [...funnels].sort((a, b) => (b.total_views || 0) - (a.total_views || 0)).slice(0, 5);
  const topLPs = [...landingPages].sort((a, b) => (b.total_views || 0) - (a.total_views || 0)).slice(0, 5);

  // Attribution: source_type breakdown of leads+regs
  const attribCounts: Record<string, number> = {};
  [...leads, ...registrations].forEach((row: any) => {
    const src = row.source_type || (row.funnel_id ? "funnel" : row.landing_page_id ? "landing_page" : "unknown");
    attribCounts[src] = (attribCounts[src] || 0) + 1;
  });
  const attribData = Object.entries(attribCounts).map(([name, value]) => ({ name, value }));

  // UTM source breakdown
  const utmCounts: Record<string, number> = {};
  [...leads, ...registrations].forEach((r: any) => {
    const s = r.utm_source || "direct";
    utmCounts[s] = (utmCounts[s] || 0) + 1;
  });
  const utmData = Object.entries(utmCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));

  // Device split (from funnel_leads)
  const deviceCounts: Record<string, number> = {};
  leads.forEach((l: any) => { const d = l.device_type || "unknown"; deviceCounts[d] = (deviceCounts[d] || 0) + 1; });
  const deviceData = Object.entries(deviceCounts).map(([name, value]) => ({ name, value }));

  // 30-day trend for the trend chart in overview
  const dailyLeads: Record<string, number> = {};
  [...leads, ...registrations].forEach((r: any) => {
    if (!r.submitted_at) return;
    const key = new Date(r.submitted_at).toISOString().slice(5, 10);
    dailyLeads[key] = (dailyLeads[key] || 0) + 1;
  });
  const dailyLeadData = Object.entries(dailyLeads).sort().map(([date, count]) => ({ date, leads: count }));

  const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" };

  const PeriodChip = ({ p }: { p: Period }) => (
    <button
      type="button"
      onClick={() => setPeriod(p)}
      className={cn(
        "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap",
        period === p ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:text-foreground",
      )}
    >
      {PERIOD_LABELS[p]}
    </button>
  );

  const content = (
    <div className="space-y-5">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 -mx-4 px-4 pt-2 pb-3 bg-background/85 backdrop-blur-sm border-b border-border/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
              {pageTitle}
              {liveViewers > 0 ? <LivePulseDot label={`${liveViewers} live`} /> : null}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">{pageSubtitle}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto ">
          <PeriodChip p="today" />
          <PeriodChip p="7d" />
          <PeriodChip p="30d" />
          <PeriodChip p="all" />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <div className="overflow-x-auto  -mx-4 px-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="funnels">Funnels</TabsTrigger>
            <TabsTrigger value="landing-pages">Landing</TabsTrigger>
            <TabsTrigger value="live">Live</TabsTrigger>
          </TabsList>
        </div>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-5">
          {/* Hero KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={Eye} label="Total Views" value={totalEventViews} spark={viewsSpark} suffix={PERIOD_LABELS[period]} previous={0} />
            <KpiCard icon={Users} label="Unique Viewers" value={uniqueViewerEstimate} spark={viewerSpark} suffix={PERIOD_LABELS[period]} previous={0} />
            <KpiCard icon={UserCheck} label="Total Leads" value={uniqueLeads} previous={prevLeads} spark={leadsSpark} suffix={PERIOD_LABELS[period]} />
            <KpiCard
              icon={Radio}
              label="Live Viewers"
              value={liveViewers}
              spark={[]}
              live={liveViewers > 0 ? <LivePulseDot label="LIVE" /> : <span className="text-[10px] text-muted-foreground">idle</span>}
            />
          </div>

          {/* Activity feed */}
          <div className="premium-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-heading font-semibold flex items-center gap-2">
                <TrendingUp size={14} className="text-primary" /> Recent Activity
              </h3>
              <span className="text-[10px] text-muted-foreground">Updates every 30s</span>
            </div>
            <ActivityFeed items={feedItems} />
          </div>

          {/* Top entities */}
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="premium-card p-5">
              <h3 className="text-sm font-heading font-semibold mb-3 flex items-center gap-2"><Video size={14} className="text-primary" /> Top Videos</h3>
              {topVideos.length ? (
                <ul className="space-y-2">
                  {topVideos.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate">{v.title}</span>
                      <span className="text-muted-foreground tabular-nums">{formatCompact(v.view_count || 0)} views</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-muted-foreground text-center py-6">No videos yet</p>}
            </div>
            <div className="premium-card p-5">
              <h3 className="text-sm font-heading font-semibold mb-3 flex items-center gap-2"><Layers size={14} className="text-primary" /> Top Funnels</h3>
              {topFunnels.length ? (
                <ul className="space-y-2">
                  {topFunnels.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate">{f.title}</span>
                      <span className="text-muted-foreground tabular-nums">{formatCompact(f.total_views || 0)} views · {formatInt(f.total_leads || 0)} leads</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-muted-foreground text-center py-6">No funnels yet</p>}
            </div>
          </div>

          {/* Attribution */}
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="premium-card p-5">
              <h3 className="text-sm font-heading font-semibold mb-4 flex items-center gap-2"><Target size={14} className="text-primary" /> Lead Attribution</h3>
              {attribData.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={attribData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                      {attribData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-muted-foreground text-center py-12">No attributed leads yet</p>}
            </div>
            <div className="premium-card p-5">
              <h3 className="text-sm font-heading font-semibold mb-4 flex items-center gap-2"><BarChart3 size={14} className="text-primary" /> Traffic Sources</h3>
              {utmData.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={utmData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={70} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" name="leads" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-muted-foreground text-center py-12">No traffic data yet</p>}
            </div>
          </div>

          {/* Trend area */}
          <div className="premium-card p-5">
            <h3 className="text-sm font-heading font-semibold mb-4">Lead Acquisition ({PERIOD_LABELS[period]})</h3>
            {dailyLeadData.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailyLeadData}>
                  <defs>
                    <linearGradient id="leadGradV2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="leads" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#leadGradV2)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground text-center py-12">No leads captured in this period</p>}
          </div>
        </TabsContent>

        {/* VIDEOS / FUNNELS / LP / LIVE — scaffolds for next phase */}
        <TabsContent value="videos">
          <div className="premium-card p-5">
            <h3 className="text-sm font-heading font-semibold mb-3 flex items-center gap-2"><Video size={14} className="text-primary" /> Your Videos</h3>
            {videos.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topVideos.map((v) => ({ name: v.title.length > 18 ? v.title.slice(0, 18) + "…" : v.title, views: v.view_count || 0 }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="views" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground text-center py-8">No videos yet</p>}
            <p className="text-[10px] text-muted-foreground mt-3">Per-video drill-down with retention curves, traffic sources, and viewer table ships in the next phase.</p>
          </div>
        </TabsContent>

        <TabsContent value="funnels">
          <div className="premium-card p-5">
            <h3 className="text-sm font-heading font-semibold mb-3 flex items-center gap-2"><Layers size={14} className="text-primary" /> Funnels Performance</h3>
            {topFunnels.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topFunnels.map((f) => ({ name: f.title.length > 15 ? f.title.slice(0, 15) + "…" : f.title, views: f.total_views || 0, leads: f.total_leads || 0 }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="leads" fill="#6366F1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground text-center py-8">No funnels yet</p>}
            {deviceData.length ? (
              <div className="mt-5">
                <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Lead Devices</h4>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={deviceData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                      {deviceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="landing-pages">
          <div className="premium-card p-5">
            <h3 className="text-sm font-heading font-semibold mb-3 flex items-center gap-2"><FileText size={14} className="text-primary" /> Landing Pages</h3>
            {topLPs.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topLPs.map((lp) => ({ name: lp.title.length > 15 ? lp.title.slice(0, 15) + "…" : lp.title, views: lp.total_views || 0, regs: lp.total_registrations || 0 }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="views" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="regs" name="registrations" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground text-center py-8">No landing pages yet</p>}
          </div>
        </TabsContent>

        <TabsContent value="live">
          <div className="premium-card p-5 text-center">
            <Radio size={28} className="mx-auto text-primary mb-2" />
            <h3 className="text-sm font-heading font-semibold">Live Sessions</h3>
            <p className="text-xs text-muted-foreground mt-1">{liveViewers > 0 ? `${liveViewers} viewer${liveViewers === 1 ? "" : "s"} active right now.` : "No live sessions running."}</p>
            <p className="text-[10px] text-muted-foreground mt-3">Registered vs attended, peak concurrent, and replay views land in the drill-down phase.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
};

export default InsightsPage;
