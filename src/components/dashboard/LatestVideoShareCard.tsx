import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Rocket, FileText, Radio, Video as VideoIcon } from "lucide-react";
import { toast } from "sonner";

interface Props {
  video: {
    id: string;
    title: string;
    thumbnail_url: string | null;
    public_url: string | null;
  };
}

export const LatestVideoShareCard = ({ video }: Props) => {
  const publicUrl = `${window.location.origin}/v/${video.id}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Public video link copied!");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <div className="premium-card overflow-hidden">
      <div className="grid gap-0 sm:grid-cols-[200px,1fr]">
        <Link to={`/v/${video.id}` as any} className="group relative block aspect-video bg-muted sm:aspect-auto">
          {video.thumbnail_url ? (
            <img src={video.thumbnail_url} alt={video.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : video.public_url ? (
            <video src={video.public_url} muted preload="metadata" playsInline className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <VideoIcon size={28} className="text-muted-foreground" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
            <ExternalLink size={20} className="text-white" />
          </div>
        </Link>

        <div className="flex flex-col gap-3 p-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Your latest video</p>
            <h3 className="mt-1 truncate font-heading text-base font-semibold">{video.title}</h3>
            <p className="mt-1 truncate text-xs text-muted-foreground">{publicUrl}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="hero" size="sm" onClick={copyLink}>
              <Copy size={14} /> Copy Link
            </Button>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink size={14} /> Open
              </Button>
            </a>
            <Link to={`/funnels/create?videoId=${video.id}` as any}>
              <Button variant="outline" size="sm">
                <Rocket size={14} /> Create Funnel
              </Button>
            </Link>
            <Link to={`/landing-pages/create?videoId=${video.id}` as any}>
              <Button variant="ghost" size="sm">
                <FileText size={14} /> Landing Page
              </Button>
            </Link>
            <Link to={`/live?videoId=${video.id}` as any}>
              <Button variant="ghost" size="sm">
                <Radio size={14} /> Go Live
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
