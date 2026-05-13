import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useNevoraiMember } from "@/hooks/useNevoraiMember";
import { useAuth } from "@/hooks/useAuth";

/**
 * One-time welcome popup shown to a Nevorai Member after their access is granted.
 * Uses profiles.nevorai_member_notified (set via mark-member-notified function)
 * to ensure it only appears once per user.
 */
export const NevoraiMemberWelcome = () => {
  const { user } = useAuth();
  const { isMember, notified, expiresAt, isLoading, markWelcomeShown } = useNevoraiMember();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user || isLoading) return;
    if (isMember && !notified) {
      setOpen(true);
    }
  }, [user, isMember, notified, isLoading]);

  const handleClose = async () => {
    setOpen(false);
    await markWelcomeShown();
  };

  if (!isMember) return null;

  const validityLine = expiresAt
    ? `Valid until ${new Date(expiresAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}`
    : "Continuous access";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="text-primary" size={26} />
          </div>
          <DialogTitle className="text-center text-xl">🎉 Welcome to Nevorai Flow!</DialogTitle>
          <DialogDescription className="text-center space-y-2 pt-2">
            <span className="block">
              Because you're a Nevorai Pro member, you have free access to the Nevorai Flow Individual plan.
            </span>
            <span className="block text-left mt-3 space-y-1 text-sm">
              ✓ Create up to 10 video funnels<br />
              ✓ Capture leads from every prospect<br />
              ✓ Track who watched and for how long<br />
              ✓ Follow up on WhatsApp instantly
            </span>
            <span className="block text-xs text-muted-foreground pt-2">Your access: {validityLine}</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleClose} className="w-full">
            Start Creating My First Funnel →
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
