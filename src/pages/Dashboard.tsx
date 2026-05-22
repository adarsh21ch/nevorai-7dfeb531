import { useRef } from "react";
import { Navigate, Link, useNavigate } from "@/lib/router-compat";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { MonthlyViewsBanner } from "@/components/MonthlyViewsBanner";
import { DashboardKpiStrip } from "@/components/dashboard/DashboardKpiStrip";
import { DashboardContentRow } from "@/components/dashboard/DashboardContentRow";
import { LatestVideoShareCard } from "@/components/dashboard/LatestVideoShareCard";
import { useHasVideos } from "@/hooks/useHasVideos";
import { Layers, Users, Eye, IndianRupee, ArrowRight, Upload, Video as VideoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlan } from "@/hooks/usePlan";
import { VideoUploadModal } from "@/components/VideoUploadModal";
import { useState } from "react";


const Dashboard = () => {
  useDocumentTitle("Dashboard");
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { plan } = usePlan();
  const { hasVideos, latestVideo, isLoading: videosLoading } = useHasVideos();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const isFree = !plan.isPaid && plan.tier !== "trial";

  // Lead event now fires at signup success in useAuth.signUp — not here.
  // Dashboard mount is unreliable (lazy chunk + Strict Mode + fires for
  // every returning user, not just new signups).

  const openUploadFlow = () => uploadInputRef.current?.click();
  const handleUploadPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    e.target.value = "";
    if (!f) return;
    setPendingFile(f);
    setUploadOpen(true);
  };


  // ALL hooks must be called unconditionally before any early return.
  // Moving these above the auth/onboarding gates fixes a Rules-of-Hooks
  // violation that surfaced as the recurring "Something went wrong" boundary.
  const {
    data: funnels = [],
    isLoading: funnelsLoading,
    error: funnelsError,
    refetch: refetchFunnels,
  } = useQuery({
    queryKey: ["my-funnels", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("funnels")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
  });

  const {
    data: leadCount = 0,
    isLoading: leadCountLoading,
    error: leadCountError,
    refetch: refetchLeadCount,
  } = useQuery({
    queryKey: ["total-leads", user?.id, funnels.map((f) => f.id).join(",")],
    queryFn: async () => {
      const funnelIds = funnels.map((f) => f.id);
      if (!funnelIds.length) return 0;
      const { count } = await supabase
        .from("funnel_leads")
        .select("*", { count: "exact", head: true })
        .in("funnel_id", funnelIds);
      return count || 0;
    },
    enabled: !!user?.id && funnels.length > 0,
  });

  const {
    data: activeLive,
    isLoading: activeLiveLoading,
    error: activeLiveError,
    refetch: refetchActiveLive,
  } = useQuery({
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
    enabled: !!user?.id,
    refetchInterval: 120000,
  });

  // ---- conditional renders (after all hooks) ----

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  // First-run "magic moment" onboarding: send brand-new users through the
  // 4-step self-share flow before they ever see the dashboard.
  if (user && profile && profile.onboarding_completed === false) {
    return <Navigate to="/onboarding" />;
  }

  // Upload-first onboarding: brand-new users with zero videos go straight to upload.
  if (user && !videosLoading && !hasVideos) {
    return <Navigate to="/onboarding-upload" />;
  }

  if (funnelsLoading || leadCountLoading || activeLiveLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (funnelsError || leadCountError || activeLiveError) {
    return (
      <DashboardLayout>
        <div className="premium-card p-10 text-center">
          <h1 className="text-xl font-heading font-semibold">Couldn’t load dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">Please try again.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              refetchFunnels();
              refetchLeadCount();
              refetchActiveLive();
            }}
          >
            Retry
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  void leadCount; // referenced by query enabled chain only

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

        <MonthlyViewsBanner />

        {/* Header */}
        <div>
          <h1 className="text-2xl font-heading font-bold">Dashboard</h1>
          <div className="page-header-accent" />
          <p className="mt-2 text-sm text-muted-foreground">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}! Here's your Nevorai overview.
          </p>
        </div>

        {/* Primary action — one clear CTA */}
        <input
          ref={uploadInputRef}
          type="file"
          accept=".mp4,.mov,.webm,.m4v,.mkv,.avi,video/*"
          className="hidden"
          onChange={handleUploadPicked}
        />
        <Button
          variant="hero"
          size="lg"
          onClick={openUploadFlow}
          className="h-14 w-full rounded-2xl text-base font-semibold sm:w-auto sm:px-8"
        >
          <Upload size={18} className="mr-2" /> Upload Video
        </Button>

        {/* Latest video — share-first spotlight */}
        {latestVideo && <LatestVideoShareCard video={latestVideo} />}

        {/* Plan + view limits strip (Today's Views + Monthly Views) */}
        <DashboardKpiStrip />

        {/* View more insights link */}
        <div className="flex justify-end">
          <Link to="/insights" className="flex items-center gap-1 text-xs text-primary hover:underline">
            View more insights <ArrowRight size={12} />
          </Link>
        </div>

        {/* Content row */}
        <DashboardContentRow />

        {/* Recent funnels — gated for free users */}
        {funnels.length === 0 ? (
          isFree ? (
            <div className="premium-card p-10 text-center">
              <div className="stat-icon mx-auto mb-3 h-14 w-14 rounded-2xl">
                <VideoIcon size={26} className="text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-heading font-semibold">No videos yet</h3>
              <p className="mx-auto mb-5 max-w-sm text-sm text-muted-foreground">
                Upload your first video and share it with anyone via a short link.
              </p>
              <Button
                variant="hero"
                size="lg"
                onClick={openUploadFlow}
                className="h-12 w-full rounded-2xl font-semibold sm:w-auto sm:px-8"
              >
                <Upload size={16} className="mr-2" /> Upload Your First Video
              </Button>
            </div>
          ) : (
            <div className="premium-card p-10 text-center">
              <div className="stat-icon mx-auto mb-3 h-14 w-14 rounded-2xl">
                <Layers size={26} className="text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-heading font-semibold">No funnels yet</h3>
              <p className="mx-auto mb-5 max-w-sm text-sm text-muted-foreground">Create your first video funnel and start capturing leads on autopilot.</p>
              <Link to="/funnels/create">
                <Button variant="hero" size="lg" className="h-12 w-full rounded-2xl font-semibold sm:w-auto sm:px-8">
                  Create Your First Funnel
                </Button>
              </Link>
            </div>
          )
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

        <VideoUploadModal
          open={uploadOpen}
          onClose={() => { setUploadOpen(false); setPendingFile(null); }}
          onSuccess={() => { /* handled inside modal's "Video ready" step */ }}
          initialFile={pendingFile}
        />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
