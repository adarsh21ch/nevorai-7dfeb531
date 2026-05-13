import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Users, TrendingUp, Lock, Download, Search,
  AlertTriangle, Trash2, RotateCcw, ChevronLeft, ChevronRight,
  Activity,
} from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface ViewersAnalyticsTabProps {
  funnelId: string;
  funnelSlug: string;
  hasAccessCode: boolean;
  userId: string;
}

const PAGE_SIZE = 20;

export const ViewersAnalyticsTab = ({ funnelId, funnelSlug, hasAccessCode }: ViewersAnalyticsTabProps) => {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<"submitted_at" | "status">("submitted_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [newCode, setNewCode] = useState("");

  const { data: viewers = [] } = useQuery({
    queryKey: ["private-viewers", funnelId],
    queryFn: async () => {
      const { data } = await supabase
        .from("funnel_leads")
        .select("*")
        .eq("funnel_id", funnelId)
        .order("submitted_at", { ascending: false });
      return data || [];
    },
  });

  const { data: failedAttempts = 0 } = useQuery({
    queryKey: ["failed-attempts", funnelId],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("funnel_access_logs")
        .select("*", { count: "exact", head: true })
        .eq("funnel_id", funnelId)
        .eq("success", false);
      return count || 0;
    },
  });

  const { data: stepProgress = [] } = useQuery({
    queryKey: ["viewer-step-progress", funnelId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("funnel_step_progress")
        .select("*")
        .eq("funnel_id", funnelId);
      return data || [];
    },
  });

  const { data: steps = [] } = useQuery({
    queryKey: ["funnel-steps-count", funnelId],
    queryFn: async () => {
      const { data } = await supabase
        .from("funnel_steps")
        .select("id")
        .eq("funnel_id", funnelId)
        .eq("is_active", true);
      return data || [];
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (leadId: string) => {
      await (supabase as any).from("funnel_step_progress").delete().eq("funnel_id", funnelId).eq("lead_id", leadId);
      await supabase.from("funnel_leads").delete().eq("id", leadId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["private-viewers", funnelId] });
      queryClient.invalidateQueries({ queryKey: ["viewer-step-progress", funnelId] });
      toast.success("Access revoked");
    },
  });

  const rotateCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      const enc = new TextEncoder();
      const buf = await crypto.subtle.digest("SHA-256", enc.encode(code.trim().toUpperCase()));
      const hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
      await (supabase as any).from("funnels").update({ access_code_hash: hash }).eq("id", funnelId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnel", funnelId] });
      setRotateOpen(false);
      setNewCode("");
      toast.success("Access code updated!");
    },
  });

  const totalViewers = viewers.length;
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const activeRecently = viewers.filter((v: any) => {
    const at = new Date(v.submitted_at || "").getTime();
    return at > sevenDaysAgo;
  }).length;

  const totalSteps = steps.length || 1;
  const viewerCompletions = viewers.map((v: any) => {
    const vProgress = stepProgress.filter((p: any) => p.lead_id === v.id);
    const completed = vProgress.filter((p: any) => p.status === "completed").length;
    return { ...v, completedSteps: completed, completionPct: Math.round((completed / totalSteps) * 100) };
  });

  const avgCompletion = viewerCompletions.length > 0
    ? Math.round(viewerCompletions.reduce((a: number, v: any) => a + v.completionPct, 0) / viewerCompletions.length)
    : 0;

  const filtered = viewerCompletions.filter((v: any) => {
    if (!search) return true;
    const lc = search.toLowerCase();
    return (v.name || "").toLowerCase().includes(lc) || (v.phone || "").includes(search) || (v.email || "").toLowerCase().includes(lc);
  });

  const sorted = [...filtered].sort((a: any, b: any) => {
    if (sortBy === "submitted_at") {
      const da = new Date(a.submitted_at || "").getTime();
      const db = new Date(b.submitted_at || "").getTime();
      return sortAsc ? da - db : db - da;
    }
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (col: "submitted_at" | "status") => {
    if (sortBy === col) setSortAsc(!sortAsc);
    else { setSortBy(col); setSortAsc(false); }
  };

  const exportCSV = () => {
    const header = "Name,Phone,Email,City,Status,Joined,Videos Completed,Completion %\n";
    const rows = viewerCompletions.map((v: any) =>
      `"${v.name || ""}","${v.phone || ""}","${v.email || ""}","${v.city || ""}","${v.status || "new"}","${v.submitted_at ? new Date(v.submitted_at).toLocaleDateString("en-IN") : ""}","${v.completedSteps}/${totalSteps}","${v.completionPct}%"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `viewers-${funnelSlug}.csv`; a.click();
    toast.success("CSV exported!");
  };

  const kpis = [
    { icon: Users, label: "Total Viewers", value: totalViewers, color: "text-primary" },
    { icon: TrendingUp, label: "Avg Completion", value: `${avgCompletion}%`, color: "text-emerald-500" },
    { icon: Activity, label: "Active (7d)", value: activeRecently, color: "text-blue-500" },
    { icon: AlertTriangle, label: "Failed Attempts", value: failedAttempts, color: "text-amber-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="glass-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <k.icon size={16} className={k.color} />
              <span className="text-xs text-muted-foreground">{k.label}</span>
            </div>
            <div className="text-2xl font-heading font-bold">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock size={16} className="text-primary" />
            <div>
              <p className="text-sm font-medium">Access Code</p>
              <p className="text-xs text-muted-foreground">
                {hasAccessCode ? "•••••••• (set)" : "Not set"}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setRotateOpen(!rotateOpen)}>
            <RotateCcw size={14} /> {hasAccessCode ? "Rotate Code" : "Set Code"}
          </Button>
        </div>
        {rotateOpen && (
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            <p className="text-xs text-muted-foreground">
              Existing viewers keep their access. Only new visitors need the new code.
            </p>
            <div className="flex gap-2">
              <Input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="NEW CODE"
                className="uppercase tracking-wider font-mono bg-muted border-border max-w-[200px]"
              />
              <Button
                size="sm"
                disabled={!newCode.trim() || rotateCodeMutation.isPending}
                onClick={() => rotateCodeMutation.mutate(newCode)}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search viewers..." className="pl-9 bg-muted border-border" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download size={14} /> Export CSV
          </Button>
        </div>

        {paginated.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Users size={40} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? "No viewers match your search." : "No viewers yet. Share your access code to get started."}
            </p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Phone</th>
                    <th className="text-left p-3 font-medium hidden md:table-cell">Email</th>
                    <th className="text-left p-3 font-medium hidden lg:table-cell">City</th>
                    <th className="text-left p-3 font-medium cursor-pointer hover:text-foreground" onClick={() => handleSort("submitted_at")}>
                      Joined {sortBy === "submitted_at" ? (sortAsc ? "↑" : "↓") : ""}
                    </th>
                    <th className="text-left p-3 font-medium">Progress</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((v: any) => (
                    <tr key={v.id} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="p-3 font-medium">{v.name || "—"}</td>
                      <td className="p-3">{v.phone || "—"}</td>
                      <td className="p-3 hidden md:table-cell">{v.email || "—"}</td>
                      <td className="p-3 hidden lg:table-cell">{v.city || "—"}</td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {v.submitted_at ? new Date(v.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${v.completionPct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{v.completedSteps}/{totalSteps}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            if (await confirm({ title: "Revoke this viewer's access?", description: "This will permanently delete their data and lookups.", confirmLabel: "Revoke access", destructive: true, typeToConfirm: "REVOKE" })) {
                              revokeMutation.mutate(v.id);
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={14} />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
