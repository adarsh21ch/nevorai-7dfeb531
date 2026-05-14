import { Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Radio, ArrowRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const WatchingNowStrip = () => {
  const { user } = useAuth();

  const { data: liveViewers = [] } = useQuery({
    queryKey: ["watching-now", user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      // Active = analytics events recorded in the last 60s for any of my funnels
      const { data: funnels } = await supabase
        .from("funnels")
        .select("id, title, slug")
        .eq("owner_id", user!.id);
      const ids = (funnels || []).map((f) => f.id);
      if (!ids.length) return [];
      const since = new Date(Date.now() - 60_000).toISOString();
      const { data: events } = await supabase
        .from("funnel_video_analytics")
        .select("session_id, funnel_id, lead_id, progress_percent, recorded_at")
        .in("funnel_id", ids)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: false })
        .limit(50);

      const bySession = new Map<string, any>();
      for (const e of events || []) {
        if (!bySession.has(e.session_id)) bySession.set(e.session_id, e);
      }
      const top = Array.from(bySession.values()).slice(0, 3);
      const leadIds = top.map((t) => t.lead_id).filter(Boolean) as string[];
      let leads: Record<string, { name: string }> = {};
      if (leadIds.length) {
        const { data: leadRows } = await supabase
          .from("funnel_leads")
          .select("id, name")
          .in("id", leadIds);
        leads = Object.fromEntries((leadRows || []).map((l: any) => [l.id, { name: l.name || "Anonymous" }]));
      }
      const funnelMap = Object.fromEntries((funnels || []).map((f: any) => [f.id, f]));
      return top.map((e: any) => ({
        sessionId: e.session_id,
        viewerName: e.lead_id ? leads[e.lead_id]?.name || "Anonymous" : "Anonymous viewer",
        funnelTitle: funnelMap[e.funnel_id]?.title || "Your funnel",
        funnelSlug: funnelMap[e.funnel_id]?.slug,
        progress: Math.max(0, Math.min(100, Math.round(e.progress_percent || 0))),
        when: e.recorded_at as string,
      }));
    },
  });

  const copyShareLink = async () => {
    const link = `${window.location.origin}/dashboard`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <h2 className="text-sm font-heading font-semibold">Watching right now</h2>
        </div>
        <Link to="/insights" className="flex items-center gap-1 text-xs text-primary hover:underline">
          See all in Insights <ArrowRight size={12} />
        </Link>
      </div>

      {liveViewers.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Radio size={18} className="mt-0.5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Share your nFlow link to start seeing viewers in real-time.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={copyShareLink}>
            <Copy size={14} /> Copy link
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {liveViewers.map((v) => (
            <li
              key={v.sessionId}
              className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{v.viewerName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {v.funnelTitle} · {formatDistanceToNow(new Date(v.when), { addSuffix: true })}
                </p>
              </div>
              <div className="w-20 shrink-0">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${v.progress}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-[10px] text-muted-foreground">{v.progress}%</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default WatchingNowStrip;
