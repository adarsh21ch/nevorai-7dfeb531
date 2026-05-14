import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import { Save, Star, Mail, CheckCircle2, XCircle, Loader2, AlertTriangle, Clock } from "lucide-react";
// TrialSettingsCard moved to AdminSubscriptionsPage (Plans tab)

const AdminSettingsPage = () => {
  const queryClient = useQueryClient();

  const { data: settings = [] } = useQuery({
    queryKey: ["admin-platform-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("*");
      return data || [];
    },
  });

  const getVal = (key: string) => settings.find((s) => s.key === key)?.value || "";

  const [announcementText, setAnnouncementText] = useState("");
  const [announcementActive, setAnnouncementActive] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maxVideoSeconds, setMaxVideoSeconds] = useState("60");
  const [maxPerPage, setMaxPerPage] = useState("8");
  const [videoFeatureEnabled, setVideoFeatureEnabled] = useState(true);

  useEffect(() => {
    if (settings.length) {
      setAnnouncementText(getVal("announcement_text"));
      setAnnouncementActive(getVal("announcement_active") === "true");
      setMaintenanceMode(getVal("maintenance_mode") === "true");
      setMaxVideoSeconds(getVal("testimonial_max_video_seconds") || "60");
      setMaxPerPage(getVal("testimonial_max_per_page") || "8");
      setVideoFeatureEnabled(getVal("testimonial_video_feature_enabled") !== "false");
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { key: "announcement_text", value: announcementText },
        { key: "announcement_active", value: String(announcementActive) },
        { key: "maintenance_mode", value: String(maintenanceMode) },
        { key: "testimonial_max_video_seconds", value: maxVideoSeconds },
        { key: "testimonial_max_per_page", value: maxPerPage },
        { key: "testimonial_video_feature_enabled", value: String(videoFeatureEnabled) },
      ];
      for (const u of updates) {
        await supabase.from("platform_settings").update({ value: u.value }).eq("key", u.key);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-platform-settings"] });
      toast.success("Settings saved");
    },
  });

  const { data: gmailConnected, refetch: refetchGmail, isFetching: gmailChecking } = useQuery({
    queryKey: ["gmail-connection-status"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("send-gmail-email", { method: "GET" });
        if (error) throw error;
        return {
          connected: Boolean(data?.connected),
          email: data?.email ?? null,
          reason: (data?.reason as string | null) ?? null,
          hasToken: Boolean(data?.email),
        };
      } catch {
        return { connected: false, email: null, reason: "probe_failed", hasToken: false };
      }
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Detect ?gmail=connected on return from OAuth callback (popup-blocked fallback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") === "connected") {
      params.delete("gmail");
      const newSearch = params.toString();
      const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", newUrl);

      queryClient.invalidateQueries({ queryKey: ["gmail-connection-status"] });
      setTimeout(() => {
        refetchGmail();
      }, 500);
      toast.success("Gmail reconnected successfully");
    }
  }, [queryClient, refetchGmail]);

  const [connectingGmail, setConnectingGmail] = useState(false);

  const handleConnectGmail = useCallback(async () => {
    setConnectingGmail(true);

    // 1) Open a blank popup synchronously to avoid popup blockers
    const width = 500;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      "about:blank",
      "gmail_oauth",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no`
    );

    try {
      const returnTo = `${window.location.origin}/admin/settings?gmail=connected`;
      const { data, error } = await supabase.functions.invoke("gmail-oauth-init", {
        body: { return_to: returnTo },
      });

      if (error || !data?.auth_url) {
        try { popup?.close(); } catch {}
        toast.error(data?.error || "Failed to start Gmail connection");
        setConnectingGmail(false);
        return;
      }

      // 2) Redirect popup to Google OAuth, or fall back to full-page if popup blocked
      if (!popup || popup.closed) {
        window.location.href = data.auth_url;
        return;
      }
      popup.location.href = data.auth_url;

      // 3) Listen for postMessage from callback page
      const allowedOrigins = new Set<string>([
        "https://atwnmovdnblcqyvhaxls.supabase.co",
        window.location.origin,
      ]);

      const cleanup = () => {
        window.removeEventListener("message", onMessage);
        clearInterval(closedPoll);
        setConnectingGmail(false);
      };

      const onMessage = (event: MessageEvent) => {
        if (!allowedOrigins.has(event.origin)) return;
        const data = event.data as { type?: string; email?: string; message?: string } | null;
        if (!data?.type) return;

        if (data.type === "GMAIL_OAUTH_SUCCESS") {
          try { popup.close(); } catch {}
          cleanup();
          queryClient.invalidateQueries({ queryKey: ["gmail-connection-status"] });
          setTimeout(() => refetchGmail(), 400);
          toast.success(`Gmail connected${data.email ? ` (${data.email})` : ""}`);
        } else if (data.type === "GMAIL_OAUTH_ERROR") {
          try { popup.close(); } catch {}
          cleanup();
          toast.error(data.message || "Gmail connection failed");
        }
      };

      window.addEventListener("message", onMessage);

      // 4) Detect manual popup close
      const closedPoll = setInterval(() => {
        if (popup.closed) {
          cleanup();
        }
      }, 500);
    } catch {
      try { popup?.close(); } catch {}
      toast.error("Failed to connect Gmail");
      setConnectingGmail(false);
    }
  }, [queryClient, refetchGmail]);

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("send-gmail-email", {
        method: "GET",
        body: undefined,
        // pass action via query string
        headers: undefined,
      } as any);
      // supabase-js doesn't expose query params on invoke; use direct fetch
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-gmail-email?action=disconnect`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session?.access_token ?? ""}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (!res.ok) throw new Error("Disconnect failed");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gmail disconnected. Click Connect Gmail to re-authorize.");
      refetchGmail();
    },
    onError: () => toast.error("Failed to disconnect Gmail"),
  });

  const testEmailMutation = useMutation({
    mutationFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const { data: { session } } = await supabase.auth.getSession();
      const targetEmail = gmailConnected?.email;
      if (!targetEmail) throw new Error("No connected Gmail address found");

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#1a1a1a;padding:40px 20px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
    <h1 style="color:#22c55e;font-size:20px;margin:0 0 12px;">nFlow by Nevorai — Test Email</h1>
    <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 12px;">
      If you can read this, your Gmail connection is fully working end-to-end.
    </p>
    <p style="font-size:13px;color:#888;margin:0;">Sent at ${new Date().toLocaleString()}</p>
  </div>
</body></html>`;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-gmail-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            to: targetEmail,
            subject: "nFlow by Nevorai — Gmail test email",
            html,
            sender_name: "nFlow by Nevorai",
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.sent) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      return json;
    },
    onSuccess: () => {
      toast.success(`Test email sent to ${gmailConnected?.email}`);
    },
    onError: (e: any) => {
      const details = [e?.message || "unknown error"];
      const googleProjectNumber = e?.context?.google_project_number ?? e?.google_project_number;
      const activationUrl = e?.context?.activation_url ?? e?.activation_url;

      if (googleProjectNumber) {
        details.push(`Google project: ${googleProjectNumber}`);
      }

      if (activationUrl) {
        details.push(`Enable here: ${activationUrl}`);
      }

      toast.error(`Test email failed: ${details.join(" • ")}`);
    },
  });

  return (
    <AdminLayout>
      <div className="w-full min-w-0 space-y-4">
        <h1 className="text-lg font-heading font-bold sm:text-2xl">Platform Settings</h1>

        {/* Gmail Connection */}
        <div className="glass-card p-3 sm:p-6 space-y-3">
          <h2 className="text-sm font-heading font-semibold flex items-center gap-2 sm:text-base">
            <Mail size={16} className="text-primary" /> Gmail Email Connection
          </h2>
          <p className="text-[11px] text-muted-foreground leading-relaxed sm:text-xs">
            Connect your Gmail account to send confirmation emails. Supports up to 2,000 emails/day with Google Workspace.
          </p>

          <div className="flex items-center gap-2.5">
            {gmailChecking ? (
              <>
                <Loader2 size={16} className="text-muted-foreground shrink-0 animate-spin" />
                <span className="text-xs text-muted-foreground">Checking Gmail status…</span>
              </>
            ) : gmailConnected?.connected ? (
              <>
                <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                <span className="text-xs text-foreground truncate sm:text-sm">
                  Connected{gmailConnected?.email ? ` (${gmailConnected.email})` : ""}
                </span>
              </>
            ) : gmailConnected?.hasToken ? (
              <>
                <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-amber-500 sm:text-sm font-medium">
                    Reconnect needed{gmailConnected?.email ? ` (${gmailConnected.email})` : ""}
                  </span>
                  <span className="text-[10px] text-muted-foreground sm:text-[11px]">
                    {gmailConnected?.reason === "token_revoked"
                      ? "Google revoked the refresh token. Emails will not send until you reconnect."
                      : `Gmail probe failed (${gmailConnected?.reason ?? "unknown"}). Reconnect to restore email sending.`}
                  </span>
                </div>
              </>
            ) : (
              <>
                <XCircle size={16} className="text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">Not connected</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={gmailConnected?.connected ? "outline" : "hero"}
              size="sm"
              className="min-h-[40px] text-xs"
              onClick={handleConnectGmail}
              disabled={connectingGmail}
            >
              {connectingGmail ? (
                <><Loader2 size={14} className="animate-spin" /> Connecting...</>
              ) : gmailConnected?.connected ? "Reconnect" : gmailConnected?.hasToken ? "Reconnect Gmail" : "Connect Gmail"}
            </Button>
            {gmailConnected?.connected && (
              <Button
                variant="outline"
                size="sm"
                className="min-h-[40px] text-xs"
                onClick={() => testEmailMutation.mutate()}
                disabled={testEmailMutation.isPending}
              >
                {testEmailMutation.isPending ? (
                  <><Loader2 size={14} className="animate-spin" /> Sending…</>
                ) : "Send Test Email"}
              </Button>
            )}
            {gmailConnected?.hasToken && (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[40px] text-xs"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? "Disconnecting…" : "Disconnect"}
              </Button>
            )}
          </div>

          <div className="text-[10px] text-muted-foreground sm:text-[11px]">
            <p className="mb-1">Redirect URI for Google Console:</p>
            <code className="text-[10px] bg-muted px-2 py-1 rounded block break-all sm:text-xs">
              {`https://atwnmovdnblcqyvhaxls.supabase.co/functions/v1/gmail-oauth-callback`}
            </code>
          </div>
        </div>

        {/* Announcement & Maintenance */}
        <div className="glass-card p-3 sm:p-6 space-y-5">
          <div>
            <h2 className="text-sm font-heading font-semibold mb-3 sm:text-base">Announcement Banner</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between min-h-[44px]">
                <Label className="text-xs sm:text-sm">Show Announcement</Label>
                <Switch checked={announcementActive} onCheckedChange={setAnnouncementActive} />
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Announcement Text</Label>
                <Textarea value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} className="mt-1.5 bg-muted border-border text-sm" placeholder="Write your announcement..." rows={3} />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h2 className="text-sm font-heading font-semibold mb-3 sm:text-base">Maintenance Mode</h2>
            <div className="flex items-center justify-between gap-3 min-h-[44px]">
              <div className="flex-1 min-w-0">
                <Label className="text-xs sm:text-sm">Enable Maintenance Mode</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5 sm:text-xs">Users will see a maintenance page.</p>
              </div>
              <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
            </div>
          </div>

          {/* Testimonials Settings */}
          <div className="border-t border-border pt-5">
            <h2 className="text-sm font-heading font-semibold mb-3 flex items-center gap-2 sm:text-base">
              <Star size={16} className="text-primary" /> Testimonials
            </h2>
            <div className="space-y-3">
              <div>
                <Label className="text-xs sm:text-sm">Max video testimonial duration</Label>
                <Select value={maxVideoSeconds} onValueChange={setMaxVideoSeconds}>
                  <SelectTrigger className="mt-1.5 bg-muted border-border w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 seconds</SelectItem>
                    <SelectItem value="45">45 seconds</SelectItem>
                    <SelectItem value="60">60 seconds</SelectItem>
                    <SelectItem value="90">90 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs sm:text-sm">Max testimonials per landing page</Label>
                <Input type="number" min={1} max={20} value={maxPerPage} onChange={(e) => setMaxPerPage(e.target.value)} className="mt-1.5 bg-muted border-border w-full text-sm" />
              </div>

              <div className="flex items-center justify-between gap-3 min-h-[44px]">
                <div className="flex-1 min-w-0">
                  <Label className="text-xs sm:text-sm">Allow video testimonials</Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5 sm:text-xs">If disabled, only text testimonials available</p>
                </div>
                <Switch checked={videoFeatureEnabled} onCheckedChange={setVideoFeatureEnabled} />
              </div>
            </div>
          </div>
        </div>

        <Button variant="hero" className="w-full min-h-[44px] text-sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save size={16} /> {saveMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </AdminLayout>
  );
};

export default AdminSettingsPage;
