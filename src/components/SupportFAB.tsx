import { useState } from "react";
import { MessageCircle, Loader2, BookOpen, Send } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const SupportFAB = () => {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "form">("menu");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  const submit = async () => {
    const s = subject.trim();
    const m = message.trim();
    if (s.length < 3) return toast.error("Please add a subject (min 3 characters)");
    if (m.length < 10) return toast.error("Please describe your issue (min 10 characters)");
    if (s.length > 200 || m.length > 4000) return toast.error("Message is too long");

    setSubmitting(true);
    const { error } = await (supabase as any).from("support_tickets").insert({
      user_id: user.id,
      user_email: user.email || profile?.email || "",
      user_name: profile?.full_name || null,
      subject: s,
      message: m,
    });
    setSubmitting(false);

    if (error) return toast.error("Could not send. Please try again.");
    toast.success("We've received your message. We'll respond within 24 hours.");
    setSubject(""); setMessage(""); setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => { setView("menu"); setOpen(true); }}
        aria-label="Get help"
        className="fixed bottom-20 md:bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg text-white transition-all hover:scale-110 bg-gradient-brand-rich"
      >
        <MessageCircle size={22} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          {view === "menu" ? (
            <>
              <DialogHeader>
                <DialogTitle>How can we help?</DialogTitle>
                <DialogDescription>
                  Most questions are answered by a 60-second tutorial video.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 pt-1">
                <Link
                  to="/help"
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:bg-primary/5"
                >
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <BookOpen size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">Browse tutorials</div>
                    <p className="text-xs text-muted-foreground">
                      Short videos showing exactly how to use Nevorai Flow.
                    </p>
                  </div>
                </Link>
                <button
                  onClick={() => setView("form")}
                  className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5"
                >
                  <div className="rounded-lg bg-accent/10 p-2 text-accent">
                    <Send size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">Send us a message</div>
                    <p className="text-xs text-muted-foreground">
                      We'll get back to you within 24 hours.
                    </p>
                  </div>
                </button>
              </div>
              <p className="pt-2 text-center text-[11px] text-muted-foreground">
                Or email{" "}
                <a href="mailto:teamnevorai@gmail.com" className="text-primary hover:underline">
                  teamnevorai@gmail.com
                </a>
              </p>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Send a message</DialogTitle>
                <DialogDescription>We'll respond within 24 hours.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Subject</label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Briefly, what's the issue?" maxLength={200} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Message</label>
                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe what's happening, steps to reproduce, etc." rows={5} maxLength={4000} />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button onClick={submit} disabled={submitting} variant="hero" className="flex-1">
                    {submitting ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : "Send Message"}
                  </Button>
                  <Button variant="outline" onClick={() => setView("menu")} disabled={submitting}>Back</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
