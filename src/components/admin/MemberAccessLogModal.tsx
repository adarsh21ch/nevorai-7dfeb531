import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  userId: string | null;
  email: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EVENT_COLORS: Record<string, string> = {
  granted: "bg-success/10 text-success",
  revoked: "bg-destructive/10 text-destructive",
  paused: "bg-amber-500/10 text-amber-600",
  resumed: "bg-success/10 text-success",
  expired: "bg-muted text-muted-foreground",
  notification_sent: "bg-primary/10 text-primary",
  warning_sent: "bg-amber-500/10 text-amber-600",
  access_checked: "bg-muted text-muted-foreground",
};

export const MemberAccessLogModal = ({ userId, email, open, onOpenChange }: Props) => {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["member-access-logs", userId, email],
    queryFn: async () => {
      let query = supabase
        .from("member_access_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (userId) query = query.eq("user_id", userId);
      else if (email) query = query.eq("email", email);
      const { data } = await query;
      return data || [];
    },
    enabled: open && !!(userId || email),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">Access Log {email && <span className="text-xs font-normal text-muted-foreground">— {email}</span>}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {isLoading && <p className="text-sm text-muted-foreground p-4">Loading…</p>}
          {!isLoading && logs.length === 0 && (
            <p className="text-sm text-muted-foreground p-4">No access events for this member yet.</p>
          )}
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="border border-border rounded-lg p-3 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${EVENT_COLORS[log.event_type] || "bg-muted"}`}>
                    {log.event_type}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  Source: <span className="font-mono">{log.source}</span>
                </div>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <pre className="bg-muted/40 rounded p-2 text-[10px] overflow-x-auto">{JSON.stringify(log.metadata, null, 2)}</pre>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
