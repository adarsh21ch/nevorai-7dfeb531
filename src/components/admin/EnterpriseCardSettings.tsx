import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Crown, Save, Plus, Trash2, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface EnterpriseFeature {
  text: string;
  enabled: boolean;
}

interface EnterpriseConfig {
  id: number;
  badge_text: string;
  subheading: string;
  monthly_price: number;
  price_note: string;
  setup_fee_note: string;
  show_setup_fee_note: boolean;
  features: EnterpriseFeature[];
  cta_text: string;
  is_visible: boolean;
}

const DEFAULTS: Omit<EnterpriseConfig, "id"> = {
  badge_text: "For Large Networks",
  subheading: "100+ active team members",
  monthly_price: 5999,
  price_note: "Custom pricing based on scope",
  setup_fee_note: "+ One-time setup fee applies",
  show_setup_fee_note: true,
  features: [],
  cta_text: "Book a Call",
  is_visible: true,
};

export const EnterpriseCardSettings = () => {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<EnterpriseConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["enterprise-plan-config-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enterprise_plan_config" as any)
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as EnterpriseConfig | null;
    },
  });

  useEffect(() => {
    if (data) {
      setDraft({
        ...DEFAULTS,
        ...data,
        features: Array.isArray(data.features) ? data.features : [],
      });
    } else if (!isLoading) {
      setDraft({ id: 1, ...DEFAULTS });
    }
  }, [data, isLoading]);

  if (!draft) {
    return <div className="glass-card p-6 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  const update = <K extends keyof EnterpriseConfig>(key: K, value: EnterpriseConfig[K]) =>
    setDraft({ ...draft, [key]: value });

  const updateFeature = (idx: number, patch: Partial<EnterpriseFeature>) => {
    const next = [...draft.features];
    next[idx] = { ...next[idx], ...patch };
    update("features", next);
  };

  const moveFeature = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= draft.features.length) return;
    const next = [...draft.features];
    [next[idx], next[target]] = [next[target], next[idx]];
    update("features", next);
  };

  const addFeature = () =>
    update("features", [...draft.features, { text: "", enabled: true }]);

  const removeFeature = (idx: number) =>
    update("features", draft.features.filter((_, i) => i !== idx));

  const handleSave = async () => {
    // Trim empty feature rows
    const cleaned = draft.features
      .map((f) => ({ text: f.text.trim(), enabled: !!f.enabled }))
      .filter((f) => f.text.length > 0);

    setSaving(true);
    const { error } = await supabase
      .from("enterprise_plan_config" as any)
      .upsert(
        {
          id: 1,
          badge_text: draft.badge_text.trim() || DEFAULTS.badge_text,
          subheading: draft.subheading.trim() || DEFAULTS.subheading,
          monthly_price: Number(draft.monthly_price) || 0,
          price_note: draft.price_note.trim(),
          setup_fee_note: draft.setup_fee_note.trim(),
          show_setup_fee_note: !!draft.show_setup_fee_note,
          features: cleaned,
          cta_text: draft.cta_text.trim() || DEFAULTS.cta_text,
          is_visible: !!draft.is_visible,
        },
        { onConflict: "id" },
      );
    setSaving(false);
    if (error) {
      toast.error(`Save failed: ${error.message}`);
      return;
    }
    toast.success("Enterprise card saved");
    qc.invalidateQueries({ queryKey: ["enterprise-plan-config-admin"] });
    qc.invalidateQueries({ queryKey: ["enterprise-plan-config-public"] });
    setDraft({ ...draft, features: cleaned });
  };

  return (
    <div className="space-y-4">
      <EnterpriseWhatsAppSettings />

      <div className="glass-card p-4 sm:p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-heading font-semibold flex items-center gap-2">
              <Crown size={16} className="text-amber-500" />
              Enterprise Card Settings
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Edit what visitors see on the public pricing page. Changes go live within ~2 minutes.
            </p>
          </div>
          <a
            href="/#pricing"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0 mt-1"
          >
            Preview <ExternalLink size={11} />
          </a>
        </div>

        {/* Visibility toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
          <div>
            <Label className="text-sm font-medium">Show Enterprise Card</Label>
            <p className="text-[11px] text-muted-foreground">
              Hide the card from the public pricing page without losing your settings.
            </p>
          </div>
          <Switch
            checked={draft.is_visible}
            onCheckedChange={(v) => update("is_visible", v)}
          />
        </div>

        {/* Basic info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Badge Text</Label>
            <Input
              value={draft.badge_text}
              onChange={(e) => update("badge_text", e.target.value)}
              placeholder="For Large Networks"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Subheading</Label>
            <Input
              value={draft.subheading}
              onChange={(e) => update("subheading", e.target.value)}
              placeholder="100+ active team members"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Monthly Price (₹)</Label>
            <Input
              type="number"
              min={0}
              value={draft.monthly_price}
              onChange={(e) => update("monthly_price", parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CTA Button Text</Label>
            <Input
              value={draft.cta_text}
              onChange={(e) => update("cta_text", e.target.value)}
              placeholder="Book a Call"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Price Note (gold accent)</Label>
            <Input
              value={draft.price_note}
              onChange={(e) => update("price_note", e.target.value)}
              placeholder="Custom pricing based on scope"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Setup Fee Note (italic)</Label>
            <Input
              value={draft.setup_fee_note}
              onChange={(e) => update("setup_fee_note", e.target.value)}
              placeholder="+ One-time setup fee applies"
            />
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 mt-1">
              <span className="text-[11px] text-muted-foreground">
                Show setup fee note on the card
              </span>
              <Switch
                checked={draft.show_setup_fee_note}
                onCheckedChange={(v) => update("show_setup_fee_note", v)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Features list */}
      <div className="glass-card p-4 sm:p-5 space-y-3">
        <div>
          <h4 className="text-sm font-semibold">Features shown on pricing card</h4>
          <p className="text-[11px] text-muted-foreground">
            Use ▲▼ to reorder. Toggle to show/hide. Edit text inline.
          </p>
        </div>

        <div className="space-y-2">
          {draft.features.length === 0 && (
            <p className="text-xs text-muted-foreground italic px-1">
              No features yet — click “Add Feature” to start.
            </p>
          )}
          {draft.features.map((f, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-2"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => moveFeature(idx, -1)}
                  disabled={idx === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition"
                  aria-label="Move up"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => moveFeature(idx, 1)}
                  disabled={idx === draft.features.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition"
                  aria-label="Move down"
                >
                  <ArrowDown size={12} />
                </button>
              </div>
              <Switch
                checked={f.enabled}
                onCheckedChange={(v) => updateFeature(idx, { enabled: v })}
              />
              <Input
                value={f.text}
                onChange={(e) => updateFeature(idx, { text: e.target.value })}
                placeholder="Feature text"
                className="flex-1 h-8 text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeFeature(idx)}
                aria-label="Delete feature"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={addFeature}
        >
          <Plus size={14} /> Add Feature
        </Button>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full h-11 gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-background hover:opacity-90 font-semibold"
      >
        <Save size={16} />
        {saving ? "Saving…" : "Save Enterprise Card"}
      </Button>
    </div>
  );
};

// Admin-only WhatsApp contact settings used by the public Enterprise pricing CTA.
const EnterpriseWhatsAppSettings = () => {
  const qc = useQueryClient();
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [prefilledMessage, setPrefilledMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings" as any)
        .select("key, value")
        .in("key", ["enterprise_whatsapp_number", "enterprise_whatsapp_message"]);
      (data || []).forEach((s: any) => {
        if (s.key === "enterprise_whatsapp_number") setWhatsappNumber((s.value || "").replace(/\D/g, ""));
        if (s.key === "enterprise_whatsapp_message") setPrefilledMessage(s.value || "");
      });
      setLoaded(true);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings" as any).upsert(
      [
        { key: "enterprise_whatsapp_number", value: whatsappNumber },
        { key: "enterprise_whatsapp_message", value: prefilledMessage },
      ],
      { onConflict: "key" },
    );
    setSaving(false);
    if (error) {
      toast.error(`Save failed: ${error.message}`);
      return;
    }
    toast.success("WhatsApp settings saved");
    qc.invalidateQueries({ queryKey: ["enterprise-whatsapp-settings-public"] });
  };

  const previewLink = whatsappNumber && prefilledMessage
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(prefilledMessage)}`
    : "";

  return (
    <div className="glass-card p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-heading font-semibold flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-sm">📱</span>
            Enterprise WhatsApp Settings
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Drives the &quot;Chat on WhatsApp&quot; button on the public Enterprise pricing card.
            Updates go live within ~2 minutes.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Your WhatsApp Number</Label>
        <p className="text-[11px] text-muted-foreground">
          Include country code, no + or spaces. Example: 919876543210
        </p>
        <Input
          inputMode="numeric"
          value={whatsappNumber}
          onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ""))}
          placeholder="919876543210"
          disabled={!loaded}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Pre-filled Message</Label>
        <p className="text-[11px] text-muted-foreground">
          Auto-appears in the prospect's WhatsApp chat. Keep it short and natural.
        </p>
        <textarea
          value={prefilledMessage}
          onChange={(e) => setPrefilledMessage(e.target.value)}
          rows={4}
          placeholder="Hi! I'm interested in the Enterprise plan for nFlow..."
          disabled={!loaded}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
        <p className="text-[11px] text-muted-foreground text-right">{prefilledMessage.length} characters</p>
      </div>

      {previewLink && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-3 space-y-1.5">
          <p className="text-[11px] font-medium text-emerald-500">🔗 Preview Link</p>
          <p className="text-[11px] text-muted-foreground break-all">{previewLink}</p>
          <a
            href={previewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-emerald-500 hover:underline"
          >
            Test this link <ExternalLink size={11} />
          </a>
        </div>
      )}

      <Button
        onClick={save}
        disabled={saving || !whatsappNumber || !prefilledMessage}
        className="w-full h-11 gap-2 font-semibold text-white hover:opacity-90"
        style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
      >
        <Save size={16} />
        {saving ? "Saving…" : "Save WhatsApp Settings"}
      </Button>
    </div>
  );
};

