import { useParams, Link } from "@/lib/router-compat";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Eye, Users, TrendingUp, IndianRupee, Edit, Copy, ExternalLink, Search, Download, Phone, MessageCircle, Check, X, Lock } from "lucide-react";
import { LeadProgressTab } from "@/components/funnel/LeadProgressTab";
import { ViewersAnalyticsTab } from "@/components/funnel/ViewersAnalyticsTab";

const FunnelDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"overview" | "leads" | "payments" | "progress" | "viewers">("overview");
  const [leadSearch, setLeadSearch] = useState("");
  const [leadFilter, setLeadFilter] = useState("all");

  const { data: funnel } = useQuery({
    queryKey: ["funnel", id],
    queryFn: async () => {
      const { data } = await supabase.from("funnels").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["funnel-leads", id],
    queryFn: async () => {
      const { data } = await supabase.from("funnel_leads").select("*").eq("funnel_id", id!).order("submitted_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["funnel-payments", id],
    queryFn: async () => {
      const { data } = await supabase.from("funnel_payments").select("*").eq("funnel_id", id!).order("submitted_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const updateLeadStatus = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      await supabase.from("funnel_leads").update({ status }).eq("id", leadId);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["funnel-leads", id] }); toast.success("Lead updated"); },
  });

  const verifyPayment = useMutation({
    mutationFn: async ({ paymentId, status, note }: { paymentId: string; status: string; note?: string }) => {
      await supabase.from("funnel_payments").update({
        status, verified_by: user?.id, verified_at: new Date().toISOString(),
        rejection_note: note || null,
      }).eq("id", paymentId);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["funnel-payments", id] }); toast.success("Payment updated"); },
  });

  if (!funnel) return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div></DashboardLayout>;

  const filteredLeads = leads.filter((l: any) => {
    if (leadFilter !== "all" && l.status !== leadFilter) return false;
    if (leadSearch && !(l.name || "").toLowerCase().includes(leadSearch.toLowerCase()) && !(l.phone || "").includes(leadSearch)) return false;
    return true;
  });

  const convRate = funnel.total_views ? ((leads.length / funnel.total_views) * 100).toFixed(1) : "0";
  const totalRevenue = payments.filter((p: any) => p.status === "verified").reduce((a: number, p: any) => a + p.amount, 0);

  const isMultiStep = (funnel as any)?.funnel_mode === "multi";
  const isPrivate = funnel.visibility === "private";

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "leads", label: `Leads (${leads.length})` },
    { key: "payments", label: `Payments (${payments.length})` },
    ...(isMultiStep ? [{ key: "progress", label: "Lead Progress" }] : []),
    ...(isPrivate ? [{ key: "viewers", label: "Viewers", icon: Lock }] : []),
  ] as const;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-heading font-bold">{funnel.title}</h1>
              <Badge variant={funnel.is_published ? "default" : "secondary"}>{funnel.is_published ? "Published" : "Draft"}</Badge>
              {isPrivate && <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10"><Lock size={10} className="mr-1" /> Private</Badge>}
            </div>
            <p className="text-sm text-muted-foreground mt-1">/f/{funnel.slug}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/f/${funnel.slug}`); toast.success("Copied!"); }}>
              <Copy size={14} /> Copy Link
            </Button>
            <Link to={`/f/${funnel.slug}`} target="_blank"><Button variant="outline" size="sm"><ExternalLink size={14} /> Preview</Button></Link>
            <Link to={`/funnels/${id}/edit`}><Button variant="default" size="sm"><Edit size={14} /> Edit</Button></Link>
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit flex-wrap">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {"icon" in t && t.icon && <t.icon size={12} />}
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Eye, label: "Views", value: funnel.total_views || 0 },
              { icon: Users, label: "Leads", value: leads.length },
              { icon: TrendingUp, label: "Conversion", value: `${convRate}%` },
              { icon: IndianRupee, label: "Revenue", value: `₹${totalRevenue.toLocaleString("en-IN")}` },
            ].map((s) => (
              <div key={s.label} className="glass-card p-5">
                <div className="flex items-center gap-2 mb-2"><s.icon size={16} className="text-primary" /><span className="text-xs text-muted-foreground">{s.label}</span></div>
                <div className="text-2xl font-heading font-bold">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {tab === "leads" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search leads..." className="pl-9 bg-muted border-border" value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} />
              </div>
              <Select value={leadFilter} onValueChange={setLeadFilter}>
                <SelectTrigger className="w-40 bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="interested">Interested</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="not_interested">Not Interested</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => {
                const csv = "Name,Phone,Email,City,Status,Date\n" + leads.map((l: any) => `"${l.name || ""}","${l.phone || ""}","${l.email || ""}","${l.city || ""}","${l.status}","${l.submitted_at}"`).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = `leads-${funnel.slug}.csv`; a.click();
                toast.success("CSV exported!");
              }}><Download size={14} /> Export CSV</Button>
            </div>

            {filteredLeads.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <Users size={40} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No leads yet. Share your funnel link to start capturing leads!</p>
              </div>
            ) : (
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border text-muted-foreground">
                      <th className="text-left p-3 font-medium">Name</th>
                      <th className="text-left p-3 font-medium">Phone</th>
                      <th className="text-left p-3 font-medium hidden md:table-cell">Email</th>
                      <th className="text-left p-3 font-medium hidden lg:table-cell">City</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Actions</th>
                    </tr></thead>
                    <tbody>
                      {filteredLeads.map((l: any) => (
                        <tr key={l.id} className="border-b border-border/50 hover:bg-muted/50">
                          <td className="p-3 font-medium">{l.name || "—"}</td>
                          <td className="p-3">{l.phone || "—"}</td>
                          <td className="p-3 hidden md:table-cell">{l.email || "—"}</td>
                          <td className="p-3 hidden lg:table-cell">{l.city || "—"}</td>
                          <td className="p-3">
                            <Select value={l.status || "new"} onValueChange={(v) => updateLeadStatus.mutate({ leadId: l.id, status: v })}>
                              <SelectTrigger className="h-7 text-xs w-28 bg-muted border-border"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="contacted">Contacted</SelectItem>
                                <SelectItem value="interested">Interested</SelectItem>
                                <SelectItem value="converted">Converted</SelectItem>
                                <SelectItem value="not_interested">Not Interested</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              {l.phone && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(`https://wa.me/${l.phone?.replace(/\D/g, "")}`)}>
                                  <MessageCircle size={14} className="text-success" />
                                </Button>
                              )}
                              {l.phone && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(`tel:${l.phone}`)}>
                                  <Phone size={14} />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "payments" && (
          <div className="space-y-4">
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
                      <th className="text-left p-3 font-medium">Transaction ID</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Actions</th>
                    </tr></thead>
                    <tbody>
                      {payments.map((p: any) => (
                        <tr key={p.id} className="border-b border-border/50 hover:bg-muted/50">
                          <td className="p-3 font-medium">₹{p.amount.toLocaleString("en-IN")}</td>
                          <td className="p-3 text-muted-foreground">{p.upi_transaction_id || "—"}</td>
                          <td className="p-3"><Badge variant={p.status === "verified" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}>{p.status}</Badge></td>
                          <td className="p-3 text-muted-foreground">{new Date(p.submitted_at!).toLocaleDateString("en-IN")}</td>
                          <td className="p-3">
                            {p.status === "pending" && (
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => verifyPayment.mutate({ paymentId: p.id, status: "verified" })}>
                                  <Check size={14} className="text-success" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { const note = prompt("Rejection reason?"); if (note) verifyPayment.mutate({ paymentId: p.id, status: "rejected", note }); }}>
                                  <X size={14} className="text-destructive" />
                                </Button>
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
        )}

        {tab === "progress" && isMultiStep && <LeadProgressTab funnelId={id!} userId={user?.id || ""} />}
        {tab === "viewers" && isPrivate && <ViewersAnalyticsTab funnelId={id!} funnelSlug={funnel.slug} hasAccessCode={!!(funnel as any).access_code_hash} userId={user?.id || ""} />}
      </div>
    </DashboardLayout>
  );
};

export default FunnelDetail;
