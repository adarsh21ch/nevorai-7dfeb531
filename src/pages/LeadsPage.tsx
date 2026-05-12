import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Users, Clock, Play, Layers, FileText, Radio,
  ChevronLeft, ChevronRight, MessageCircle, Phone, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "@/lib/router-compat";

type SourceKey = "recent" | "videos" | "funnels" | "pages" | "live";

const sourceTabs: { id: SourceKey; label: string; icon: any }[] = [
  { id: "recent", label: "Recent", icon: Clock },
  { id: "videos", label: "Videos", icon: Play },
  { id: "funnels", label: "Funnels", icon: Layers },
  { id: "pages", label: "Landing Pages", icon: FileText },
  { id: "live", label: "Live Sessions", icon: Radio },
];

const initialsOf = (name?: string | null) =>
  (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";

const timeAgo = (iso?: string | null) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const LeadsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeSource, setActiveSource] = useState<SourceKey>("recent");
  const [drillItem, setDrillItem] = useState<{ id: string; title: string; source: SourceKey } | null>(null);

  const { data: funnels = [] } = useQuery({
    queryKey: ["my-funnels", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("funnels").select("id, title").eq("owner_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: pages = [] } = useQuery({
    queryKey: ["my-landing-pages", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("landing_pages").select("id, title").eq("owner_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: liveSessions = [] } = useQuery({
    queryKey: ["my-live-sessions", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("live_sessions").select("id, title").eq("owner_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: funnelLeads = [] } = useQuery({
    queryKey: ["all-funnel-leads", user?.id, funnels],
    queryFn: async () => {
      const ids = (funnels as any[]).map((f) => f.id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("funnel_leads")
        .select("*")
        .in("funnel_id", ids)
        .order("submitted_at", { ascending: false });
      return data || [];
    },
    enabled: (funnels as any[]).length > 0,
  });

  const { data: pageLeads = [] } = useQuery({
    queryKey: ["all-page-leads", user?.id, pages],
    queryFn: async () => {
      const ids = (pages as any[]).map((p) => p.id);
      if (!ids.length) return [];
      const { data } = await (supabase as any)
        .from("landing_page_registrations")
        .select("*")
        .in("landing_page_id", ids)
        .order("submitted_at", { ascending: false });
      return data || [];
    },
    enabled: (pages as any[]).length > 0,
  });

  const { data: liveLeads = [] } = useQuery({
    queryKey: ["all-live-leads", user?.id, liveSessions],
    queryFn: async () => {
      const ids = (liveSessions as any[]).map((s) => s.id);
      if (!ids.length) return [];
      const { data } = await (supabase as any)
        .from("live_registrations")
        .select("*")
        .in("session_id", ids)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: (liveSessions as any[]).length > 0,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await supabase.from("funnel_leads").update({ status }).eq("id", id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["all-funnel-leads"] }); toast.success("Updated"); },
  });

  // Build unified recent feed
  const recentFeed = useMemo(() => {
    const titleOf = (arr: any[], id: string) => arr.find((x) => x.id === id)?.title || "—";
    const merged = [
      ...(funnelLeads as any[]).map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        contentTitle: titleOf(funnels as any[], l.funnel_id),
        contentId: l.funnel_id,
        sourceType: "funnel" as SourceKey | "funnel",
        when: l.submitted_at,
      })),
      ...(pageLeads as any[]).map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        contentTitle: titleOf(pages as any[], l.landing_page_id),
        contentId: l.landing_page_id,
        sourceType: "page" as any,
        when: l.submitted_at,
      })),
      ...(liveLeads as any[]).map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        contentTitle: titleOf(liveSessions as any[], l.session_id),
        contentId: l.session_id,
        sourceType: "live" as any,
        when: l.created_at,
      })),
    ];
    return merged.sort((a, b) => new Date(b.when || 0).getTime() - new Date(a.when || 0).getTime());
  }, [funnelLeads, pageLeads, liveLeads, funnels, pages, liveSessions]);

  // Per-content lead counts for level-2 lists
  const countLeadsFor = (source: SourceKey, id: string) => {
    if (source === "funnels") return (funnelLeads as any[]).filter((l) => l.funnel_id === id).length;
    if (source === "pages") return (pageLeads as any[]).filter((l) => l.landing_page_id === id).length;
    if (source === "live") return (liveLeads as any[]).filter((l) => l.session_id === id).length;
    return 0;
  };

  const lastActivityFor = (source: SourceKey, id: string) => {
    const arr =
      source === "funnels" ? (funnelLeads as any[]).filter((l) => l.funnel_id === id) :
      source === "pages" ? (pageLeads as any[]).filter((l) => l.landing_page_id === id) :
      source === "live" ? (liveLeads as any[]).filter((l) => l.session_id === id) : [];
    if (!arr.length) return "No activity";
    const latest = arr[0].submitted_at || arr[0].created_at;
    return timeAgo(latest);
  };

  // Drilled-in leads
  const drilledLeads = useMemo(() => {
    if (!drillItem) return [];
    if (drillItem.source === "funnels") return (funnelLeads as any[]).filter((l) => l.funnel_id === drillItem.id);
    if (drillItem.source === "pages") return (pageLeads as any[]).filter((l) => l.landing_page_id === drillItem.id);
    if (drillItem.source === "live") return (liveLeads as any[]).filter((l) => l.session_id === drillItem.id);
    return [];
  }, [drillItem, funnelLeads, pageLeads, liveLeads]);

  const totalContacts = recentFeed.length;

  const exportCsv = () => {
    const rows = [
      ["Name", "Phone", "Content", "Source", "Date"],
      ...recentFeed.map((l) => [l.name || "", l.phone || "", l.contentTitle, l.sourceType, l.when || ""]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "my-leads.csv"; a.click();
    toast.success("CSV exported!");
  };

  const renderLevel2List = () => {
    const list =
      activeSource === "funnels" ? (funnels as any[]) :
      activeSource === "pages" ? (pages as any[]) :
      activeSource === "live" ? (liveSessions as any[]) : [];
    if (activeSource === "videos") {
      return (
        <EmptyState
          icon={Play}
          title="Per-video contacts coming soon"
          body="Right now contacts are tracked from Funnels, Landing Pages, and Live Sessions. Use one of those tabs to see who watched."
          ctaLabel="Go to My Videos"
          onClick={() => navigate("/videos")}
        />
      );
    }
    if (!list.length) {
      const meta =
        activeSource === "funnels" ? { title: "No funnels yet", body: "Create a funnel to start collecting contacts.", to: "/funnels/create" } :
        activeSource === "pages" ? { title: "No landing pages yet", body: "Create a landing page to share your video.", to: "/landing-pages/create" } :
        { title: "No live sessions yet", body: "Go live to capture viewers in real time.", to: "/live" };
      const Icon = sourceTabs.find((t) => t.id === activeSource)!.icon;
      return <EmptyState icon={Icon} title={meta.title} body={meta.body} ctaLabel="Get started" onClick={() => navigate(meta.to)} />;
    }
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {list.map((item: any) => {
          const count = countLeadsFor(activeSource, item.id);
          return (
            <button
              key={item.id}
              onClick={() => setDrillItem({ id: item.id, title: item.title, source: activeSource })}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 border-b border-border last:border-b-0 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                {activeSource === "funnels" ? <Layers size={16} className="text-muted-foreground" /> :
                 activeSource === "pages" ? <FileText size={16} className="text-muted-foreground" /> :
                 <Radio size={16} className="text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {count} {count === 1 ? "contact" : "contacts"} · {lastActivityFor(activeSource, item.id)}
                </p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
            </button>
          );
        })}
      </div>
    );
  };

  const renderRecent = () => {
    if (!recentFeed.length) {
      return (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          body="When someone watches your video or fills a form, they'll show up here automatically."
          ctaLabel="Go to My Videos"
          onClick={() => navigate("/videos")}
        />
      );
    }
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {recentFeed.slice(0, 50).map((lead) => (
          <div key={`${lead.sourceType}-${lead.id}`} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0">
            <Avatar className="h-9 w-9 flex-shrink-0 bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
              {initialsOf(lead.name)}
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{lead.name || "Unnamed contact"}</p>
              <p className="text-xs text-muted-foreground truncate">{lead.contentTitle}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wide">
                  {lead.sourceType}
                </span>
                <span className="text-[11px] text-muted-foreground">{timeAgo(lead.when)}</span>
              </div>
            </div>
            {lead.phone && (
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(`https://wa.me/${lead.phone.replace(/\D/g, "")}`)}>
                  <MessageCircle size={14} className="text-success" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(`tel:${lead.phone}`)}>
                  <Phone size={14} />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderDrilled = () => (
    <>
      <div className="flex items-center gap-3 mb-3">
        <button onClick={() => setDrillItem(null)} className="p-1 -ml-1 rounded-md hover:bg-muted">
          <ChevronLeft size={20} className="text-foreground" />
        </button>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{drillItem!.title}</p>
          <p className="text-xs text-muted-foreground">{drilledLeads.length} contacts</p>
        </div>
      </div>
      {drilledLeads.length === 0 ? (
        <EmptyState icon={Users} title="No contacts yet" body="Share this link to start capturing contacts." />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {drilledLeads.map((lead: any) => (
            <div key={lead.id} className="px-4 py-4 border-b border-border last:border-b-0">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10 bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center flex-shrink-0">
                  {initialsOf(lead.name)}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-foreground truncate">{lead.name || "Unnamed contact"}</p>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo(lead.submitted_at || lead.created_at)}</span>
                  </div>
                  {lead.phone && <p className="text-xs text-muted-foreground">{lead.phone}</p>}
                  {lead.email && <p className="text-xs text-muted-foreground">{lead.email}</p>}
                  {lead.city && <p className="text-xs text-muted-foreground mt-0.5">📍 {lead.city}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    {lead.phone && (
                      <>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => window.open(`https://wa.me/${lead.phone.replace(/\D/g, "")}`)}>
                          <MessageCircle size={12} className="mr-1 text-success" /> WhatsApp
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => window.open(`tel:${lead.phone}`)}>
                          <Phone size={12} className="mr-1" /> Call
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold">My Leads</h1>
            <p className="text-sm text-muted-foreground mt-1">{totalContacts} contacts captured from your content</p>
          </div>
          {!drillItem && totalContacts > 0 && (
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download size={14} className="mr-1" /> Export
            </Button>
          )}
        </div>

        {drillItem ? (
          renderDrilled()
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 scrollbar-none">
              {sourceTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSource(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors",
                    activeSource === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <tab.icon size={12} />
                  {tab.label}
                </button>
              ))}
            </div>

            {activeSource === "recent" ? renderRecent() : renderLevel2List()}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

const EmptyState = ({
  icon: Icon, title, body, ctaLabel, onClick,
}: { icon: any; title: string; body: string; ctaLabel?: string; onClick?: () => void }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-xl border border-border bg-card">
    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
      <Icon size={22} className="text-primary" />
    </div>
    <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground mb-5 max-w-[280px]">{body}</p>
    {ctaLabel && onClick && <Button variant="outline" onClick={onClick}>{ctaLabel}</Button>}
  </div>
);

export default LeadsPage;
