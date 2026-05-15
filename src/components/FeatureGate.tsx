import { ReactNode } from "react";
import { usePlan } from "@/hooks/usePlan";
import { Lock, Crown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
  title?: string;
  description?: string;
}

const defaultMessages: Record<string, { title: string; desc: string }> = {
  video_upload: { title: "Upload Videos", desc: "Upload and manage your own video content with a paid plan." },
  video_link: { title: "Add Video by Link", desc: "Add videos from YouTube, Vimeo, or any URL with a paid plan." },
  video_sharing: { title: "Video Sharing", desc: "Share videos with your audience as a Pro member." },
  live_broadcast: { title: "Live Broadcasts", desc: "Go live with your audience — available on the Pro plan." },
  advanced_analytics: { title: "Advanced Analytics", desc: "Get deep insights into your flows and leads." },
  premium_templates: { title: "Premium Templates", desc: "Access premium flow templates to convert faster." },
  premium_automation: { title: "Automation", desc: "Automate WhatsApp messages and lead workflows." },
};

export const FeatureGate = ({ feature, children, fallback, title, description }: FeatureGateProps) => {
  const { canAccess, plan } = usePlan();

  if (canAccess(feature)) {
    return <>{children}</>;
  }

  if (fallback) return <>{fallback}</>;

  const msg = defaultMessages[feature] || { title: title || "Premium Feature", desc: description || "Upgrade to access this feature." };

  return (
    <div className="relative">
      <div className="glass-card p-8 text-center space-y-4 border-dashed border-2 border-primary/20">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Lock className="text-primary" size={24} />
        </div>
        <h3 className="text-lg font-heading font-semibold">{msg.title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">{msg.desc}</p>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Crown size={14} className="text-amber-500" />
          <span>Available on {
            feature.includes("sharing") || feature.includes("live") ? "Pro" :
            "Basic & Pro"
          } plans</span>
        </div>
        <Link to="/upgrade">
          <Button variant="default" className="gap-2">
            Upgrade Now <ArrowRight size={16} />
          </Button>
        </Link>
      </div>
    </div>
  );
};

/** Inline lock badge for buttons */
export const FeatureLockBadge = ({ feature }: { feature: string }) => {
  const { canAccess } = usePlan();
  if (canAccess(feature)) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-2 py-0.5 rounded-full">
      <Crown size={10} /> Pro
    </span>
  );
};
