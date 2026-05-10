import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, MessageCircle } from "lucide-react";

const AUTOMATIONS: { id: string; label: string; description: string }[] = [
  { id: "welcome_signup", label: "Welcome on signup", description: "Sent right after a user signs up." },
  { id: "trial_ending", label: "Trial ending soon", description: "1–2 days before the trial expires." },
  { id: "trial_expired", label: "Trial expired", description: "Sent when the trial ends without upgrade." },
  { id: "plan_expiring", label: "Plan expiring soon", description: "Reminder before a paid plan ends." },
  { id: "plan_expired", label: "Plan expired", description: "Sent when a paid plan ends." },
  { id: "view_limit_80", label: "Daily views at 80%", description: "Heads-up when a creator hits 80% of their daily views." },
  { id: "view_limit_100", label: "Daily views reached", description: "Sent when daily views are exhausted." },
  { id: "new_lead", label: "New lead captured", description: "Notify the creator of a fresh lead." },
  { id: "payment_failed", label: "Payment failed", description: "Sent on failed payment attempts." },
];

interface Settings {
  id?: string;
  is_connected: boolean;
  phone_number_id: string | null;
  waba_id: string | null;
  verify_token: string | null;
  access_token: string | null;
  automations_enabled: Record<string, boolean>;
  templates: { automation_id: string; template_name: string; language?: string }[];
}

const emptySettings: Settings = {
  is_connected: false,
  phone_number_id: "",
  waba_id: "",
  verify_token: "",
  access_token: "",
  automations_enabled: {},
  templates: [],
};

const AdminWhatsAppPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_settings" as any)
      .select("*")
      .limit(1)
      .maybeSingle();
    if (error) toast.error("Failed to load settings");
    if (data) {
      setSettings({
        ...emptySettings,
        ...(data as any),
        automations_enabled: ((data as any).automations_enabled || {}) as Record<string, boolean>,
        templates: ((data as any).templates || []) as any[],
      });
    }
    setLoading(false);
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    const { data } = await supabase
      .from("whatsapp_logs" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setLogs((data as any[]) || []);
    setLogsLoading(false);
  };

  useEffect(() => {
    loadSettings();
    loadLogs();
  }, []);

  const save = async (patch: Partial<Settings>) => {
    setSaving(true);
    const next = { ...settings, ...patch };
    const payload: any = {
      is_connected: next.is_connected,
      phone_number_id: next.phone_number_id || null,
      waba_id: next.waba_id || null,
      verify_token: next.verify_token || null,
      access_token: next.access_token || null,
      automations_enabled: next.automations_enabled,
      templates: next.templates,
    };
    let res;
    if (settings.id) {
      res = await supabase.from("whatsapp_settings" as any).update(payload).eq("id", settings.id);
    } else {
      res = await supabase.from("whatsapp_settings" as any).insert(payload);
    }
    if (res.error) {
      toast.error("Save failed: " + res.error.message);
    } else {
      toast.success("Saved");
      setSettings(next);
    }
    setSaving(false);
  };

  const toggleAutomation = (id: string, enabled: boolean) => {
    const next = { ...(settings.automations_enabled || {}), [id]: enabled };
    save({ automations_enabled: next });
  };

  const setTemplate = (automationId: string, templateName: string) => {
    const others = settings.templates.filter((t) => t.automation_id !== automationId);
    const next = templateName.trim()
      ? [...others, { automation_id: automationId, template_name: templateName.trim(), language: "en" }]
      : others;
    setSettings((s) => ({ ...s, templates: next }));
  };

  const templateFor = (id: string) =>
    settings.templates.find((t) => t.automation_id === id)?.template_name || "";

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <MessageCircle className="text-emerald-500" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-semibold">WhatsApp</h1>
            <p className="text-sm text-muted-foreground">Connect Meta Cloud API and manage automated messages.</p>
          </div>
        </div>

        <Tabs defaultValue="credentials" className="w-full">
          <TabsList>
            <TabsTrigger value="credentials">Credentials</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="automations">Automations</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="credentials" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Meta Cloud API</CardTitle>
                <CardDescription>Required to send template messages.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Connection enabled</p>
                    <p className="text-xs text-muted-foreground">
                      When off, all sends are skipped (logged as skipped).
                    </p>
                  </div>
                  <Switch
                    checked={settings.is_connected}
                    onCheckedChange={(v) => save({ is_connected: v })}
                    disabled={saving}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Phone Number ID</Label>
                    <Input
                      value={settings.phone_number_id || ""}
                      onChange={(e) => setSettings((s) => ({ ...s, phone_number_id: e.target.value }))}
                      placeholder="e.g. 123456789012345"
                    />
                  </div>
                  <div>
                    <Label>WABA ID</Label>
                    <Input
                      value={settings.waba_id || ""}
                      onChange={(e) => setSettings((s) => ({ ...s, waba_id: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label>Permanent Access Token</Label>
                  <Input
                    type="password"
                    value={settings.access_token || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, access_token: e.target.value }))}
                    placeholder="EAAG..."
                  />
                </div>

                <div>
                  <Label>Webhook Verify Token</Label>
                  <Input
                    value={settings.verify_token || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, verify_token: e.target.value }))}
                  />
                </div>

                <Button onClick={() => save({})} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save credentials
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Template mapping</CardTitle>
                <CardDescription>
                  Enter the WhatsApp template name (as approved in Meta Business Manager) for each automation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {AUTOMATIONS.map((a) => (
                  <div key={a.id} className="grid sm:grid-cols-[1fr_2fr] gap-3 items-start">
                    <div>
                      <p className="text-sm font-medium">{a.label}</p>
                      <p className="text-xs text-muted-foreground">{a.description}</p>
                    </div>
                    <Input
                      value={templateFor(a.id)}
                      onChange={(e) => setTemplate(a.id, e.target.value)}
                      placeholder="approved_template_name"
                    />
                  </div>
                ))}
                <Button onClick={() => save({})} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save templates
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="automations" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Automation triggers</CardTitle>
                <CardDescription>Toggle each trigger on or off.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {AUTOMATIONS.map((a) => {
                  const enabled = settings.automations_enabled?.[a.id] ?? false;
                  return (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                      <div className="pr-3">
                        <p className="text-sm font-medium">{a.label}</p>
                        <p className="text-xs text-muted-foreground">{a.description}</p>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(v) => toggleAutomation(a.id, v)}
                        disabled={saving}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent sends</CardTitle>
                  <CardDescription>Last 100 events.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={loadLogs} disabled={logsLoading}>
                  {logsLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Refresh
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Automation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Meta ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                          No events yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {new Date(l.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                          </TableCell>
                          <TableCell className="text-xs">{l.user_email || l.user_id?.slice(0, 8) || "—"}</TableCell>
                          <TableCell className="text-xs">{l.phone_number || "—"}</TableCell>
                          <TableCell className="text-xs">{l.automation_id || "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                l.status === "sent" ? "default"
                                : l.status === "failed" ? "destructive"
                                : "secondary"
                              }
                            >
                              {l.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{l.meta_message_id || "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminWhatsAppPage;
