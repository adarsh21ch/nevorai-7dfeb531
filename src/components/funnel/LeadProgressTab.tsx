import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Unlock, Eye, Search, ChevronDown, ChevronUp, Bell, UserCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

interface LeadProgressTabProps {
  funnelId: string;
  userId: string;
}

export const LeadProgressTab = ({ funnelId, userId }: LeadProgressTabProps) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedLead, setExpandedLead] = useState<string | null>(null);

  const { data: steps = [] } = useQuery({
    queryKey: ["funnel-steps", funnelId],
    queryFn: async () => {
      const { data } = await supabase.from("funnel_steps").select("id, title, step_order, step_type").eq("funnel_id", funnelId).order("step_order");
      return data || [];
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["funnel-leads", funnelId],
    queryFn: async () => {
      const { data } = await supabase.from("funnel_leads").select("id, name, phone, email, status, submitted_at").eq("funnel_id", funnelId).order("submitted_at", { ascending: false });
      return data || [];
    },
  });

  const { data: allProgress = [] } = useQuery({
    queryKey: ["funnel-step-progress", funnelId],
    queryFn: async () => {
      const { data } = await supabase.from("funnel_step_progress").select("*").eq("funnel_id", funnelId);
      return data || [];
    },
  });

  // Realtime: refresh progress as prospects move through steps / request unlocks.
  useEffect(() => {
    const channel = supabase
      .channel(`creator-progress-${funnelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "funnel_step_progress", filter: `funnel_id=eq.${funnelId}` },
        () => queryClient.invalidateQueries({ queryKey: ["funnel-step-progress", funnelId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [funnelId, queryClient]);

  const unlockStep = useMutation({
    mutationFn: async ({ progressId, stepId, leadId, sessionId }: { progressId?: string; stepId: string; leadId?: string; sessionId?: string }) => {
      if (progressId) {
        await supabase.from("funnel_step_progress").update({ status: "unlocked", manually_unlocked: true, unlocked_by: userId, unlocked_at: new Date().toISOString() }).eq("id", progressId);
      } else {
        await supabase.from("funnel_step_progress").insert({ funnel_id: funnelId, funnel_step_id: stepId, lead_id: leadId || null, session_id: sessionId || null, status: "unlocked", manually_unlocked: true, unlocked_by: userId, unlocked_at: new Date().toISOString() });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["funnel-step-progress", funnelId] }); toast.success("Step unlocked!"); },
  });

  if (steps.length === 0) {
    return <div className="glass-card p-12 text-center"><Eye size={40} className="text-muted-foreground mx-auto mb-3" /><p className="text-sm text-muted-foreground">This funnel doesn't have multi-step flow enabled.</p></div>;
  }

  const sessionMap = new Map<string, typeof allProgress>();
  for (const p of allProgress) {
    const key = p.lead_id || p.session_id || p.id;
    if (!sessionMap.has(key)) sessionMap.set(key, []);
    sessionMap.get(key)!.push(p);
  }

  const sessions = Array.from(sessionMap.entries()).map(([key, progressList]) => {
    const leadId = progressList.find((p) => p.lead_id)?.lead_id;
    const lead = leadId ? leads.find((l) => l.id === leadId) : null;
    const sessionId = progressList[0]?.session_id;
    let currentStepOrder = 0;
    let completedSteps = 0;
    for (const step of steps) {
      const sp = progressList.find((p) => p.funnel_step_id === step.id);
      if (sp?.status === "completed") completedSteps++;
      else { currentStepOrder = step.step_order; break; }
    }
    return { key, lead, sessionId, progressList, currentStepOrder, completedSteps };
  });

  const filteredSessions = sessions.filter((s) => {
    if (!search) return true;
    const lc = search.toLowerCase();
    return (s.lead?.name || "").toLowerCase().includes(lc) || (s.lead?.phone || "").includes(search) || (s.lead?.email || "").toLowerCase().includes(lc);
  });

  // Pending manual_approval unlock requests across all sessions.
  const manualApprovalStepIds = new Set(steps.filter((s: any) => s.step_type === "manual_approval").map((s) => s.id));
  const pendingRequests = sessions.flatMap((session) =>
    session.progressList
      .filter((p: any) => manualApprovalStepIds.has(p.funnel_step_id) && p.status === "locked" && !p.manually_unlocked)
      .map((p: any) => ({
        session,
        progress: p,
        step: steps.find((s) => s.id === p.funnel_step_id)!,
      })),
  );

  return (
    <div className="space-y-4">
      {pendingRequests.length > 0 && (
        <div className="glass-card p-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={16} className="text-amber-500" />
            <h4 className="text-sm font-semibold">Pending unlock requests</h4>
            <Badge variant="secondary" className="text-xs bg-amber-500/15 text-amber-600 border-0">{pendingRequests.length}</Badge>
          </div>
          <div className="space-y-2">
            {pendingRequests.slice(0, 8).map(({ session, progress, step }) => (
              <div key={progress.id} className="flex items-center gap-3 rounded-lg bg-background/50 px-3 py-2 border border-border">
                <UserCheck size={14} className="text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {session.lead?.name || "Anonymous viewer"}
                    {session.lead?.phone && <span className="text-muted-foreground"> · {session.lead.phone}</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">Step {step.step_order + 1}: {step.title || "Manual approval"}</p>
                </div>
                <Button size="sm" className="h-7 text-xs" onClick={() => unlockStep.mutate({ progressId: progress.id, stepId: step.id, leadId: session.lead?.id, sessionId: session.sessionId || undefined })}>
                  <Unlock size={12} /> Unlock
                </Button>
              </div>
            ))}
            {pendingRequests.length > 8 && (
              <p className="text-[11px] text-muted-foreground text-center pt-1">+{pendingRequests.length - 8} more — find them in the list below</p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, phone, email..." className="pl-9 bg-muted border-border" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Badge variant="secondary" className="text-xs">{sessions.length} viewers</Badge>
      </div>
      {filteredSessions.length === 0 ? (
        <div className="glass-card p-12 text-center"><Eye size={40} className="text-muted-foreground mx-auto mb-3" /><p className="text-sm text-muted-foreground">No viewer progress data yet.</p></div>
      ) : (
        <div className="space-y-2">
          {filteredSessions.map((session) => {
            const isExpanded = expandedLead === session.key;
            return (
              <div key={session.key} className="glass-card overflow-hidden">
                <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors" onClick={() => setExpandedLead(isExpanded ? null : session.key)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{session.lead?.name || "Anonymous Viewer"}</span>
                      {session.lead?.phone && <span className="text-xs text-muted-foreground">{session.lead.phone}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex gap-0.5">
                        {steps.map((_, i) => <div key={i} className={`w-4 h-1 rounded-full ${i < session.completedSteps ? "bg-[#F97316]" : "bg-muted"}`} />)}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{session.completedSteps}/{steps.length} steps</span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                </button>
                {isExpanded && (
                  <div className="border-t border-border px-4 py-3 space-y-2">
                    {steps.map((step) => {
                      const sp = session.progressList.find((p) => p.funnel_step_id === step.id);
                      const status = sp?.status || "locked";
                      return (
                        <div key={step.id} className="flex items-center gap-3 py-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">{step.title || `Step ${step.step_order + 1}`}</span>
                              <Badge variant={status === "completed" ? "default" : status === "locked" ? "secondary" : "outline"} className="text-[10px] h-5">{status}</Badge>
                            </div>
                            {sp && step.step_type === "video" && (
                              <span className="text-[10px] text-muted-foreground">Watched {sp.watched_percentage || 0}% · {Math.floor((sp.max_watched_seconds || 0) / 60)}m {(sp.max_watched_seconds || 0) % 60}s</span>
                            )}
                          </div>
                          {status === "locked" && (
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); unlockStep.mutate({ progressId: sp?.id, stepId: step.id, leadId: session.lead?.id, sessionId: session.sessionId || undefined }); }}>
                              <Unlock size={12} /> Unlock
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
