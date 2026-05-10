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

const FunnelsPage = () => {
  useDocumentTitle("Funnels");
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"upgrade" | "limit">("upgrade");

  const { isFree, canCreateFunnel, config, counts, tier } = usePlanLimits();

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
    if (search && !f.title.toLowerCase().includes(search.toLowerCase())) return false;
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

  return (
    <DashboardLayout>
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((f: any) => (
              <div key={f.id} className="premium-card p-5 group relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${f.is_published ? "bg-success" : "bg-muted-foreground"}`} />
                    <span className="text-xs text-muted-foreground">{f.is_published ? "Published" : "Draft"}</span>
                    {f.visibility === "private" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium flex items-center gap-1">🔒 Private</span>
                    )}
                  </div>
                  {f.intent_type === "paid" && <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning">Paid</span>}
                </div>
                <h3 className="font-medium text-sm mb-1 truncate">{f.title}</h3>
                {f.description && <p className="text-xs text-muted-foreground truncate mb-3">{f.description}</p>}
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                  <span className="flex items-center gap-1"><Eye size={12} /> {f.total_views || 0}</span>
                  <span className="flex items-center gap-1"><Users size={12} /> {f.total_leads || 0}</span>
                  <span className="flex items-center gap-1"><IndianRupee size={12} /> {f.total_payments || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link to={`/funnels/${f.id}`} className="flex-1"><Button variant="outline" size="sm" className="w-full text-xs">Insights</Button></Link>
                  <Link to={`/funnels/${f.id}/edit`}><Button variant="secondary" size="sm" className="text-xs">Edit</Button></Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical size={14} /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border">
                      <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/f/${f.slug}`); toast.success("Link copied!"); }}>
                        <Copy size={14} /> Copy Link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${window.location.origin}/f/${f.slug}`)}`)}>
                        <Share2 size={14} /> Share on WhatsApp
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm("Delete this funnel?")) deleteMutation.mutate(f.id); }}>
                        <Trash2 size={14} /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
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
    </DashboardLayout>
  );
};

export default FunnelsPage;
