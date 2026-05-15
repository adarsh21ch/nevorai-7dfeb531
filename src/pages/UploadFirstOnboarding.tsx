import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { VideoUploadModal } from "@/components/VideoUploadModal";
import { Upload, Link2, BarChart3, Play, Sparkles, ArrowRight } from "lucide-react";

const UploadFirstOnboarding = () => {
  useDocumentTitle("Upload your first video");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);

  const handleUploaded = () => {
    queryClient.invalidateQueries({ queryKey: ["has-videos"] });
    queryClient.invalidateQueries({ queryKey: ["videos"] });
    setUploadOpen(false);
    // Bring them to the dashboard which now shows their latest video & share actions.
    navigate("/dashboard");
  };

  const steps = [
    { icon: Upload, title: "Upload video", desc: "MP4, MOV or WebM up to 500 MB." },
    { icon: Link2, title: "Copy share link", desc: "Send it like a YouTube link — anywhere." },
    { icon: BarChart3, title: "Capture views & leads", desc: "Track who watched and turn it into a flow later." },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8 py-6 sm:py-10">
        <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
          <Sparkles size={12} /> Welcome to Nevorai
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-heading font-bold sm:text-4xl">Upload your first video</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
            Share it like a YouTube link, then turn it into a flow when you're ready.
          </p>
        </div>

        <button
          onClick={() => setUploadOpen(true)}
          className="group relative flex w-full max-w-xl flex-col items-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed border-primary/40 bg-card/40 p-8 transition-all hover:border-primary hover:bg-primary/5 sm:p-12"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand-rich text-white shadow-glow">
            <Upload size={28} />
          </div>
          <div className="text-center">
            <p className="text-base font-heading font-semibold">Upload Your First Video</p>
            <p className="mt-1 text-xs text-muted-foreground">Tap to choose a file from your device</p>
          </div>
        </button>

        <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-2xl border border-border bg-card/40 p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <s.icon size={14} />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Step {i + 1}
                </span>
              </div>
              <p className="text-sm font-heading font-semibold">{s.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="hero" size="lg" onClick={() => setUploadOpen(true)}>
            <Upload size={16} /> Upload Video
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate("/dashboard")}>
            <Play size={14} /> Skip for now <ArrowRight size={14} />
          </Button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          You can always come back to this from <span className="text-foreground">Videos</span>.
        </p>
      </div>

      <VideoUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onSuccess={handleUploaded} />
    </DashboardLayout>
  );
};

export default UploadFirstOnboarding;
