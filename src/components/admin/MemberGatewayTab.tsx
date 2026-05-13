import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemberGatewaySettings } from "@/hooks/useMemberGatewaySettings";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pause, Play, Plus, Ban, Send, FileText, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { MemberAccessLogModal } from "./MemberAccessLogModal";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-success/10 text-success",
  paused: "bg-amber-500/10 text-amber-600",
  expired: "bg-muted text-muted-foreground",
  revoked: "bg-destructive/10 text-destructive",
  inactive: "bg-muted text-muted-foreground",
};

export const MemberGatewayTab = () => {
  const { settings, isLoading, update } = useMemberGatewaySettings();
  const qc = useQueryClient();

  const [confirmDisable, setConfirmDisable] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [templateDraft, setTemplateDraft] = useState("");
  const [draftDays, setDraftDays] = useState<string>("");
  const [extendModal, setExtendModal] = useState<{ id: string; name: string } | null>(null);
  const [extendDays, setExtendDays] = useState("30");
  const [logModal, setLogModal] = useState<{ id: string; email: string } | null>(null);

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["gateway-members"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, nevorai_member, nevorai_member_active, nevorai_member_status, nevorai_member_expires_at, nevorai_member_notified, nevorai_member_granted_at, nevorai_member_source",
        )
        .eq("nevorai_member", true)
        .order("nevorai_member_granted_at", { ascending: false, nullsFirst: false });
      return data || [];
    },
  });

  const callAdmin = async (action: string, target_user_id: string, payload: any = {}) => {
    const { data, error } = await supabase.functions.invoke("member-gateway-admin", {
      body: { action, target_user_id, ...payload },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Action failed");
      return false;
    }
    toast.success("Done");
    qc.invalidateQueries({ queryKey: ["gateway-members"] });
    return true;
  };

  const runManualCheck = async () => {
    const t = toast.loading("Running gateway check…");
    const { data, error } = await supabase.functions.invoke("nevorai-gateway-check", { body: {} });
    toast.dismiss(t);
    if (error) {
      toast.error(error.message);
      return;
    }
    const summary = (data as any)?.summary;
    toast.success(
      summary
        ? `Done — ${summary.granted} granted, ${summary.expired} expired, ${summary.warned} warned`
        : "Gateway check complete",
    );
    qc.invalidateQueries({ queryKey: ["gateway-members"] });
    qc.invalidateQueries({ queryKey: ["member-gateway-settings"] });
  };

  if (isLoading || !settings) {
    return <p className="text-sm text-muted-foreground p-4">Loading gateway settings…</p>;
  }

  const handleToggleGateway = async (next: boolean) => {
    if (!next) {
      setConfirmDisable(true);
      return;
    }
    await update({ gateway_enabled: true });
  };

  const handleDurationChange = async (value: string) => {
    if (value === "days") {
      const days = Number(draftDays || settings.access_duration_days || 30);
      await update({ access_duration_type: "days", access_duration_days: days });
    } else {
      await update({
        access_duration_type: value as "continuous" | "disabled",
        access_duration_days: null,
      });
    }
  };

  const saveDays = async () => {
    const n = Number(draftDays);
    if (!n || n <= 0 || n > 3650) {
      toast.error("Enter a valid number of days (1–3650)");
      return;
    }
    await update({ access_duration_type: "days", access_duration_days: n });
  };

  return (
    <div className="space-y-4">
      {/* Section 1 — Master switch */}
      <div className="glass-card p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-heading font-semibold sm:text-base flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              Nevorai Pro Gateway
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              When enabled, Nevorai calling app Pro users automatically get Individual plan access in Nevorai Flow.
            </p>
          </div>
          <Switch
            checked={settings.gateway_enabled}
            onCheckedChange={handleToggleGateway}
          />
        </div>
        {!settings.gateway_enabled && (
          <p className="text-xs text-amber-600 bg-amber-500/10 rounded-lg p-2">
            ⚠️ Gateway is OFF. New Nevorai Pro users will NOT get automatic access. Existing members are unaffected.
          </p>
        )}
      </div>

      {/* Section 2 — Access duration */}
      <div className="glass-card p-4 sm:p-5 space-y-3">
        <div>
          <h3 className="text-sm font-heading font-semibold sm:text-base">Access Duration</h3>
          <p className="text-xs text-muted-foreground mt-1">
            How long should Individual access last for new Nevorai Pro members?
          </p>
        </div>
        <RadioGroup
          value={settings.access_duration_type}
          onValueChange={handleDurationChange}
          className="space-y-2"
        >
          <label className="flex items-start gap-2 cursor-pointer">
            <RadioGroupItem value="continuous" id="dur-cont" className="mt-0.5" />
            <div>
              <p className="text-sm font-medium">Continuous</p>
              <p className="text-xs text-muted-foreground">
                Access lasts as long as they are Nevorai Pro (recommended). Auto-revokes if Pro expires.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <RadioGroupItem value="days" id="dur-days" className="mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Fixed duration</p>
              <p className="text-xs text-muted-foreground">Access lasts a set number of days from grant date.</p>
              {settings.access_duration_type === "days" && (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    className="w-24 h-8 text-xs"
                    value={draftDays || String(settings.access_duration_days ?? 30)}
                    onChange={(e) => setDraftDays(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">days</span>
                  <Button size="sm" className="h-8 gap-1 text-xs" onClick={saveDays}>
                    <Save size={12} /> Save
                  </Button>
                </div>
              )}
            </div>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <RadioGroupItem value="disabled" id="dur-disabled" className="mt-0.5" />
            <div>
              <p className="text-sm font-medium">Disabled</p>
              <p className="text-xs text-muted-foreground">
                Do not grant Individual access to new Nevorai Pro users. Existing members unaffected.
              </p>
            </div>
          </label>
        </RadioGroup>
        <p className="text-[10px] text-muted-foreground">
          Last updated: {new Date(settings.updated_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
        </p>
      </div>

      {/* Section 3 — Notifications */}
      <div className="glass-card p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-heading font-semibold sm:text-base">Notifications</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Notify users when their member access is granted.
            </p>
          </div>
          <Switch
            checked={settings.notify_enabled}
            onCheckedChange={(v) => update({ notify_enabled: v })}
          />
        </div>

        {settings.notify_enabled && (
          <>
            <div className="space-y-2 pt-2 border-t border-border/40">
              <Label className="text-xs">Channels</Label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notify_in_app}
                    onChange={(e) => update({ notify_in_app: e.target.checked })}
                  />
                  <span className="text-xs">In-app notification</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notify_email}
                    onChange={(e) => update({ notify_email: e.target.checked })}
                  />
                  <span className="text-xs">Email notification</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer opacity-60">
                  <input
                    type="checkbox"
                    checked={settings.notify_whatsapp}
                    onChange={(e) => update({ notify_whatsapp: e.target.checked })}
                    disabled
                  />
                  <span className="text-xs">WhatsApp (coming soon)</span>
                </label>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-border/40">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Welcome message template</Label>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    setTemplateDraft(settings.notification_template);
                    setEditingTemplate(true);
                  }}
                >
                  <FileText size={12} /> Edit Message
                </Button>
              </div>
              <pre className="bg-muted/40 rounded-lg p-3 text-[11px] whitespace-pre-wrap font-sans text-muted-foreground">
                {settings.notification_template
                  .replace("{{name}}", "[Name]")
                  .replace("{{login_url}}", "[Nevorai Flow login link]")}
              </pre>
              <p className="text-[10px] text-muted-foreground">
                Variables: <code>{"{{name}}"}</code>, <code>{"{{login_url}}"}</code>
              </p>
            </div>
          </>
        )}
      </div>

      {/* Section 4 — Member users table */}
      <div className="glass-card p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-heading font-semibold sm:text-base">Member Users</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {members.length} Nevorai member{members.length === 1 ? "" : "s"} in Nevorai Flow
            </p>
          </div>
          <Button size="sm" variant="outline" className="text-xs h-8" onClick={runManualCheck}>
            Run check now
          </Button>
        </div>

        {membersLoading && <p className="text-xs text-muted-foreground">Loading members…</p>}
        {!membersLoading && members.length === 0 && (
          <p className="text-xs text-muted-foreground py-6 text-center">
            No Nevorai members yet. They'll appear here automatically once the gateway grants access.
          </p>
        )}

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[10px] text-muted-foreground">
                <th className="p-2 font-medium">User</th>
                <th className="p-2 font-medium">Status</th>
                <th className="p-2 font-medium">Access</th>
                <th className="p-2 font-medium">Notified</th>
                <th className="p-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isContinuous = !m.nevorai_member_expires_at;
                const daysLeft = m.nevorai_member_expires_at
                  ? Math.ceil(
                      (new Date(m.nevorai_member_expires_at).getTime() - Date.now()) / 86400000,
                    )
                  : null;
                return (
                  <tr key={m.id} className="border-b border-border/40">
                    <td className="p-2">
                      <p className="font-medium truncate max-w-[160px]">{m.full_name || "—"}</p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{m.email}</p>
                    </td>
                    <td className="p-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          STATUS_BADGE[m.nevorai_member_status || "inactive"] || "bg-muted"
                        }`}
                      >
                        {m.nevorai_member_status || "inactive"}
                      </span>
                    </td>
                    <td className="p-2">
                      {isContinuous ? (
                        <span className="text-[11px]">Continuous</span>
                      ) : (
                        <div className="text-[11px]">
                          <span className={daysLeft !== null && daysLeft <= 3 ? "text-amber-600 font-semibold" : ""}>
                            {daysLeft !== null && daysLeft > 0 ? `${daysLeft}d left` : "Expired"}
                          </span>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(m.nevorai_member_expires_at!).toLocaleDateString("en-IN")}
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-[11px]">
                      {m.nevorai_member_notified ? (
                        <span className="text-success">✓</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        {m.nevorai_member_active ? (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1" onClick={() => callAdmin("pause", m.id)}>
                            <Pause size={10} /> Pause
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1" onClick={() => callAdmin("resume", m.id)}>
                            <Play size={10} /> Resume
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px] gap-1"
                          onClick={() => {
                            setExtendDays("30");
                            setExtendModal({ id: m.id, name: m.full_name || m.email || "" });
                          }}
                        >
                          <Plus size={10} /> Extend
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1" onClick={() => callAdmin("revoke", m.id)}>
                          <Ban size={10} /> Revoke
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1" onClick={() => callAdmin("resend_notification", m.id)}>
                          <Send size={10} /> Resend
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => setLogModal({ id: m.id, email: m.email })}>
                          Log
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden space-y-2">
          {members.map((m) => {
            const isContinuous = !m.nevorai_member_expires_at;
            const daysLeft = m.nevorai_member_expires_at
              ? Math.ceil((new Date(m.nevorai_member_expires_at).getTime() - Date.now()) / 86400000)
              : null;
            return (
              <div key={m.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.full_name || "—"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_BADGE[m.nevorai_member_status || "inactive"]}`}>
                    {m.nevorai_member_status}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isContinuous ? "Continuous access" : `${daysLeft}d left · expires ${new Date(m.nevorai_member_expires_at!).toLocaleDateString("en-IN")}`}
                </p>
                <div className="flex flex-wrap gap-1">
                  {m.nevorai_member_active ? (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => callAdmin("pause", m.id)}>Pause</Button>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => callAdmin("resume", m.id)}>Resume</Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => { setExtendDays("30"); setExtendModal({ id: m.id, name: m.full_name || m.email || "" }); }}>Extend</Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => callAdmin("revoke", m.id)}>Revoke</Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => callAdmin("resend_notification", m.id)}>Resend</Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => setLogModal({ id: m.id, email: m.email })}>Log</Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Last check */}
      {settings.last_check_at && (
        <div className="glass-card p-3 text-xs text-muted-foreground">
          Last automatic check: {new Date(settings.last_check_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
          {settings.last_check_summary && Object.keys(settings.last_check_summary).length > 0 && (
            <pre className="mt-2 text-[10px] bg-muted/40 rounded p-2 overflow-x-auto">
              {JSON.stringify(settings.last_check_summary, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Confirm disable */}
      <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn off the Nevorai Pro Gateway?</AlertDialogTitle>
            <AlertDialogDescription>
              New Nevorai Pro users will stop getting automatic Individual access. Existing members are not affected — they keep their current access. You can turn it back on anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await update({ gateway_enabled: false }); setConfirmDisable(false); }}>
              Turn off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit template */}
      <Dialog open={editingTemplate} onOpenChange={setEditingTemplate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Edit welcome message</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={10}
            value={templateDraft}
            onChange={(e) => setTemplateDraft(e.target.value)}
            className="text-xs font-mono"
          />
          <p className="text-[10px] text-muted-foreground">
            Use <code>{"{{name}}"}</code> and <code>{"{{login_url}}"}</code> as placeholders.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(false)}>Cancel</Button>
            <Button onClick={async () => { const ok = await update({ notification_template: templateDraft }); if (ok) setEditingTemplate(false); }}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend modal */}
      <Dialog open={!!extendModal} onOpenChange={(v) => !v && setExtendModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Extend access for {extendModal?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Add how many days?</Label>
            <Input type="number" min={1} max={3650} value={extendDays} onChange={(e) => setExtendDays(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendModal(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!extendModal) return;
                const ok = await callAdmin("extend", extendModal.id, { add_days: Number(extendDays) });
                if (ok) setExtendModal(null);
              }}
            >
              Extend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MemberAccessLogModal
        open={!!logModal}
        onOpenChange={(v) => !v && setLogModal(null)}
        userId={logModal?.id || null}
        email={logModal?.email || null}
      />
    </div>
  );
};
