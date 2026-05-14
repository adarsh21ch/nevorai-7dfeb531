import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/landing/Logo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sparkles, Upload, PlayCircle, QrCode, MessageCircle,
  Smartphone, ArrowRight, Eye, MapPin, X,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { VideoUploadModal } from "@/components/VideoUploadModal";

// ============================================================================
// Demo video — replace with your real R2-hosted 30s sample.
// ID points to a row in `video_assets` (must be is_shared = true).
// ============================================================================
const DEMO_VIDEO_ID = "00000000-0000-0000-0000-000000000000"; // TODO: set demo video id
const DEMO_VIDEO_DURATION_SEC = 30;

const Onboarding = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Step-4 baseline: view_count when we entered the wait state.
  const [baselineViews, setBaselineViews] = useState<number | null>(null);
  const watchStartRef = useRef<number | null>(null);
  const [syntheticPercent, setSyntheticPercent] = useState(0);

  const publicUrl =
    typeof window !== "undefined" && videoId
      ? `${window.location.origin}/v/${videoId}`
      : "";

  // Poll the chosen video's view_count once we hit step 4.
  const { data: viewCount = 0 } = useQuery({
    queryKey: ["onboarding-views", videoId],
    queryFn: async () => {
      if (!videoId) return 0;
      const { data } = await (supabase as any)
        .from("video_assets")
        .select("view_count")
        .eq("id", videoId)
        .maybeSingle();
      return data?.view_count ?? 0;
    },
    enabled: !!videoId && step === 4,
    refetchInterval: 2000,
  });

  // Capture baseline when entering step 4.
  useEffect(() => {
    if (step !== 4 || !videoId || baselineViews !== null) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("video_assets")
        .select("view_count")
        .eq("id", videoId)
        .maybeSingle();
      setBaselineViews(data?.view_count ?? 0);
    })();
  }, [step, videoId, baselineViews]);

  // Once a new view is detected, kick a synthetic 0→100% timer over 30s.
  const watching =
    baselineViews !== null && (viewCount as number) > baselineViews;

  useEffect(() => {
    if (!watching) return;
    if (watchStartRef.current === null) watchStartRef.current = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - (watchStartRef.current ?? Date.now())) / 1000;
      setSyntheticPercent(Math.min(100, (elapsed / DEMO_VIDEO_DURATION_SEC) * 100));
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [watching]);

  const finished = syntheticPercent >= 100;

  const completeOnboarding = async (showToast = true) => {
    if (!user || completing) return;
    setCompleting(true);
    try {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user.id);
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      if (showToast) toast.success("Welcome to nFlow!");
      navigate("/dashboard");
    } finally {
      setCompleting(false);
    }
  };

  const handleSkip = () => completeOnboarding(false);

  const handleUploadSuccess = (uploadedId?: string) => {
    setUploadOpen(false);
    if (uploadedId) {
      setVideoId(uploadedId);
      setUsingDemo(false);
      setStep(3);
    }
  };

  const handleUseDemo = () => {
    setVideoId(DEMO_VIDEO_ID);
    setUsingDemo(true);
    setStep(3);
  };

  const qrUrl = useMemo(
    () =>
      publicUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(publicUrl)}`
        : "",
    [publicUrl],
  );

  const phone = (profile as any)?.phone || (profile as any)?.whatsapp_number || "";
  const waUrl = publicUrl
    ? `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(
        `🎬 My nFlow video — open it on your phone:\n${publicUrl}`,
      )}`
    : "";

  const stepLabel = `Step ${step} of 4`;

  return (
    <div className="min-h-screen w-full gradient-bg-subtle relative">
      <div className="absolute inset-0 animate-grid opacity-20 pointer-events-none" />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-8">
        <Logo size="sm" />
        <button
          onClick={handleSkip}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          aria-label="Skip onboarding"
        >
          Skip <X size={12} />
        </button>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-col items-stretch px-4 pb-10 sm:px-6">
        {/* Progress dots */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 w-10 rounded-full transition-colors ${
                s <= step ? "gradient-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {stepLabel}
        </p>

        <div className="glass-card p-6 sm:p-8 space-y-5 rounded-3xl sm:rounded-2xl">
          {step === 1 && (
            <div className="space-y-5 text-center">
              <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <Sparkles size={12} /> Welcome
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-bold leading-tight">
                Welcome to nFlow.
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                In <span className="text-foreground font-semibold">60 seconds</span>, you'll see the magic.
                We'll help you share a video and watch yourself open it from your phone — in real-time.
              </p>
              <Button variant="hero" size="lg" className="w-full" onClick={() => setStep(2)}>
                Let's Go <ArrowRight size={16} />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-xl sm:text-2xl font-heading font-bold">Pick a 30-second test video</h2>
                <p className="text-sm text-muted-foreground">…or use our demo video.</p>
              </div>

              <button
                onClick={() => setUploadOpen(true)}
                className="group w-full flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-card/40 p-6 transition-all hover:border-primary hover:bg-primary/5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-brand-rich text-white shadow-glow">
                  <Upload size={20} />
                </div>
                <p className="text-sm font-heading font-semibold">Upload from device</p>
                <p className="text-[11px] text-muted-foreground">MP4, MOV or WebM</p>
              </button>

              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                or
                <div className="h-px flex-1 bg-border" />
              </div>

              <Button variant="outline" size="lg" className="w-full" onClick={handleUseDemo}>
                <PlayCircle size={16} /> Use demo video
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center">
              <h2 className="text-xl sm:text-2xl font-heading font-bold">Open this on your phone</h2>
              <p className="text-sm text-muted-foreground">
                Scan the QR code, or send the link to your WhatsApp. Then come back here.
              </p>

              {qrUrl ? (
                <div className="mx-auto inline-flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-4">
                  <img src={qrUrl} alt="QR code" width={200} height={200} className="rounded-md" />
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted p-6 text-xs text-muted-foreground">
                  <QrCode size={20} className="mx-auto mb-2" />
                  Preparing your link…
                </div>
              )}

              <div className="rounded-lg bg-muted p-3 text-xs font-mono text-foreground break-all">
                {publicUrl}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  variant="hero"
                  className="w-full"
                  onClick={() => phone && publicUrl && window.open(waUrl, "_blank", "noopener")}
                  disabled={!phone || !publicUrl}
                  title={!phone ? "Add a phone number to your profile to enable this" : ""}
                >
                  <MessageCircle size={16} /> Send to my WhatsApp
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setStep(4)}>
                  <Smartphone size={16} /> I opened it on phone
                </Button>
              </div>
              {!phone && (
                <p className="text-[11px] text-muted-foreground">
                  Tip: add your phone in Profile to send links to WhatsApp.
                </p>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <h2 className="text-xl sm:text-2xl font-heading font-bold">
                  {finished ? "🎉 That's nFlow." : watching ? "👀 Watching now: You" : "Waiting for you to open it…"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {finished
                    ? "You'll see this for every prospect."
                    : watching
                      ? "We see your phone watching this video right now."
                      : "Open the link on your phone. This page updates in real-time."}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full ${watching ? "bg-success animate-pulse" : "bg-muted-foreground/40"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {watching ? "You" : "Waiting…"}
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <Smartphone size={11} /> Phone
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} /> {(profile as any)?.city || "Your location"}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs tabular-nums font-semibold text-foreground">
                    {Math.round(syntheticPercent)}%
                  </span>
                </div>
                <Progress value={syntheticPercent} className="h-2" />
              </div>

              {!watching && (
                <div className="rounded-lg bg-muted/40 border border-border p-3 flex items-start gap-2 text-xs text-muted-foreground">
                  <Eye size={14} className="mt-0.5 shrink-0 text-primary" />
                  <p>
                    Don't see anything yet? Make sure you opened the link on your phone (not refreshed this tab).
                  </p>
                </div>
              )}

              <Button
                variant="hero"
                size="lg"
                className="w-full"
                onClick={() => completeOnboarding(true)}
                disabled={!finished || completing}
              >
                {completing ? "Finishing…" : finished ? (<>Set up my account <ArrowRight size={16} /></>) : "Waiting for video to finish…"}
              </Button>
              <button
                onClick={() => completeOnboarding(true)}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                Skip the wait → take me to the dashboard
              </button>
            </div>
          )}
        </div>

        {usingDemo && step >= 3 && (
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Using the demo video — you can upload your own anytime from My Videos.
          </p>
        )}
      </div>

      <VideoUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={handleUploadSuccess}
        skipStorageCheck
      />
    </div>
  );
};

export default Onboarding;
