import { Navigate, Link, useNavigate } from "@/lib/router-compat";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { UpgradeBanner } from "@/components/UpgradeBanner";
import { MonthlyViewsBanner } from "@/components/MonthlyViewsBanner";
import { DashboardKpiStrip } from "@/components/dashboard/DashboardKpiStrip";
import { DashboardContentRow } from "@/components/dashboard/DashboardContentRow";
import { LatestVideoShareCard } from "@/components/dashboard/LatestVideoShareCard";
import { useHasVideos } from "@/hooks/useHasVideos";
import { Layers, Users, Eye, IndianRupee, TrendingUp, BarChart3, Calendar, Plus, ArrowRight, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMonthlyViews } from "@/hooks/useMonthlyViews";
import { useDailyViews } from "@/hooks/useDailyViews";

const fmt = (n: number) => n.toLocaleString("en-IN");

type StatColor = "purple" | "teal" | "green" | "blue" | "amber" | "gray";
const accentClass: Record<StatColor, string> = {
  purple: "border-t-2 border-violet-500/40",
  teal: "border-t-2 border-emerald-500/40",
  green: "border-t-2 border-green-500/40",
  blue: "border-t-2 border-blue-500/40",
  amber: "border-t-2 border-amber-500/40",
  gray: "border-t-2 border-border",
};
const iconClass: Record<StatColor, string> = {
  purple: "text-violet-400",
  teal: "text-emerald-400",
  green: "text-green-400",
  blue: "text-blue-400",
  amber: "text-amber-400",
  gray: "text-muted-foreground",
};

const Dashboard = () => {
  useDocumentTitle("Dashboard");
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const monthly = useMonthlyViews();
  const daily = useDailyViews();
  const { hasVideos, latestVideo, isLoading: videosLoading } = useHasVideos();

  // First-run "magic moment" onboarding: send brand-new users through the
  // 4-step self-share flow before they ever see the dashboard.
  if (user && profile && profile.onboarding_completed === false) {
    return <Navigate to="/onboarding" />;
  }

  // Upload-first onboarding: brand-new users with zero videos go straight to upload.
  if (user && !videosLoading && !hasVideos) {
    return <Navigate to="/onboarding-upload" />;
  }


  const { data: funnels = [] } = useQuery({
    queryKey: ["my-funnels", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("funnels").select("*").eq("owner_id", user!.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: leadCount = 0 } = useQuery({
    queryKey: ["total-leads", user?.id],
    queryFn: async () => {
      const funnelIds = funnels.map((f) => f.id);
      if (!funnelIds.length) return 0;
      const { count } = await supabase.from("funnel_leads").select("*", { count: "exact", head: true }).in("funnel_id", funnelIds);
      return count || 0;
    },
    enabled: funnels.length > 0,
  });

  const { data: activeLive } = useQuery({
    queryKey: ["active-live-session", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("live_sessions")
        .select("id, title")
        .eq("owner_id", user.id)
        .eq("status", "live")
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const totalViews = funnels.reduce((a, f) => a + (f.total_views || 0), 0);
  const publishedCount = funnels.filter((f) => f.is_published).length;
  const convRate = totalViews > 0 ? ((leadCount / totalViews) * 100).toFixed(1) : "0";
  const remainingToday = daily.isUnlimited ? "∞" : Math.max(0, daily.limit - daily.used);

  const stats: Array<{ icon: any; label: string; value: string; sub: string; color: StatColor; href: string }> = [
    { icon: BarChart3, label: "Views Today", value: fmt(daily.used), sub: `${remainingToday} remaining`, color: "purple", href: "/insights" },
    { icon: Calendar, label: "Views This Month", value: fmt(monthly.used), sub: `of ${monthly.isUnlimited ? "∞" : fmt(monthly.limit)}`, color: "teal", href: "/insights" },
    { icon: IndianRupee, label: "Revenue", value: "₹0", sub: "This month", color: "green", href: "/payments" },
    { icon: Users, label: "Total Leads", value: fmt(leadCount), sub: "All time", color: "blue", href: "/leads" },
    { icon: TrendingUp, label: "Conversion Rate", value: `${convRate}%`, sub: "Leads / Views", color: "amber", href: "/insights" },
    { icon: Eye, label: "Video Plays", value: fmt(totalViews), sub: "All time", color: "gray", href: "/videos" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5 overflow-x-hidden">
        {activeLive && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-5 py-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-sm font-semibold text-emerald-400">LIVE NOW: {activeLive.title}</span>
            <button
              onClick={() => navigate(`/live/${activeLive.id}`)}
              className="ml-auto rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/15"
            >
              Manage <ArrowRight size={12} className="inline" />
            </button>
          </div>
        )}

        <UpgradeBanner />
        <MonthlyViewsBanner />

        {/* Header + actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold">Dashboard</h1>
            <div className="page-header-accent" />
            <p className="mt-2 text-sm text-muted-foreground">
              Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}! Here's your nFlow by Nevorai overview.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/funnels/create"><Button variant="hero" size="sm"><Plus size={14} /> Create Funnel</Button></Link>
            <Link to="/videos"><Button variant="outline" size="sm"><Eye size={14} /> Add Video</Button></Link>
          </div>
        </div>

        {/* Latest video — share-first spotlight */}
        {latestVideo && <LatestVideoShareCard video={latestVideo} />}

        {/* Plan + view limits strip */}
        <DashboardKpiStrip />

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {stats.map((s) => (
            <Link
              key={s.label}
              to={s.href}
              className={`group flex flex-col gap-1.5 rounded-2xl border border-border bg-card/40 p-4 transition-all hover:-translate-y-0.5 hover:border-border/80 hover:bg-card/70 ${accentClass[s.color]}`}
            >
              <div className="flex items-center gap-2">
                <s.icon size={14} className={iconClass[s.color]} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</span>
              </div>
              <div className="text-2xl font-heading font-extrabold leading-none">{s.value}</div>
              <p className="text-[11px] text-muted-foreground">{s.sub}</p>
            </Link>
          ))}
        </div>

        {/* Content row */}
        <DashboardContentRow />

        {/* Recent funnels */}
        {funnels.length === 0 ? (
          <div className="premium-card p-10 text-center">
            <div className="stat-icon mx-auto mb-3 h-14 w-14 rounded-2xl">
              <Layers size={26} className="text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-heading font-semibold">No funnels yet</h3>
            <p className="mx-auto mb-5 max-w-sm text-sm text-muted-foreground">Create your first video funnel and start capturing leads on autopilot.</p>
            <Link to="/funnels/create"><Button variant="hero" size="lg">Create Your First Funnel</Button></Link>
          </div>
        ) : (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-heading font-semibold">Recent Funnels</h2>
              <Link to="/funnels" className="flex items-center gap-1 text-xs text-primary hover:underline">View all <ArrowRight size={12} /></Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {funnels.slice(0, 3).map((f) => (
                <Link to={`/funnels/${f.id}`} key={f.id} className="premium-card p-4 group">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${f.is_published ? "bg-success" : "bg-muted-foreground"}`} />
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${f.is_published ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                      {f.is_published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <h3 className="mb-2 truncate text-sm font-medium">{f.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye size={12} /> {f.total_views || 0}</span>
                    <span className="flex items-center gap-1"><Users size={12} /> {f.total_leads || 0}</span>
                    <span className="flex items-center gap-1"><IndianRupee size={12} /> {f.total_payments || 0}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
