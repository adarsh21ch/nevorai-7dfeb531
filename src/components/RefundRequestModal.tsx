import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface RefundRequestModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RefundRequestModal = ({ open, onClose, onSuccess }: RefundRequestModalProps) => {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("refund-request", {
      body: { action: "submit", reason: reason.trim() || undefined },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed to submit refund request");
      return;
    }
    toast.success("Refund request submitted. We'll process it within 24 hours.");
    setReason("");
    onSuccess();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[440px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-heading font-bold">Request a Refund</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-2 space-y-2">
            <span className="block">We're sorry nFlow by Nevorai didn't work out for you.</span>
            <span className="block">
              Your refund request will be sent to our team. We'll process it within 24 hours via the original payment method.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          <label className="text-xs font-medium text-muted-foreground">
            Optional: Tell us why (helps us improve)
          </label>
          <Textarea
            placeholder="What didn't work for you?"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 1000))}
            className="min-h-[90px] resize-none"
          />
          <p className="text-[10px] text-muted-foreground text-right">{reason.length}/1000</p>
        </div>

        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 size={14} className="animate-spin mr-1.5" />}
            Submit Refund Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
