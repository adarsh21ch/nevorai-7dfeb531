import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseProjectUrl } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Save, Loader2, Activity, CheckCircle2, XCircle } from "lucide-react";

export function MetaPixelTab() {
  const qc = useQueryClient();
  const [showToken, setShowToken] = useState(false);
  const [form, setForm] = useState({
    pixel_id: "",
    access_token: "",
    test_event_code: "",
    is_active: false,
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["meta-pixel-settings"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("meta_pixel_settings")
        .select("*, updated_by_profile:profiles!meta_pixel_settings_updated_by_fkey(full_name)")
        .limit(1).maybeSingle();
      return data;
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["meta-pixel-logs"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("meta_pixel_events_log")
        .select("*").order("sent_at", { ascending: false }).limit(20);
      return data ?? [];
    },
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        pixel_id: settings.pixel_id ?? "",
        access_token: settings.access_token ?? "",
        test_event_code: settings.test_event_code ?? "",
        is_active: !!settings.is_active,
      });
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        pixel_id: form.pixel_id || null,
        access_token: form.access_token || null,
        test_event_code: form.test_event_code || null,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      };
      if (settings?.id) {
        const { error } = await (supabase as any).from("meta_pixel_settings").update(payload).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("meta_pixel_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Meta pixel settings saved");
      qc.invalidateQueries({ queryKey: ["meta-pixel-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const sendTest = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseProjectUrl}/functions/v1/meta-pixel-fire`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          event_name: "TestEvent",
          event_id: `test_${Date.now()}`,
          custom_data: { source: "admin-ui" },
        }),
      });
      if (res.status === 403) {
        throw new Error("Test events must be triggered server-side. Use 'Test Events' tab in Meta Events Manager with your test_event_code instead.");
      }
      return res.json();
    },
    onSuccess: () => { toast.success("Test event queued"); qc.invalidateQueries({ queryKey: ["meta-pixel-logs"] }); },
    onError: (e: any) => toast.message(e?.message ?? "Test failed", { description: "Pixel fires are service-role only by design." }),
  });

  const lastUpdated = (settings as any)?.updated_at ? new Date((settings as any).updated_at).toLocaleString() : null;
  const updatedByName = (settings as any)?.updated_by_profile?.full_name;

  if (isLoading) return <div className="glass-card p-6"><Loader2 className="animate-spin" size={16} /></div>;

  return (
    <div className="space-y-4">
      <div className="glass-card p-3 sm:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-heading font-semibold flex items-center gap-2 sm:text-base">
            <Activity size={16} className="text-primary" /> Meta Pixel (Conversions API)
          </h2>
          <div className="flex items-center gap-2">
            <Label htmlFor="meta-active" className="text-xs">Active</Label>
            <Switch id="meta-active" checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground sm:text-xs">
          Server-side conversions (Lead, Purchase, ViewContent, CompleteRegistration) fire via this configuration.
        </p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Pixel ID</Label>
            <Input value={form.pixel_id} onChange={(e) => setForm((f) => ({ ...f, pixel_id: e.target.value }))} placeholder="1234567890" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Access Token</Label>
            <div className="flex gap-2">
              <Input
                type={showToken ? "text" : "password"}
                value={form.access_token}
                onChange={(e) => setForm((f) => ({ ...f, access_token: e.target.value }))}
                placeholder="EAA..."
              />
              <Button variant="outline" size="icon" onClick={() => setShowToken((s) => !s)}>
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Test Event Code <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={form.test_event_code} onChange={(e) => setForm((f) => ({ ...f, test_event_code: e.target.value }))} placeholder="TEST12345" />
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
          <Button variant="outline" size="sm" onClick={() => sendTest.mutate()} disabled={sendTest.isPending}>
            {sendTest.isPending ? "Sending…" : "Send test event"}
          </Button>
        </div>
      </div>

      <div className="glass-card p-3 sm:p-6">
        <h3 className="text-xs font-semibold mb-3">Recent events (last 20)</h3>
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No events yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
            {logs.map((l: any) => (
              <div key={l.id} className="flex items-center justify-between gap-2 text-xs border-b border-border/40 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  {l.success ? <CheckCircle2 size={12} className="text-green-500 shrink-0" /> : <XCircle size={12} className="text-red-500 shrink-0" />}
                  <span className="font-medium truncate">{l.event_name}</span>
                </div>
                <span className="text-muted-foreground tabular-nums shrink-0">{new Date(l.sent_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
