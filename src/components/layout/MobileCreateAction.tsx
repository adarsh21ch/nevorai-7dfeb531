import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Plus, Upload, Layers, FileText, Radio } from "lucide-react";
import { useHasVideos } from "@/hooks/useHasVideos";
import { useState as useStateAlias } from "react";
import { VideoUploadModal } from "@/components/VideoUploadModal";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Mobile-only "Create" action — center button in the bottom nav.
 * Opens a bottom sheet of high-level create actions.
 * Phase 6/7: gates flow/landing/live on having a video.
 */
export const MobileCreateAction = () => {
  const [open, setOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useStateAlias(false);
  const { hasVideos } = useHasVideos();
  const qc = useQueryClient();

  const needsUpload = !hasVideos;

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            aria-label="Create"
            className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-primary/25 ring-offset-2 ring-offset-card shadow-md transition-transform active:scale-95 hover:bg-primary/90"
          >
            <Plus size={20} />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl border-border p-0">
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle className="text-left font-heading">Create</SheetTitle>
          </SheetHeader>
          <div className="grid gap-2 p-3">
            <button
              onClick={() => { setOpen(false); setUploadOpen(true); }}
              className="flex items-center gap-3 rounded-xl border border-border p-4 text-left hover:bg-muted"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Upload size={18} /></span>
              <span className="min-w-0">
                <span className="block text-sm font-heading font-semibold">Upload Video</span>
                <span className="block text-xs text-muted-foreground">Start with the video — share or use later.</span>
              </span>
            </button>
            <CreateRow
              icon={Layers}
              title="Create Flow"
              desc={needsUpload ? "Upload a video first to start a flow." : "Pick a video and turn it into a flow."}
              href={needsUpload ? "/onboarding-upload" : "/flows/create"}
              onClick={() => setOpen(false)}
            />
            <CreateRow
              icon={FileText}
              title="Create Landing Page"
              desc={needsUpload ? "Upload a video first." : "Capture leads with a video landing page."}
              href={needsUpload ? "/onboarding-upload" : "/landing-pages/create"}
              onClick={() => setOpen(false)}
            />
            <CreateRow
              icon={Radio}
              title="Go Live"
              desc={needsUpload ? "Upload a video first." : "Schedule a live session with your video."}
              href={needsUpload ? "/onboarding-upload" : "/live"}
              onClick={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <VideoUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => { qc.invalidateQueries({ queryKey: ["has-videos"] }); qc.invalidateQueries({ queryKey: ["videos"] }); }}
      />
    </>
  );
};

const CreateRow = ({ icon: Icon, title, desc, href, onClick }: { icon: any; title: string; desc: string; href: string; onClick: () => void }) => (
  <Link
    to={href as any}
    onClick={onClick}
    className="flex items-center gap-3 rounded-xl border border-border p-4 hover:bg-muted"
  >
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground"><Icon size={18} /></span>
    <span className="min-w-0">
      <span className="block text-sm font-heading font-semibold">{title}</span>
      <span className="block text-xs text-muted-foreground">{desc}</span>
    </span>
  </Link>
);
