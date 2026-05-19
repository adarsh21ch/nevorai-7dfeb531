import { Plus, Trash2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  const limitReached = maxFields !== -1 && fields.length >= maxFields;
  const limitLabel = maxFields === -1 ? "unlimited" : String(maxFields);

  const addField = () => {
    if (limitReached) return;
    onChange([
      ...fields,
      { id: newId(), label: "", type: "short_text", required: false, options: null },
    ]);
  };

  const updateField = (id: string, patch: Partial<CustomField>) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeField = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
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
                <Button size="sm" type="button" onClick={addField} disabled={limitReached} className="gap-1.5">
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
        <div className="space-y-3">
          {fields.map((f, idx) => {
            const needsOptions = f.type === "dropdown" || f.type === "multi_choice";
            return (
              <div key={f.id} className="rounded-lg border border-border bg-card p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Field {idx + 1}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    type="button"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeField(f.id)}
                    aria-label="Remove field"
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Label</Label>
                    <Input
                      value={f.label}
                      onChange={(e) => updateField(f.id, { label: e.target.value })}
                      placeholder="e.g. Industry"
                      maxLength={80}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Type</Label>
                    <Select
                      value={f.type}
                      onValueChange={(v) =>
                        updateField(f.id, {
                          type: v as CustomFieldType,
                          options:
                            v === "dropdown" || v === "multi_choice" ? f.options || [] : null,
                        })
                      }
                    >
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(FIELD_TYPE_LABELS) as CustomFieldType[]).map((t) => (
                          <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {needsOptions && (
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Options (comma-separated)</Label>
                    <Input
                      value={(f.options || []).join(", ")}
                      onChange={(e) =>
                        updateField(f.id, {
                          options: e.target.value.split(",").map((o) => o.trimStart()),
                        })
                      }
                      placeholder="Coaching, SaaS, Real Estate, Other"
                      className="h-9"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <Label className="text-xs">Required field</Label>
                  <Switch
                    checked={f.required}
                    onCheckedChange={(v) => updateField(f.id, { required: v })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
