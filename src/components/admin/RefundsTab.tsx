import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Loader2, Shield, AlertCircle } from "lucide-react";

interface RefundRow {
  id: string;
  user_id: string;
  payment_id: string | null;
  plan: string;
  amount: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  reviewed_at: string | null;
  admin_note: string | null;
  subscription_id: string | null;
}

export const RefundsTab = () => {
  const queryClient = useQueryClient();
  const [rejectModal, setRejectModal] = useState<{ open: boolean; row: RefundRow | null }>({ open: false, row: null });
  const [rejectNote, setRejectNote] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);

  const { data: refunds = [] } = useQuery({
    queryKey: ["admin-refunds"],
    queryFn: async () => {
      const { data } = await supabase
        .from("refund_requests")
        .select("*")
        .order("requested_at", { ascending: false });
      return (data || []) as RefundRow[];
    },
  });

  const userIds = Array.from(new Set(refunds.map((r) => r.user_id)));
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-refund-profiles", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));

  // Stats
  const totalRequests = refunds.length;
  const pending = refunds.filter((r) => r.status === "pending").length;
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const approvedThisMonth = refunds.filter(
    (r) => r.status === "approved" && r.reviewed_at && new Date(r.reviewed_at) >= startOfMonth,
  ).length;
  const totalRefunded = refunds.filter((r) => r.status === "approved").reduce((a, r) => a + (r.amount || 0), 0);

  const daysSince = (iso: string) => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
    return days;
  };

  const handleApprove = async (row: RefundRow) => {
    if (!confirm(`Approve refund of ₹${row.amount} for ${profileMap[row.user_id]?.full_name || "user"}?`)) return;
    setActioning(row.id);
    const { data, error } = await supabase.functions.invoke("refund-request", {
      body: { action: "approve", refund_id: row.id },
    });
    setActioning(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed to approve");
      return;
    }
    toast.success(
      `Refund approved. Now process the actual refund in Razorpay dashboard using Payment ID: ${row.payment_id || "n/a"}`,
      { duration: 10000 },
    );
    queryClient.invalidateQueries({ queryKey: ["admin-refunds"] });
  };

  const handleReject = async () => {
    if (!rejectModal.row) return;
    setActioning(rejectModal.row.id);
    const { data, error } = await supabase.functions.invoke("refund-request", {
      body: { action: "reject", refund_id: rejectModal.row.id, admin_note: rejectNote.trim() || undefined },
    });
    setActioning(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed to reject");
      return;
    }
    toast.success("Refund rejected. User has been notified.");
    setRejectModal({ open: false, row: null });
    setRejectNote("");
    queryClient.invalidateQueries({ queryKey: ["admin-refunds"] });
  };

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "Total Requests", value: totalRequests, color: "" },
          { label: "Pending", value: pending, color: "text-amber-600" },
          { label: "Approved (this month)", value: approvedThisMonth, color: "text-emerald-600" },
          { label: "Total Refunded", value: `₹${totalRefunded.toLocaleString("en-IN")}`, color: "text-destructive" },
        ].map((s) => (
          <div key={s.label} className="glass-card p-2.5 sm:p-4">
            <p className="text-[10px] text-muted-foreground mb-0.5 sm:text-xs">{s.label}</p>
            <p className={`text-base font-heading font-bold sm:text-2xl ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {refunds.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          <Shield className="mx-auto mb-2 text-muted-foreground" size={28} />
          No refund requests yet. Your customers are happy! 🎉
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="p-3 text-xs text-muted-foreground font-medium">User</th>
                    <th className="p-3 text-xs text-muted-foreground font-medium">Plan</th>
                    <th className="p-3 text-xs text-muted-foreground font-medium">Amount</th>
                    <th className="p-3 text-xs text-muted-foreground font-medium">Payment ID</th>
                    <th className="p-3 text-xs text-muted-foreground font-medium">Requested</th>
                    <th className="p-3 text-xs text-muted-foreground font-medium">Reason</th>
                    <th className="p-3 text-xs text-muted-foreground font-medium">Status</th>
                    <th className="p-3 text-xs text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((r) => {
                    const profile = profileMap[r.user_id];
                    const days = daysSince(r.requested_at);
                    const inWindow = days <= 7;
                    return (
                      <tr key={r.id} className="border-b border-border/50">
                        <td className="p-3">
                          <p className="font-medium text-xs">{profile?.full_name || "—"}</p>
                          <p className="text-[11px] text-muted-foreground">{profile?.phone || profile?.email || ""}</p>
                        </td>
                        <td className="p-3 text-xs capitalize">{r.plan.replace(/_/g, " ")}</td>
                        <td className="p-3 text-xs font-semibold">₹{r.amount.toLocaleString("en-IN")}</td>
                        <td className="p-3 text-[10px] font-mono text-muted-foreground max-w-[140px] truncate">
                          {r.payment_id || "—"}
                        </td>
                        <td className="p-3 text-xs">
                          <p>{format(new Date(r.requested_at), "dd MMM")}</p>
                          <p className={`text-[10px] ${inWindow ? "text-emerald-600" : "text-muted-foreground"}`}>
                            {days}d ago
                          </p>
                        </td>
                        <td className="p-3 text-[11px] text-muted-foreground max-w-[160px] truncate">
                          {r.reason || "—"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-1 ${
                              r.status === "pending"
                                ? "bg-amber-500/10 text-amber-600"
                                : r.status === "approved"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3">
                          {r.status === "pending" && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                className="h-7 text-[10px] gap-1"
                                onClick={() => handleApprove(r)}
                                disabled={actioning === r.id}
                              >
                                {actioning === r.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] gap-1"
                                onClick={() => setRejectModal({ open: true, row: r })}
                                disabled={actioning === r.id}
                              >
                                <XCircle size={10} /> Reject
                              </Button>
                            </div>
                          )}
                          {r.status !== "pending" && r.reviewed_at && (
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(r.reviewed_at), "dd MMM")}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {refunds.map((r) => {
              const profile = profileMap[r.user_id];
              const days = daysSince(r.requested_at);
              return (
                <div key={r.id} className="glass-card p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{profile?.full_name || "—"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{profile?.phone || profile?.email}</p>
                    </div>
                    <span
                      className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] ${
                        r.status === "pending"
                          ? "bg-amber-500/10 text-amber-600"
                          : r.status === "approved"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] border-t border-border pt-2">
                    <span className="capitalize">{r.plan.replace(/_/g, " ")}</span>
                    <span className="font-semibold">₹{r.amount.toLocaleString("en-IN")}</span>
                    <span className="text-muted-foreground">{days}d ago</span>
                  </div>
                  {r.reason && <p className="text-[11px] text-muted-foreground italic">"{r.reason}"</p>}
                  {r.status === "pending" && (
                    <div className="flex gap-1.5">
                      <Button size="sm" className="flex-1 h-7 text-[10px]" onClick={() => handleApprove(r)} disabled={actioning === r.id}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-[10px]"
                        onClick={() => setRejectModal({ open: true, row: r })}
                        disabled={actioning === r.id}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 text-xs flex items-start gap-2">
        <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
        <span className="text-muted-foreground">
          <b className="text-foreground">Reminder:</b> Approving here only updates the user's plan and notifies them.
          You must process the actual refund manually in your Razorpay dashboard using the Payment ID shown.
        </span>
      </div>

      {/* Reject modal */}
      <Dialog open={rejectModal.open} onOpenChange={(o) => !o && setRejectModal({ open: false, row: null })}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Reject refund request</DialogTitle>
            <DialogDescription>
              Tell the user why their refund doesn't qualify. This message will be sent to them.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. Outside the 7-day guarantee window"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value.slice(0, 500))}
            className="min-h-[80px]"
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setRejectModal({ open: false, row: null })}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleReject} disabled={actioning === rejectModal.row?.id}>
              {actioning === rejectModal.row?.id && <Loader2 size={14} className="animate-spin mr-1.5" />}
              Confirm Reject
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
