import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Users, Copy, Trash2, Link as LinkIcon, ShieldOff } from "lucide-react";
import { WhatsAppShareButton } from "@/components/WhatsAppShareButton";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  landingPageId: string;
  landingPageTitle: string;
}

const sb: any = supabase;

const randomToken = () => {
  const a = new Uint8Array(18);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24);
};

export const ShareWithTeamModal = ({ open, onOpenChange, landingPageId, landingPageTitle }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: share, refetch: refetchShare } = useQuery({
    queryKey: ["lp-share", landingPageId],
    queryFn: async () => {
      const { data } = await sb
        .from("landing_page_shares")
        .select("*")
        .eq("landing_page_id", landingPageId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: open && !!landingPageId,
  });

  const { data: collaborators = [], refetch: refetchCollabs } = useQuery({
    queryKey: ["lp-collabs", landingPageId],
    queryFn: async () => {
      const { data: rows } = await sb
        .from("landing_page_collaborators")
        .select("user_id, role, joined_at")
        .eq("landing_page_id", landingPageId)
        .order("joined_at", { ascending: false });
      const ids = (rows || []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await sb
        .from("profiles").select("id, full_name, email").in("id", ids);
      const pmap = new Map((profs || []).map((p: any) => [p.id, p]));
      return (rows || []).map((r: any) => ({ ...r, profile: pmap.get(r.user_id) }));
    },
    enabled: open && !!landingPageId,
  });

  useEffect(() => {
    if (!open || !landingPageId) return;
    const ch = sb.channel(`lp-collab-${landingPageId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "landing_page_collaborators", filter: `landing_page_id=eq.${landingPageId}` },
        () => refetchCollabs())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [open, landingPageId, refetchCollabs]);

  const createLink = async () => {
    if (!user?.id) return;
    setCreating(true);
    const { error } = await sb.from("landing_page_shares").insert({
      landing_page_id: landingPageId,
      owner_id: user.id,
      token: randomToken(),
      role: "viewer",
      is_active: true,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Team link created");
    refetchShare();
  };

  const toggleActive = async (next: boolean) => {
    if (!share?.id) return;
    const { error } = await sb.from("landing_page_shares").update({ is_active: next }).eq("id", share.id);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "Link re-enabled" : "Link revoked");
    refetchShare();
  };

  const removeCollab = async (userId: string) => {
    const { error } = await sb.from("landing_page_collaborators").delete()
      .eq("landing_page_id", landingPageId).eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success("Removed");
    refetchCollabs();
    qc.invalidateQueries({ queryKey: ["lp-collabs", landingPageId] });
  };

  const shareUrl = share?.token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/team/leads/${share.token}`
    : "";

  const copy = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users size={18} /> Share leads with your team</DialogTitle>
          <DialogDescription>
            Anyone who opens this link and signs in to Nevorai will see <strong>{landingPageTitle}</strong>’s leads — updating live as new people fill the form. You can revoke access anytime.
          </DialogDescription>
        </DialogHeader>

        {!share ? (
          <div className="py-4">
            <Button onClick={createLink} disabled={creating} className="w-full">
              <LinkIcon size={16} className="mr-2" />
              {creating ? "Creating..." : "Create team link"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input value={shareUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={copy} title="Copy link"><Copy size={14} /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <WhatsAppShareButton
                url={shareUrl}
                message={`I'm sharing leads for "${landingPageTitle}" with you on Nevorai. Sign in to view:`}
                size="sm"
              />
              <div className="ml-auto flex items-center gap-2 text-sm">
                <ShieldOff size={14} className="text-muted-foreground" />
                <span className="text-muted-foreground">Active</span>
                <Switch checked={!!share.is_active} onCheckedChange={toggleActive} />
              </div>
            </div>

            <Separator />

            <div>
              <div className="text-sm font-semibold mb-2">
                Team members ({collaborators.length})
              </div>
              {collaborators.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one has joined yet. Share the link above.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-auto">
                  {collaborators.map((c: any) => (
                    <div key={c.user_id} className="flex items-center justify-between gap-3 text-sm border rounded-md px-3 py-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.profile?.full_name || c.profile?.email || "Member"}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c.profile?.email} · joined {format(new Date(c.joined_at), "d MMM yyyy")}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeCollab(c.user_id)} title="Remove">
                        <Trash2 size={14} className="text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ShareWithTeamModal;
