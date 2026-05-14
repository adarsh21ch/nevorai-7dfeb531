import { useState } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Link, useNavigate } from "@/lib/router-compat";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Eye, Users, IndianRupee, MoreVertical, Copy, Share2, Layers, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const FunnelsPage = ({ embedded = false }: { embedded?: boolean } = {}) => {
  useDocumentTitle(embedded ? "Tools" : "Funnels");
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"upgrade" | "limit">("upgrade");

  const { isFree, canCreateFunnel, config, counts, tier } = usePlanLimits();
  const confirm = useConfirm();

  const { data: funnels = [], isLoading } = useQuery({
    queryKey: ["my-funnels", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("funnels").select("*").eq("owner_id", user!.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await supabase.from("funnels").delete().eq("id", id); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-funnels"] });
      queryClient.invalidateQueries({ queryKey: ["resource-counts"] });
      toast.success("Funnel deleted");
    },
  });

  const handleCreate = () => {
    if (isFree) { setModalType("upgrade"); setModalOpen(true); return; }
    if (!canCreateFunnel) { setModalType("limit"); setModalOpen(true); return; }
    navigate("/funnels/create");
  };

  const filtered = funnels.filter((f: any) => {
    if (filter === "published" && !f.is_published) return false;
    if (filter === "draft" && f.is_published) return false;
    if (debouncedSearch && !f.title.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    return true;
  });

  const filters = [
    { key: "all", label: "All" },
    { key: "published", label: "Published" },
    { key: "draft", label: "Draft" },
  ] as const;

  const limitBadge = !isFree && config.max_funnels !== -1 ? (
    <span className={`text-xs px-2 py-0.5 rounded-full ${counts.funnels >= config.max_funnels ? "bg-destructive/10 text-destructive" : counts.funnels >= config.max_funnels - 1 ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"}`}>
      {counts.funnels}/{config.max_funnels}
    </span>
  ) : null;

  const content = (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-heading font-bold">My Funnels</h1>
              <div className="page-header-accent" />
            </div>
            {limitBadge}
          </div>
          <Button variant="hero" onClick={handleCreate}>
            <Plus size={16} /> Create Funnel
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 search-premium rounded-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search funnels..." className="pl-9 bg-muted border-border" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {filters.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filter === f.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card p-5 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2 mb-3" />
                <div className="h-3 bg-muted rounded w-3/4 mb-4" />
                <div className="h-3 bg-muted rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Layers size={40} className="text-muted-foreground mx-auto mb-4" />
            <h3 className="font-heading font-semibold mb-2">{search ? "No funnels found" : "No funnels yet"}</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {search ? "Try a different search term." : isFree ? "Subscribe to a plan to start creating funnels." : "Create your first funnel to start capturing leads."}
            </p>
            {!search && (
              <Button variant="hero" onClick={handleCreate}>
                {isFree ? "See Plans" : "Create Your First Funnel"}
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            {filtered.map((f: any) => {
              const status = f.is_published ? "published" : "draft";
              const statusCfg: Record<string, string> = {
                published: "text-success bg-success/10 border border-success/20",
                draft: "text-muted-foreground bg-muted border border-border",
              };
              return (
                <div key={f.id} className="flex items-center gap-3 px-3 sm:px-4 py-3 hover:bg-muted/40 transition-colors">
                  <Link to={`/funnels/${f.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-20 h-[50px] rounded-lg bg-primary-subtle flex items-center justify-center">
                      <Layers size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{f.title || "Untitled Funnel"}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusCfg[status]}`}>
                          {status === "published" ? "● Published" : "○ Draft"}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Eye size={10} />{f.total_views || 0}</span>
                        <span className="text-[11px] text-muted-foreground">·</span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Users size={10} />{f.total_leads || 0}</span>
                        {f.intent_type === "paid" && <span className="text-[10px] text-warning">Paid</span>}
                      </div>
                    </div>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0"><MoreVertical size={15} /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => navigate(`/funnels/${f.id}/edit`)}>
                        <Layers size={13} className="mr-2" /> Edit Funnel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/f/${f.slug}`); toast.success("Link copied!"); }}>
                        <Copy size={13} className="mr-2" /> Copy Funnel Link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${window.location.origin}/f/${f.slug}`)}`)}>
                        <Share2 size={13} className="mr-2" /> Share on WhatsApp
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/funnels/${f.id}`)}>
                        <Eye size={13} className="mr-2" /> View Insights
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={async () => {
                        if (await confirm({ title: "Delete this funnel?", description: "This will permanently remove the funnel and its leads.", confirmLabel: "Delete", destructive: true })) deleteMutation.mutate(f.id);
                      }}>
                        <Trash2 size={13} className="mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <UpgradeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        type={modalType}
        resource="funnels"
        currentCount={counts.funnels}
        limit={config.max_funnels}
        tier={tier}
        reason="funnels"
      />
    </>
  );
  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
};

export default FunnelsPage;
