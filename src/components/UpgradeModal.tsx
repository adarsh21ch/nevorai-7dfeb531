import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Lock, ArrowRight, Eye, Layers, Video, Radio, UserPlus, Download } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import { planName } from "@/config/planDisplay";

export type UpgradeReason = "views" | "flows" | "videos" | "live" | "leads" | "team";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  type: "upgrade" | "limit";
  resource?: string;
  currentCount?: number;
  limit?: number;
  tier?: string;
  reason?: UpgradeReason;
}

const REASON_COPY: Record<UpgradeReason, { title: string; desc: (planLabel: string, limit?: number) => string; icon: any }> = {
  views: { title: "You've used all your monthly flow views", desc: (p, l) => `Your ${p} plan includes ${l?.toLocaleString("en-IN")} flow views/month. Upgrade to Pro for 20,000 monthly views.`, icon: Eye },
  flows: { title: "You've reached your flow limit", desc: (p, l) => `Your ${p} plan allows ${l} flows. Upgrade to Pro to create more.`, icon: Layers },
  videos: { title: "You've reached your video upload limit", desc: (p, l) => `Your ${p} plan allows ${l} videos. Upgrade to Pro for more storage.`, icon: Video },
  live: { title: "You've reached your live sessions limit", desc: (p, l) => `Your ${p} plan allows ${l} live sessions. Upgrade to Pro to host more.`, icon: Radio },
  leads: { title: "You've reached the leads export limit", desc: (p, l) => `Your ${p} plan exports up to ${l} leads at a time. Upgrade to Pro for higher exports.`, icon: Download },
  team: { title: "Team members are a Pro feature", desc: () => `Invite your team and collaborate. Available on the Pro plan.`, icon: UserPlus },
};

export const UpgradeModal = ({ open, onClose, type, resource, currentCount, limit, tier, reason }: UpgradeModalProps) => {
  const navigate = useNavigate();
  const planLabel = tier ? planName(tier) : "current";

  const copy = reason ? REASON_COPY[reason] : null;
  const Icon = copy?.icon ?? (type === "upgrade" ? Crown : Lock);

  const title = copy ? copy.title : type === "upgrade" ? "This feature requires a subscription" : "You've reached your limit";
  const description = copy ? copy.desc(planLabel, limit) : type === "upgrade"
    ? "Free accounts can only view shared content. Subscribe to start creating."
    : `Your ${planLabel} plan allows up to ${limit} ${resource || "items"}. Upgrade to Pro to create more.`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[400px] rounded-2xl text-center p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="text-primary" size={24} />
          </div>
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-lg font-heading font-bold">{title}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>
            {type === "limit" && currentCount !== undefined && limit !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">
                Currently using <span className="font-semibold text-foreground">{currentCount}</span> of{" "}
                <span className="font-semibold text-foreground">{limit}</span>
              </p>
            )}
          </DialogHeader>
          <div className="flex flex-col gap-2 w-full mt-2">
            <Button className="w-full gap-2" onClick={() => { onClose(); navigate("/pricing"); }}>
              {type === "upgrade" ? "See Plans" : "Upgrade Plan"} <ArrowRight size={14} />
            </Button>
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={onClose}>
              {type === "upgrade" ? "Not now" : "Maybe later"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
