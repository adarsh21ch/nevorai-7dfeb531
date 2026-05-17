import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePageVisible } from "@/hooks/usePageVisible";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Users, UserCheck, Radio, Layers, FileText, Video, BarChart3, TrendingUp, Target, Search, LayoutGrid, List } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid,
} from "recharts";
import { formatCompact, formatInt } from "@/lib/format";
import { KpiCard } from "@/components/insights/KpiCard";
import { LivePulseDot } from "@/components/insights/LivePulseDot";
import { ActivityFeed, type ActivityItem } from "@/components/insights/ActivityFeed";
import { EntityCard } from "@/components/insights/EntityCard";
import { InsightsEmptyState } from "@/components/insights/EmptyState";
import { cn } from "@/lib/utils";

const COLORS = ["hsl(var(--primary))", "#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

type SortKey = "recent" | "views" | "leads" | "alpha";

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
  // v2 key — old "insights:period" may persist "today" which makes the page
  // look broken for low-traffic creators on first open.
  const stored = window.localStorage.getItem("insights:period:v2") as Period | null;
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
  const { features } = usePlanLimits();

  const [tab, setTab] = useState<Tab>(getInitialTab);
  const [period, setPeriod] = useState<Period>(getInitialPeriod);
  const [sort, setSort] = useState<SortKey>("recent");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

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
    queryFn: async () => (await supabase.from("funnels").select("id,title,slug,total_views,total_leads,is_published,created_at").eq("owner_id", user!.id)).data || [],
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const { data: landingPages = [], isLoading: lpLoading, error: lpError, refetch: refetchLPs } = useQuery({
    queryKey: ["my-landing-pages", user?.id],
    queryFn: async () => (await supabase.from("landing_pages").select("id,title,slug,total_views,total_registrations,status,created_at").eq("owner_id", user!.id)).data || [],
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const { data: videos = [] } = useQuery({
    queryKey: ["my-videos-insights", user?.id],
    queryFn: async () => (await supabase.from("video_assets").select("id,title,view_count,duration_seconds,thumbnail_url,created_at").eq("owner_id", user!.id)).data || [],
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const { data: liveSessions = [] } = useQuery({
    queryKey: ["my-live-sessions", user?.id],
    queryFn: async () => (await supabase.from("live_sessions").select("id,title,slug,status,total_views,registration_count,scheduled_at,created_at,thumbnail_url,is_published").eq("owner_id", user!.id)).data || [],
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const funnelIds = funnels.map((f) => f.id);
  const lpIds = landingPages.map((l) => l.id);
  const videoIds = videos.map((v) => v.id);
  const liveIds = liveSessions.map((s) => s.id);

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
    staleTime: 30_000,
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
    staleTime: 5 * 60_000,
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
    staleTime: 30_000,
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
    staleTime: 5 * 60_000,
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
    staleTime: 30_000,
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
    staleTime: 30_000,
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
    staleTime: 30_000,
    refetchInterval: visible ? 60_000 : false,
  });

  // === Live viewer counts per entity (15s polling) ===
  const { data: liveMap = { videos: {}, funnels: {}, lps: {}, lives: {}, total: 0 } } = useQuery({
    queryKey: ["live-viewers-map", user?.id, videoIds.length, funnelIds.length, lpIds.length, liveIds.length],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const out = { videos: {} as Record<string, number>, funnels: {} as Record<string, number>, lps: {} as Record<string, number>, lives: {} as Record<string, number>, total: 0 };
      const calls: Promise<any>[] = [];
      if (videoIds.length) calls.push((supabase as any).from("video_view_events").select("video_id").in("video_id", videoIds).gte("last_heartbeat_at", cutoff).then((r: any) => ({ kind: "videos", rows: r.data || [], key: "video_id" })));
      if (funnelIds.length) calls.push((supabase as any).from("funnel_view_events").select("funnel_id").in("funnel_id", funnelIds).gte("last_heartbeat_at", cutoff).then((r: any) => ({ kind: "funnels", rows: r.data || [], key: "funnel_id" })));
      if (lpIds.length) calls.push((supabase as any).from("landing_page_view_events").select("landing_page_id").in("landing_page_id", lpIds).gte("last_heartbeat_at", cutoff).then((r: any) => ({ kind: "lps", rows: r.data || [], key: "landing_page_id" })));
      if (liveIds.length) calls.push((supabase as any).from("live_session_view_events").select("live_session_id").in("live_session_id", liveIds).gte("last_heartbeat_at", cutoff).then((r: any) => ({ kind: "lives", rows: r.data || [], key: "live_session_id" })));
      const results = await Promise.all(calls);
      results.forEach((r: any) => {
        r.rows.forEach((row: any) => {
          const id = row[r.key];
          (out as any)[r.kind][id] = ((out as any)[r.kind][id] || 0) + 1;
          out.total += 1;
        });
      });
      return out;
    },
    enabled: !!user?.id,
    refetchInterval: visible ? 15_000 : false,
  });

  const liveViewers = liveMap.total;


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

  // Per-entity event view & lead counts (period-scoped)
  const videoViewCount: Record<string, number> = {};
  videoViews.forEach((v: any) => { videoViewCount[v.video_id] = (videoViewCount[v.video_id] || 0) + 1; });
  const funnelViewCount: Record<string, number> = {};
  funnelViews.forEach((v: any) => { funnelViewCount[v.funnel_id] = (funnelViewCount[v.funnel_id] || 0) + 1; });
  const lpViewCount: Record<string, number> = {};
  lpViews.forEach((v: any) => { lpViewCount[v.landing_page_id] = (lpViewCount[v.landing_page_id] || 0) + 1; });
  const funnelLeadCount: Record<string, number> = {};
  leads.forEach((l: any) => { if (l.funnel_id) funnelLeadCount[l.funnel_id] = (funnelLeadCount[l.funnel_id] || 0) + 1; });
  const lpRegCount: Record<string, number> = {};
  registrations.forEach((r: any) => { if (r.landing_page_id) lpRegCount[r.landing_page_id] = (lpRegCount[r.landing_page_id] || 0) + 1; });

  const sortFn = (a: any, b: any, vA: number, vB: number, lA: number, lB: number) => {
    if (sort === "alpha") return (a.title || "").localeCompare(b.title || "");
    if (sort === "views") return vB - vA;
    if (sort === "leads") return lB - lA;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  };
  const matchSearch = (t: string) => !search || t.toLowerCase().includes(search.toLowerCase());

  const sortedVideos = [...videos].filter((v) => matchSearch(v.title || "")).sort((a, b) => sortFn(a, b, a.view_count || 0, b.view_count || 0, 0, 0));
  const sortedFunnels = [...funnels].filter((v) => matchSearch(v.title || "")).sort((a, b) => sortFn(a, b, a.total_views || 0, b.total_views || 0, a.total_leads || 0, b.total_leads || 0));
  const sortedLPs = [...landingPages].filter((v) => matchSearch(v.title || "")).sort((a, b) => sortFn(a, b, a.total_views || 0, b.total_views || 0, a.total_registrations || 0, b.total_registrations || 0));
  const sortedLives = [...liveSessions].filter((v) => matchSearch(v.title || "")).sort((a, b) => sortFn(a, b, a.total_views || 0, b.total_views || 0, a.registration_count || 0, b.registration_count || 0));


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
            {features.landingPages && <TabsTrigger value="landing-pages">Landing</TabsTrigger>}
            {features.goLive && <TabsTrigger value="live">Live</TabsTrigger>}
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

        {/* Filter toolbar shared across entity tabs */}
        {tab !== "overview" ? (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="h-8 pl-7 text-xs" />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-8 px-2 rounded-md border border-border bg-background text-xs">
              <option value="recent">Newest</option>
              <option value="views">Most viewed</option>
              <option value="leads">Most leads</option>
              <option value="alpha">A–Z</option>
            </select>
            <div className="hidden sm:flex items-center rounded-md border border-border overflow-hidden">
              <button type="button" onClick={() => setView("grid")} className={cn("p-1.5", view === "grid" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground")} aria-label="Grid"><LayoutGrid size={12} /></button>
              <button type="button" onClick={() => setView("list")} className={cn("p-1.5", view === "list" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground")} aria-label="List"><List size={12} /></button>
            </div>
          </div>
        ) : null}

        <TabsContent value="videos">
          {sortedVideos.length ? (
            <div className={view === "grid" ? "grid sm:grid-cols-2 lg:grid-cols-3 gap-3" : "space-y-2"}>
              {sortedVideos.map((v) => (
                <EntityCard
                  key={v.id}
                  icon={Video}
                  title={v.title}
                  href={`/insights/videos/${v.id}`}
                  thumbnail={v.thumbnail_url}
                  views={videoViewCount[v.id] ?? v.view_count ?? 0}
                  leads={0}
                  leadsLabel="leads"
                  liveCount={liveMap.videos[v.id] || 0}
                  createdAt={v.created_at}
                  variant={view}
                />
              ))}
            </div>
          ) : <InsightsEmptyState icon={Video} title="No videos yet" hint="Upload your first video to start tracking views." ctaLabel="Upload video" ctaTo="/videos" />}
        </TabsContent>

        <TabsContent value="funnels">
          {sortedFunnels.length ? (
            <div className={view === "grid" ? "grid sm:grid-cols-2 lg:grid-cols-3 gap-3" : "space-y-2"}>
              {sortedFunnels.map((f) => (
                <EntityCard
                  key={f.id}
                  icon={Layers}
                  title={f.title}
                  href={`/insights/funnels/${f.id}`}
                  views={funnelViewCount[f.id] ?? f.total_views ?? 0}
                  leads={funnelLeadCount[f.id] ?? f.total_leads ?? 0}
                  leadsLabel="leads"
                  liveCount={liveMap.funnels[f.id] || 0}
                  badge={f.is_published ? { label: "Live", tone: "success" } : { label: "Draft", tone: "muted" }}
                  createdAt={f.created_at}
                  variant={view}
                />
              ))}
            </div>
          ) : <InsightsEmptyState icon={Layers} title="No funnels yet" hint="Create a funnel to start capturing leads." ctaLabel="Create funnel" ctaTo="/funnels/create" />}
        </TabsContent>

        <TabsContent value="landing-pages">
          {sortedLPs.length ? (
            <div className={view === "grid" ? "grid sm:grid-cols-2 lg:grid-cols-3 gap-3" : "space-y-2"}>
              {sortedLPs.map((lp) => (
                <EntityCard
                  key={lp.id}
                  icon={FileText}
                  title={lp.title}
                  href={`/insights/landing-pages/${lp.id}`}
                  views={lpViewCount[lp.id] ?? lp.total_views ?? 0}
                  leads={lpRegCount[lp.id] ?? lp.total_registrations ?? 0}
                  leadsLabel="registrations"
                  liveCount={liveMap.lps[lp.id] || 0}
                  badge={lp.status === "published" ? { label: "Live", tone: "success" } : { label: lp.status || "Draft", tone: "muted" }}
                  createdAt={lp.created_at}
                  variant={view}
                />
              ))}
            </div>
          ) : <InsightsEmptyState icon={FileText} title="No landing pages yet" hint="Build a landing page to capture registrations." ctaLabel="Create landing page" ctaTo="/landing-pages/create" />}
        </TabsContent>

        <TabsContent value="live">
          {sortedLives.length ? (
            <div className={view === "grid" ? "grid sm:grid-cols-2 lg:grid-cols-3 gap-3" : "space-y-2"}>
              {sortedLives.map((s) => (
                <EntityCard
                  key={s.id}
                  icon={Radio}
                  title={s.title}
                  href={`/insights/live/${s.id}`}
                  thumbnail={s.thumbnail_url}
                  views={s.total_views ?? 0}
                  leads={s.registration_count ?? 0}
                  leadsLabel="registered"
                  liveCount={liveMap.lives[s.id] || 0}
                  badge={s.status === "live" ? { label: "LIVE", tone: "success" } : { label: s.status || "scheduled", tone: "muted" }}
                  createdAt={s.created_at}
                  variant={view}
                />
              ))}
            </div>
          ) : <InsightsEmptyState icon={Radio} title="No live sessions yet" hint="Schedule a live session to engage your audience in real time." ctaLabel="Create live session" ctaTo="/live" />}
        </TabsContent>

      </Tabs>
    </div>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
};

export default InsightsPage;
