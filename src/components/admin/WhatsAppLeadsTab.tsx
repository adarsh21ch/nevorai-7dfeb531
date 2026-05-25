import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Search, ExternalLink, Save, Flame, Snowflake } from "lucide-react";
import { toast } from "sonner";

interface Lead {
  id: string;
  phone_number: string;
  name: string | null;
  email: string | null;
  business_type: string | null;
  interest: string | null;
  plan_interest: string | null;
  status: string;
  score: string;
  message_count: number;
  notes: string | null;
  first_message_at: string;
  last_message_at: string;
  admin_notified_at: string | null;
  converted_to_user_id: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  engaged: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  qualified: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  demo_booked: "bg-pink-500/10 text-pink-600 border-pink-500/30",
  converted: "bg-green-500/10 text-green-600 border-green-500/30",
  lost: "bg-muted text-muted-foreground",
  cold: "bg-slate-500/10 text-slate-600 border-slate-500/30",
};

const SCORE_STYLES: Record<string, string> = {
  hot: "bg-red-500/10 text-red-600 border-red-500/30",
  warm: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  cold: "bg-slate-500/10 text-slate-600 border-slate-500/30",
};

export function WhatsAppLeadsTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: leads, isLoading } = useQuery({
    queryKey: ["whatsapp_leads"],
    queryFn: async (): Promise<Lead[]> => {
      const { data } = await supabase
        .from("whatsapp_leads" as any)
        .select("*")
        .order("last_message_at", { ascending: false })
        .limit(500);
      return (data || []) as unknown as Lead[];
    },
  });

  const filtered = (leads || []).filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (scoreFilter !== "all" && l.score !== scoreFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !l.phone_number.includes(q) &&
        !(l.name || "").toLowerCase().includes(q) &&
        !(l.business_type || "").toLowerCase().includes(q) &&
        !(l.email || "").toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    total: leads?.length || 0,
    hot: leads?.filter((l) => l.score === "hot").length || 0,
    qualified: leads?.filter((l) => l.status === "qualified").length || 0,
    new: leads?.filter((l) => l.status === "new").length || 0,
    converted: leads?.filter((l) => l.status === "converted").length || 0,
  };

  const openDetail = (lead: Lead) => {
    setOpenLead(lead);
    setEditNotes(lead.notes || "");
    setEditStatus(lead.status);
  };

  const handleSave = async () => {
    if (!openLead) return;
    setSaving(true);
    try {
      await supabase
        .from("whatsapp_leads" as any)
        .update({ notes: editNotes, status: editStatus })
        .eq("id", openLead.id);
      toast.success("Lead updated");
      setOpenLead(null);
      qc.invalidateQueries({ queryKey: ["whatsapp_leads"] });
    } catch (e) {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Card>
          <CardContent className="p-3">
            <div className="text-2xl font-semibold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total leads</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-2xl font-semibold flex items-center gap-1 text-red-600">
              <Flame className="h-5 w-5" /> {stats.hot}
            </div>
            <div className="text-xs text-muted-foreground">Hot</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-2xl font-semibold text-purple-600">{stats.qualified}</div>
            <div className="text-xs text-muted-foreground">Qualified</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-2xl font-semibold text-blue-600">{stats.new}</div>
            <div className="text-xs text-muted-foreground">New</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-2xl font-semibold text-green-600">{stats.converted}</div>
            <div className="text-xs text-muted-foreground">Converted</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search phone, name, business..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="engaged">Engaged</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
            <SelectItem value="demo_booked">Demo booked</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
            <SelectItem value="cold">Cold</SelectItem>
          </SelectContent>
        </Select>
        <Select value={scoreFilter} onValueChange={setScoreFilter}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All scores</SelectItem>
            <SelectItem value="hot">🔥 Hot</SelectItem>
            <SelectItem value="warm">🌤 Warm</SelectItem>
            <SelectItem value="cold">❄️ Cold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {leads?.length === 0
              ? "No leads yet. Unknown phones that message your bot will appear here automatically."
              : "No leads match the current filters."}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone / Name</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Msgs</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => (
                <TableRow
                  key={l.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openDetail(l)}
                >
                  <TableCell>
                    <div className="font-medium text-sm">{l.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">+{l.phone_number}</div>
                  </TableCell>
                  <TableCell className="text-sm">{l.business_type || "—"}</TableCell>
                  <TableCell className="text-sm">{l.interest || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_STYLES[l.status] || ""}>
                      {l.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={SCORE_STYLES[l.score] || ""}>
                      {l.score === "hot" ? "🔥" : l.score === "warm" ? "🌤" : "❄️"} {l.score}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{l.message_count}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(l.last_message_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </TableCell>
                  <TableCell>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Detail drawer */}
      <Sheet open={!!openLead} onOpenChange={(o) => !o && setOpenLead(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {openLead?.name || `+${openLead?.phone_number}`}
            </SheetTitle>
          </SheetHeader>

          {openLead && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Field label="Phone" value={`+${openLead.phone_number}`} />
                <Field label="Name" value={openLead.name} />
                <Field label="Email" value={openLead.email} />
                <Field label="Business" value={openLead.business_type} />
                <Field label="Interest" value={openLead.interest} />
                <Field label="Plan interest" value={openLead.plan_interest} />
                <Field label="Messages" value={String(openLead.message_count)} />
                <Field
                  label="First seen"
                  value={new Date(openLead.first_message_at).toLocaleString("en-IN")}
                />
                <Field
                  label="Last seen"
                  value={new Date(openLead.last_message_at).toLocaleString("en-IN")}
                />
                {openLead.admin_notified_at && (
                  <Field
                    label="Admin notified"
                    value={new Date(openLead.admin_notified_at).toLocaleString("en-IN")}
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="engaged">Engaged</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="demo_booked">Demo booked</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                    <SelectItem value="cold">Cold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={5}
                  placeholder="Internal notes about this lead..."
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    window.open(
                      `https://wa.me/${openLead.phone_number.replace(/\D/g, "")}`,
                      "_blank",
                    )
                  }
                >
                  Open in WhatsApp
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 text-sm py-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}
