import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseProjectUrl } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Copy, CreditCard, Save, Loader2, Check } from "lucide-react";

const WEBHOOK_PATH = "/functions/v1/razorpay-webhook";

export function PaymentsTab() {
  const qc = useQueryClient();
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [form, setForm] = useState({
    key_id: "",
    key_secret: "",
    webhook_secret: "",
    is_active: false,
  });
  const [copied, setCopied] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["payment-provider-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("payment_provider_settings")
        .select("*, updated_by_profile:profiles!payment_provider_settings_updated_by_fkey(full_name)")
        .eq("provider", "razorpay").limit(1).maybeSingle();
      if (error) console.warn(error);
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setForm({
        key_id: settings.key_id ?? "",
        key_secret: settings.key_secret ?? "",
        webhook_secret: settings.webhook_secret ?? "",
        is_active: !!settings.is_active,
      });
    }
  }, [settings]);

  const webhookUrl = `${supabaseProjectUrl}${WEBHOOK_PATH}`;

  const save = useMutation({
    mutationFn: async () => {
      if (form.key_id && !/^rzp_(test|live)_[a-zA-Z0-9]+$/.test(form.key_id)) {
        throw new Error("key_id must start with rzp_test_ or rzp_live_");
      }
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        provider: "razorpay",
        key_id: form.key_id || null,
        key_secret: form.key_secret || null,
        webhook_secret: form.webhook_secret || null,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      };
      if (settings?.id) {
        const { error } = await (supabase as any).from("payment_provider_settings")
          .update(payload).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("payment_provider_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Payment settings saved");
      qc.invalidateQueries({ queryKey: ["payment-provider-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const testWebhook = useMutation({
    mutationFn: async () => {
      // Just probe reachability — real signature verification will fail (expected).
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "test.ping", payload: {} }),
      });
      return { status: res.status };
    },
    onSuccess: (r) => toast.success(`Webhook reachable — HTTP ${r.status} (signature rejection is expected on a ping)`),
    onError: () => toast.error("Webhook unreachable"),
  });

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const lastUpdated = (settings as any)?.updated_at
    ? new Date((settings as any).updated_at).toLocaleString()
    : null;
  const updatedByName = (settings as any)?.updated_by_profile?.full_name;

  if (isLoading) return <div className="glass-card p-6"><Loader2 className="animate-spin" size={16} /></div>;

  return (
    <div className="glass-card p-3 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-heading font-semibold flex items-center gap-2 sm:text-base">
          <CreditCard size={16} className="text-primary" /> Razorpay Payments
        </h2>
        <div className="flex items-center gap-2">
          <Label htmlFor="rzp-active" className="text-xs">Active</Label>
          <Switch
            id="rzp-active"
            checked={form.is_active}
            onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground sm:text-xs">
        These keys override <code>RAZORPAY_*</code> environment secrets when active. Swap accounts here without touching deploys.
      </p>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Key ID</Label>
          <Input
            value={form.key_id}
            onChange={(e) => setForm((f) => ({ ...f, key_id: e.target.value }))}
            placeholder="rzp_live_..."
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Key Secret</Label>
          <div className="flex gap-2">
            <Input
              type={showSecret ? "text" : "password"}
              value={form.key_secret}
              onChange={(e) => setForm((f) => ({ ...f, key_secret: e.target.value }))}
              placeholder="••••••••"
            />
            <Button variant="outline" size="icon" onClick={() => setShowSecret((s) => !s)}>
              {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Webhook Secret</Label>
          <div className="flex gap-2">
            <Input
              type={showWebhook ? "text" : "password"}
              value={form.webhook_secret}
              onChange={(e) => setForm((f) => ({ ...f, webhook_secret: e.target.value }))}
              placeholder="••••••••"
            />
            <Button variant="outline" size="icon" onClick={() => setShowWebhook((s) => !s)}>
              {showWebhook ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Webhook URL (paste in Razorpay dashboard)</Label>
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copyUrl}>
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </Button>
          </div>
        </div>
      </div>

      {lastUpdated && (
        <p className="text-[11px] text-muted-foreground">
          Last updated {lastUpdated}{updatedByName ? ` by ${updatedByName}` : ""}.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="hero" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save</>}
        </Button>
        <Button variant="outline" size="sm" onClick={() => testWebhook.mutate()} disabled={testWebhook.isPending}>
          {testWebhook.isPending ? "Pinging…" : "Test webhook reachability"}
        </Button>
      </div>
    </div>
  );
}
