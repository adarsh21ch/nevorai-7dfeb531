import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Ticket = {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  created_at: string;
};

const statusColor = (s: string) =>
  s === "open" ? "text-red-500 bg-red-500/10"
  : s === "in_progress" ? "text-amber-500 bg-amber-500/10"
  : "text-emerald-500 bg-emerald-500/10";

const statusLabel = (s: string) =>
  s === "open" ? "🔴 Open" : s === "in_progress" ? "🟡 In Progress" : "🟢 Resolved";

const AdminSupportPage = () => {
  useDocumentTitle("Support Tickets");
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Ticket | null>(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as Ticket[];
    },
  });

  const openCount = tickets.filter((t) => t.status === "open").length;

  const updateStatus = async (id: string, status: Ticket["status"]) => {
    const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id);
    if (error) return toast.error("Could not update status");
    toast.success("Status updated");
    qc.invalidateQueries({ queryKey: ["support-tickets"] });
    if (selected?.id === id) setSelected({ ...selected, status });
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
              <MessageSquare size={22} /> Support Tickets
            </h1>
            <p className="text-sm text-muted-foreground">
              {openCount > 0 ? <span className="text-red-500 font-semibold">{openCount} unread</span> : "All caught up"}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
        ) : tickets.length === 0 ? (
          <div className="glass-card p-12 text-center text-muted-foreground">No support tickets yet.</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block premium-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} onClick={() => setSelected(t)} className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="font-medium">{t.user_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{t.user_email}</div>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate">{t.subject}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(t.status)}`}>{statusLabel(t.status)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {tickets.map((t) => (
                <button key={t.id} onClick={() => setSelected(t)} className="w-full text-left premium-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{t.subject}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.user_name || t.user_email}</div>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor(t.status)}`}>{statusLabel(t.status)}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-lg">
            {selected && (
              <>
                <DialogHeader>
                  <DialogTitle className="pr-8">{selected.subject}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    From <strong>{selected.user_name || "—"}</strong> · {selected.user_email}
                    <br />
                    {new Date(selected.created_at).toLocaleString()}
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3 text-sm whitespace-pre-wrap break-words max-h-72 overflow-y-auto">
                    {selected.message}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <Select value={selected.status} onValueChange={(v) => updateStatus(selected.id, v as Ticket["status"])}>
                      <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">🔴 Open</SelectItem>
                        <SelectItem value="in_progress">🟡 In Progress</SelectItem>
                        <SelectItem value="resolved">🟢 Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <a
                      href={`mailto:${selected.user_email}?subject=Re: ${encodeURIComponent(selected.subject)}`}
                      className="flex-1"
                    >
                      <Button variant="hero" className="w-full"><Mail size={14} /> Reply via Email</Button>
                    </a>
                    <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminSupportPage;
