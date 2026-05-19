import { useState } from "react";
import { Plus, Pencil, Trash2, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Link as RouterLink } from "@/lib/router-compat";

export type CustomFieldType =
  | "short_text" | "long_text" | "number" | "phone" | "email" | "date" | "dropdown" | "multi_choice";

export interface CustomField {
  id: string;
  label: string;
  type: CustomFieldType;
  placeholder?: string | null;
  required: boolean;
  options?: string[] | null;
}

export const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  short_text: "Short Text",
  long_text: "Long Text",
  number: "Number",
  phone: "Phone",
  email: "Email",
  date: "Date",
  dropdown: "Dropdown",
  multi_choice: "Multi-Choice",
};

const newId = () => `cf_${Math.random().toString(36).slice(2, 10)}`;

interface Props {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
  enabled: boolean;          // feature_custom_form_fields
  maxFields: number;         // -1 = unlimited, 0 = blocked, n = max
}

export const CustomFieldsBuilder = ({ fields, onChange, enabled, maxFields }: Props) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomField | null>(null);

  const limitReached = maxFields !== -1 && fields.length >= maxFields;
  const limitLabel = maxFields === -1 ? "unlimited" : String(maxFields);

  const openAdd = () => {
    setEditing({ id: newId(), label: "", type: "short_text", placeholder: "", required: false, options: [] });
    setModalOpen(true);
  };
  const openEdit = (f: CustomField) => { setEditing({ ...f }); setModalOpen(true); };
  const remove = (id: string) => {
    if (!confirm("Delete this custom field?")) return;
    onChange(fields.filter((f) => f.id !== id));
  };

  const saveField = () => {
    if (!editing) return;
    const label = editing.label.trim();
    if (!label) { toast.error("Label is required"); return; }
    if ((editing.type === "dropdown" || editing.type === "multi_choice")) {
      const opts = (editing.options || []).map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) { toast.error("Add at least 2 options (comma-separated)"); return; }
      editing.options = opts;
    } else {
      editing.options = null;
    }
    const exists = fields.some((f) => f.id === editing.id);
    onChange(exists ? fields.map((f) => (f.id === editing.id ? editing : f)) : [...fields, editing]);
    setModalOpen(false);
    setEditing(null);
  };

  if (!enabled) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 opacity-80">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-primary" />
              <Label className="font-semibold">Custom Fields</Label>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Custom fields are available on Basic and Pro plans.
            </p>
          </div>
          <RouterLink to="/upgrade">
            <Button size="sm" variant="default" className="h-8">Upgrade</Button>
          </RouterLink>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="font-semibold">Custom Fields</Label>
          <p className="text-[11px] text-muted-foreground">
            {fields.length} / {limitLabel}
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button size="sm" type="button" onClick={openAdd} disabled={limitReached} className="gap-1.5">
                  <Plus size={14} /> Add Field
                </Button>
              </span>
            </TooltipTrigger>
            {limitReached && (
              <TooltipContent>
                You've reached your custom field limit ({limitLabel}). Upgrade to add more →
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground">No custom fields yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Click "+ Add Field" to create your first one</p>
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((f) => (
            <div key={f.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{f.label}</span>
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{FIELD_TYPE_LABELS[f.type]}</span>
                    {f.required && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">Required</span>}
                  </div>
                  
                  {f.options && f.options.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1">Options: {f.options.join(", ")}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(f)}><Pencil size={13} /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(f.id)}><Trash2 size={13} /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={(v) => { setModalOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing && fields.some((f) => f.id === editing.id) ? "Edit" : "Add"} Custom Field</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Label *</Label>
                <Input
                  value={editing.label}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  placeholder="e.g. Industry"
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Field Type *</Label>
                <Select value={editing.type} onValueChange={(v) => setEditing({ ...editing, type: v as CustomFieldType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FIELD_TYPE_LABELS) as CustomFieldType[]).map((t) => (
                      <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(editing.type === "dropdown" || editing.type === "multi_choice") && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Options (comma-separated)</Label>
                  <Input
                    value={(editing.options || []).join(", ")}
                    onChange={(e) => setEditing({ ...editing, options: e.target.value.split(",").map((o) => o) })}
                    placeholder="Coaching, SaaS, Real Estate, Other"
                  />
                </div>
              )}
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <Label className="text-sm">Required field</Label>
                <Switch checked={editing.required} onCheckedChange={(v) => setEditing({ ...editing, required: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={saveField}>Save Field</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
