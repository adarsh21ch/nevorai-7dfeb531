import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Home,
  ListChecks,
  GraduationCap,
  User,
  Loader2,
  CheckCircle2,
  Trophy,
  Download,
  Calendar,
  Eye,
  ArrowLeft,
  PartyPopper,
} from "lucide-react";
import { WelcomeCard } from "@/components/funnel/member/WelcomeCard";
import { downloadCertificate } from "@/components/funnel/member/certificate";

interface StoredLead {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  submittedAt?: number;
}

const MemberDashboard = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<string>("home");

  // Identify the lead from localStorage. No new login surface — same convention as
  // PrivateLeadForm uses: nf_lead_{funnelId}.
  const [storedLead, setStoredLead] = useState<StoredLead | null>(null);
  const [sessionId] = useState<string>(() => {
    let s = localStorage.getItem("nf_session_id");
    if (!s) {
      s = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("nf_session_id", s);
    }
    return s;
  });

  // 1) Load flow by slug
  const { data: flow, isLoading: funnelLoading } = useQuery({
    queryKey: ["member-flow", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funnels")
        .select(
          "id, slug, title, description, owner_id, speaker_name, speaker_photo_url, speaker_about, thumbnail_url, is_published",
        )
        .eq("slug", slug!)
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // 2) Hydrate the lead once flow resolves
  useEffect(() => {
    if (!flow) return;
    try {
      const raw = localStorage.getItem(`nf_lead_${flow.id}`);
      if (raw) setStoredLead(JSON.parse(raw));
    } catch {}
  }, [flow]);

  // 3) Load steps + progress + activity in parallel
  const { data: steps = [] } = useQuery({
    queryKey: ["member-steps", flow?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("funnel_steps")
        .select("id, title, step_order, step_type, is_active")
        .eq("funnel_id", funnel!.id)
        .eq("is_active", true)
        .order("step_order");
      return data || [];
    },
    enabled: !!flow?.id,
  });

  const { data: progress = [] } = useQuery({
    queryKey: ["member-progress", flow?.id, sessionId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_session_step_progress", {
        _funnel_id: funnel!.id,
        _session_id: sessionId,
      });
      return data || [];
    },
    enabled: !!flow?.id,
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["member-activity", flow?.id, sessionId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_session_activity", {
        _funnel_id: funnel!.id,
        _session_id: sessionId,
      });
      return data || [];
    },
    enabled: !!flow?.id,
  });

  // 4) Log a "dashboard visit" for today (counts toward Days Active)
  useEffect(() => {
    if (!flow?.id) return;
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      const { data: existing } = await supabase.rpc("has_activity_today", {
        _funnel_id: funnel.id,
        _session_id: sessionId,
        _activity_date: today,
      });
      if (!existing) {
        await supabase.from("member_activity_log").insert({
          funnel_id: funnel.id,
          lead_id: storedLead?.id ?? null,
          session_id: sessionId,
          activity_date: today,
          videos_watched: 0,
        });
      }
    })();
  }, [flow?.id, sessionId, storedLead?.id]);

  // Derived stats
  const stats = useMemo(() => {
    const totalSteps = steps.length;
    const completedSteps = progress.filter((p: any) => p.status === "completed").length;
    const videosWatched = progress.filter((p: any) => (p.max_watched_seconds || 0) > 5).length;
    const daysActive = new Set(activity.map((a: any) => a.activity_date)).size || 1;
    const memberSince = storedLead?.submittedAt
      ? new Date(storedLead.submittedAt)
      : null;
    const allDone = totalSteps > 0 && completedSteps === totalSteps;
    const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    return { totalSteps, completedSteps, videosWatched, daysActive, memberSince, allDone, pct };
  }, [steps, progress, activity, storedLead]);

  if (funnelLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hero-bg">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!flow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hero-bg text-white p-6 text-center">
        <div>
          <h1 className="text-xl font-bold mb-2">Program not found</h1>
          <p className="text-sm text-slate-400 mb-4">
            This flow may have been unpublished or the link is incorrect.
          </p>
          <Button onClick={() => navigate("/")}>Go home</Button>
        </div>
      </div>
    );
  }

  const memberName = storedLead?.name || "Member";
  const continueToProgram = () => navigate(`/f/${flow.slug}`);

  return (
    <div className="min-h-screen bg-hero-bg text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-hero-bg/80 backdrop-blur border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to={`/f/${flow.slug}`} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white">
            <ArrowLeft size={16} /> Back to program
          </Link>
          <div className="text-sm font-semibold truncate max-w-[55%] text-right">
            {flow.title}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 pb-28">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-white/5 border border-white/10 mb-6">
            <TabsTrigger value="home" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Home size={16} className="mr-1.5 hidden sm:inline" />Home
            </TabsTrigger>
            <TabsTrigger value="program" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ListChecks size={16} className="mr-1.5 hidden sm:inline" />Program
            </TabsTrigger>
            <TabsTrigger value="trainings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <GraduationCap size={16} className="mr-1.5 hidden sm:inline" />Trainings
            </TabsTrigger>
            <TabsTrigger value="profile" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <User size={16} className="mr-1.5 hidden sm:inline" />Profile
            </TabsTrigger>
          </TabsList>

          {/* HOME */}
          <TabsContent value="home" className="space-y-6 mt-0">
            <WelcomeCard
              memberName={memberName}
              speakerName={flow.speaker_name}
              speakerPhotoUrl={flow.speaker_photo_url}
              welcomeMessage={flow.description}
              onContinue={continueToProgram}
            />

            {/* Progress card */}
            <div className="rounded-2xl p-6 bg-hero-surface border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Your progress</h3>
                <span className="text-sm font-bold text-primary">
                  {stats.completedSteps} / {stats.totalSteps} steps
                </span>
              </div>
              <Progress value={stats.pct} className="h-2" />
              <p className="text-xs text-slate-400 mt-2">{stats.pct}% complete</p>

              {stats.allDone && (
                <div className="mt-5 p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-700/10 border border-amber-500/30">
                  <div className="flex items-start gap-3">
                    <PartyPopper className="text-amber-400 flex-shrink-0 mt-0.5" size={22} />
                    <div className="flex-1">
                      <p className="font-bold text-amber-200">Congratulations, {memberName.split(" ")[0]}!</p>
                      <p className="text-sm text-amber-100/80 mt-0.5">
                        You've completed every step of this program.
                      </p>
                      <Button
                        size="sm"
                        className="mt-3 bg-amber-500 hover:bg-amber-600 text-amber-950 font-semibold"
                        onClick={() =>
                          downloadCertificate({
                            memberName,
                            programName: flow.title,
                            signatureName: flow.speaker_name || undefined,
                          })
                        }
                      >
                        <Download size={14} className="mr-1.5" />
                        Download certificate
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* PROGRAM */}
          <TabsContent value="program" className="space-y-3 mt-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">All steps</h3>
              <Button size="sm" onClick={continueToProgram} className="bg-primary hover:bg-primary/90">
                Open program
              </Button>
            </div>
            {steps.length === 0 ? (
              <p className="text-sm text-slate-400">No steps yet.</p>
            ) : (
              steps.map((s, i) => {
                const p = progress.find((pp: any) => pp.funnel_step_id === s.id);
                const isDone = p?.status === "completed";
                const watched = p?.watched_percentage || 0;
                return (
                  <div
                    key={s.id}
                    className="rounded-xl p-4 bg-hero-surface border border-white/10 flex items-center gap-3"
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{
                        background: isDone ? "hsl(var(--primary) / 0.2)" : "rgba(255,255,255,0.05)",
                        color: isDone ? "hsl(var(--primary))" : "var(--color-hero-muted)",
                      }}
                    >
                      {isDone ? <CheckCircle2 size={18} /> : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{s.title || `Step ${i + 1}`}</p>
                      <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${watched}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">{watched}%</span>
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* TRAININGS */}
          <TabsContent value="trainings" className="mt-0">
            <div className="rounded-2xl p-10 bg-hero-surface border border-white/10 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
                <GraduationCap size={28} className="text-primary" />
              </div>
              <h3 className="text-lg font-bold mb-2">Trainings — Coming Soon</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Bonus courses and trainings from your creator will appear here. Check back soon.
              </p>
            </div>
          </TabsContent>

          {/* PROFILE */}
          <TabsContent value="profile" className="space-y-4 mt-0">
            <div className="rounded-2xl p-6 bg-hero-surface border border-white/10">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-lg">
                  {memberName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold">{memberName}</p>
                  <p className="text-xs text-slate-400">
                    {storedLead?.email || storedLead?.phone || "Anonymous viewer"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatTile icon={<Calendar size={16} />} label="Days active" value={stats.daysActive} />
                <StatTile icon={<Eye size={16} />} label="Videos watched" value={stats.videosWatched} />
                <StatTile icon={<CheckCircle2 size={16} />} label="Steps completed" value={stats.completedSteps} />
                <StatTile
                  icon={<Trophy size={16} />}
                  label="Member since"
                  value={
                    stats.memberSince
                      ? stats.memberSince.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                      : "Today"
                  }
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

const StatTile = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) => (
  <div className="rounded-xl p-3.5 bg-white/5 border border-white/10">
    <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5">
      {icon} {label}
    </div>
    <p className="font-bold text-lg">{value}</p>
  </div>
);

export default MemberDashboard;
