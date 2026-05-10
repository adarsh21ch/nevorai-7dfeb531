import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Crown, Save, ExternalLink, Phone } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  rejected: "Rejected",
};

const STATUS_STYLES: Record<string, string> = {
  new: "bg-amber-500/10 text-amber-600",
  contacted: "bg-blue-500/10 text-blue-600",
  qualified: "bg-purple-500/10 text-purple-600",
  converted: "bg-green-500/10 text-green-600",
  rejected: "bg-muted text-muted-foreground",
};

interface Inquiry {
  id: string;
  full_name: string;
  whatsapp_phone: string;
  email: string;
  network_name: string;
  team_size: string;
  platform: string | null;
  custom_needs: string | null;
  status: string;
  admin_notes: string | null;
  submitted_at: string;
  contacted_at: string | null;
}

export const EnterpriseInquiriesTab = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Inquiry | null>(null);
  const [editStatus, setEditStatus] = useState<string>("new");
  const [editNotes, setEditNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ["admin-enterprise-inquiries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enterprise_inquiries" as any)
        .select("*")
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Inquiry[]) || [];
    },
    staleTime: 30_000,
  });

  const filtered = inquiries.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      i.full_name.toLowerCase().includes(q) ||
      i.email.toLowerCase().includes(q) ||
      i.network_name.toLowerCase().includes(q) ||
      (i.platform || "").toLowerCase().includes(q)
    );
  });

  const counts = {
    all: inquiries.length,
    new: inquiries.filter((i) => i.status === "new").length,
    contacted: inquiries.filter((i) => i.status === "contacted").length,
    qualified: inquiries.filter((i) => i.status === "qualified").length,
    converted: inquiries.filter((i) => i.status === "converted").length,
  };

  const openEditor = (inq: Inquiry) => {
    setEditing(inq);
    setEditStatus(inq.status);
    setEditNotes(inq.admin_notes || "");
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const update: any = {
      status: editStatus,
      admin_notes: editNotes,
    };
    if (editStatus !== "new" && !editing.contacted_at) {
      update.contacted_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from("enterprise_inquiries" as any)
      .update(update)
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Inquiry updated");
    qc.invalidateQueries({ queryKey: ["admin-enterprise-inquiries"] });
    setEditing(null);
  };

  return (
    <div className="space-y-3">
      {/* Stats strip */}
      <div className="grid grid-cols-5 gap-2">
        {(
          [
            ["all", "Total"],
            ["new", "New"],
            ["contacted", "Contacted"],
            ["qualified", "Qualified"],
            ["converted", "Won"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`glass-card p-2 sm:p-3 text-left transition-all ${
              statusFilter === key ? "ring-2 ring-primary/40" : ""
            }`}
          >
            <p className="text-[10px] text-muted-foreground sm:text-xs">{label}</p>
            <p className="text-base sm:text-2xl font-heading font-bold">
              {counts[key as keyof typeof counts]}
            </p>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search name, email, network..."
            className="pl-9 bg-muted border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 text-xs text-muted-foreground font-medium">Name</th>
                <th className="p-3 text-xs text-muted-foreground font-medium">Network</th>
                <th className="p-3 text-xs text-muted-foreground font-medium">Team</th>
                <th className="p-3 text-xs text-muted-foreground font-medium">Platform</th>
                <th className="p-3 text-xs text-muted-foreground font-medium">Submitted</th>
                <th className="p-3 text-xs text-muted-foreground font-medium">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No inquiries{statusFilter !== "all" ? ` with status "${statusFilter}"` : " yet"}.
                  </td>
                </tr>
              ) : (
                filtered.map((i) => (
                  <tr key={i.id} className="border-b border-border hover:bg-muted/40">
                    <td className="p-3">
                      <p className="font-medium">{i.full_name}</p>
                      <p className="text-xs text-muted-foreground">{i.email}</p>
                    </td>
                    <td className="p-3 text-xs">{i.network_name}</td>
                    <td className="p-3 text-xs">{i.team_size}</td>
                    <td className="p-3 text-xs">{i.platform || "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {new Date(i.submitted_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          STATUS_STYLES[i.status] || ""
                        }`}
                      >
                        {STATUS_LABELS[i.status] || i.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 justify-end">
                        <a
                          href={`https://wa.me/${i.whatsapp_phone.replace(/[^\d]/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button size="sm" variant="ghost" className="h-7 px-2">
                            <Phone size={12} />
                          </Button>
                        </a>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => openEditor(i)}
                        >
                          <ExternalLink size={12} /> Open
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {filtered.map((i) => (
          <div key={i.id} className="glass-card p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1">
                  <Crown size={12} className="text-amber-500" /> {i.full_name}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {i.network_name} · {i.team_size}
                </p>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 ${
                  STATUS_STYLES[i.status] || ""
                }`}
              >
                {STATUS_LABELS[i.status] || i.status}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2">
              <span className="text-[11px] text-muted-foreground">
                {new Date(i.submitted_at).toLocaleDateString("en-IN")}
              </span>
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => openEditor(i)}>
                Open
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown size={16} className="text-amber-500" />
              {editing?.full_name}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium break-all">{editing.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">WhatsApp</p>
                  <p className="font-medium">{editing.whatsapp_phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Network</p>
                  <p className="font-medium">{editing.network_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Team Size</p>
                  <p className="font-medium">{editing.team_size}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Platform</p>
                  <p className="font-medium">{editing.platform || "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Custom needs</p>
                  <p className="whitespace-pre-wrap">{editing.custom_needs || "—"}</p>
                </div>
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Admin notes</p>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="min-h-[80px] text-sm"
                    placeholder="Internal notes about this lead..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Close
                </Button>
                <Button onClick={handleSave} disabled={saving} className="gap-1">
                  <Save size={14} />
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
