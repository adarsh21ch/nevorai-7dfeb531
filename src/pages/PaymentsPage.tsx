import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { IndianRupee, Check, X, Download } from "lucide-react";

const PaymentsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: flows = [] } = useQuery({
    queryKey: ["my-flows", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("funnels").select("id, title").eq("owner_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["all-payments", user?.id, flows],
    queryFn: async () => {
      const ids = flows.map((f) => f.id);
      if (!ids.length) return [];
      const { data } = await supabase.from("funnel_payments").select("*").in("funnel_id", ids).order("submitted_at", { ascending: false });
      return data || [];
    },
    enabled: flows.length > 0,
  });

  const verify = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      await supabase.from("funnel_payments").update({ status, verified_by: user?.id, verified_at: new Date().toISOString(), rejection_note: note || null }).eq("id", id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["all-payments"] }); toast.success("Payment updated"); },
  });

  const verified = payments.filter((p) => p.status === "verified");
  const pending = payments.filter((p) => p.status === "pending");
  const totalVerified = verified.reduce((a, p) => a + p.amount, 0);
  const totalPending = pending.reduce((a, p) => a + p.amount, 0);

  const kpis = [
    { label: "Total Verified", value: `₹${totalVerified.toLocaleString("en-IN")}` },
    { label: "Pending", value: `₹${totalPending.toLocaleString("en-IN")}` },
    { label: "Total Transactions", value: String(payments.length) },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold">Payments</h1>
            <div className="page-header-accent" />
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            const csv = "Amount,Transaction ID,Status,Date\n" + payments.map((p) => `${p.amount},"${p.upi_transaction_id || ""}","${p.status}","${p.submitted_at}"`).join("\n");
            const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = "payments.csv"; a.click();
          }}><Download size={14} /> Export</Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {kpis.map((k) => (
            <div key={k.label} className="glass-card p-5">
              <span className="text-xs text-muted-foreground">{k.label}</span>
              <div className="text-xl font-heading font-bold mt-1">{k.value}</div>
            </div>
          ))}
        </div>

        {payments.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <IndianRupee size={40} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No payments received yet.</p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-muted-foreground">
                  <th className="text-left p-3 font-medium">Amount</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Flow</th>
                  <th className="text-left p-3 font-medium">Transaction ID</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="p-3 font-medium font-heading">₹{p.amount.toLocaleString("en-IN")}</td>
                      <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">{funnels.find((f) => f.id === p.funnel_id)?.title || "—"}</td>
                      <td className="p-3 text-muted-foreground">{p.upi_transaction_id || "—"}</td>
                      <td className="p-3"><Badge variant={p.status === "verified" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}>{p.status}</Badge></td>
                      <td className="p-3 text-muted-foreground">{new Date(p.submitted_at!).toLocaleDateString("en-IN")}</td>
                      <td className="p-3">
                        {p.status === "pending" && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => verify.mutate({ id: p.id, status: "verified" })}><Check size={14} className="text-success" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { const n = prompt("Reason?"); if (n) verify.mutate({ id: p.id, status: "rejected", note: n }); }}><X size={14} className="text-destructive" /></Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PaymentsPage;
