import { Play, ExternalLink, Calendar, ClipboardList, CreditCard, UserCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const STEP_TYPES = [
  {
    value: "video",
    label: "Video",
    icon: Play,
    description: "Show a video and unlock the next step after watching",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    value: "cta",
    label: "CTA / Link",
    icon: ExternalLink,
    description: "Button + redirect to any URL",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    value: "booking",
    label: "Booking / Call",
    icon: Calendar,
    description: "Book a call or Zoom meeting",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
  },
] as const;

// Retained for getStepTypeMeta() so existing funnels with legacy step types still render correctly.
const LEGACY_STEP_TYPES = [
  { value: "lead_form", label: "Lead Form", icon: ClipboardList, description: "Collect their info before continuing", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { value: "payment", label: "Payment", icon: CreditCard, description: "Collect UPI payment proof", color: "text-amber-400", bg: "bg-amber-500/10" },
  { value: "manual_approval", label: "Manual Unlock", icon: UserCheck, description: "You approve manually before next step", color: "text-foreground", bg: "bg-muted" },
] as const;

interface StepTypeSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: string) => void;
}

export const StepTypeSelector = ({ open, onClose, onSelect }: StepTypeSelectorProps) => {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Choose Step Type</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            What do you want your prospect to do in this step?
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          {STEP_TYPES.map((type) => {
            const isLocked = (type as any).comingSoon === true;
            return (
              <button
                key={type.value}
                disabled={isLocked}
                onClick={() => { if (isLocked) return; onSelect(type.value); onClose(); }}
                className={`relative flex flex-col items-center gap-2 p-5 rounded-[14px] border border-border transition-all text-center group ${isLocked ? "opacity-55 cursor-not-allowed" : "hover:border-primary/40 hover:bg-primary/[0.06]"}`}
              >
                {isLocked && (
                  <span className="absolute top-1.5 right-1.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-amber-500/15 text-amber-600 px-1.5 py-0.5">Soon</span>
                )}
                <div className={`w-11 h-11 rounded-xl ${type.bg} flex items-center justify-center`}>
                  <type.icon size={22} className={type.color} />
                </div>
                <div>
                  <p className={`font-bold text-[14px] text-foreground transition-colors ${!isLocked && "group-hover:text-primary"}`} style={{ fontFamily: "'Plus Jakarta Sans', var(--font-heading), sans-serif" }}>
                    {type.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {type.description}
                  </p>
                </div>
              </button>
            );
          })}

        </div>
      </DialogContent>
    </Dialog>
  );
};

export const getStepTypeMeta = (type: string) => {
  return STEP_TYPES.find((t) => t.value === type)
    || LEGACY_STEP_TYPES.find((t) => t.value === type)
    || STEP_TYPES[0];
};
