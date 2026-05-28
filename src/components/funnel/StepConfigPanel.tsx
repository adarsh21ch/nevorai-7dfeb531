// Per-step configuration editor. One panel, per-type body.
// Reuses existing funnel_steps columns to avoid a schema migration:
//   description       → instruction text shown to the prospect
//   cta_text          → button label
//   cta_url           → URL for CTA / Link step
//   booking_url       → pre-built wa.me URL (auto-derived from number+message)
//   unlock_rule_value → JSON blob { number, message, open_in_new_tab, notify } for re-edit
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { VideoThumbnail } from "@/components/VideoThumbnail";
import { getStepTypeMeta } from "@/components/funnel/StepTypeSelector";
import {
  Play, Video as VideoIcon, ExternalLink, MessageCircle, UserCheck, Lock,
  Info, Check, Clock, ShieldCheck, Eye, EyeOff, ChevronDown
} from "lucide-react";
import { Link as RouterLink } from "@/lib/router-compat";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export interface FlowStep {
  id?: string;
  step_order: number;
  title: string;
  description: string;
  step_type: string;
  video_asset_id: string | null;
  is_active: boolean;
  unlock_rule_type: string;
  unlock_rule_value: string;
  cta_text: string;
  cta_url: string;
  booking_url: string;
  unlock_condition?: string;
  unlock_percentage?: number;
  time_delay_enabled?: boolean;
  time_delay_minutes?: number;
  timer_cta_enabled?: boolean;
  timer_cta_text?: string;
  timer_cta_url?: string;
  timer_cta_style?: string;
  video_topics_step_enabled?: boolean;
  video_topics_step?: any;
  access_code_enabled?: boolean;
  access_code_plain?: string;
  access_code_hash?: string | null;
  access_code_message?: string;
  _access_code_raw?: string;
  speaker_mode_step?: string;
  speaker_name_custom?: string;
  speaker_title?: string;
  speaker_bio?: string;
  speaker_photo_url_custom?: string;
  allow_skip?: boolean;
  lock_next_step?: boolean;
  unlock_after_percent?: number;
}

interface StepConfigPanelProps {
  open: boolean;
  onClose: () => void;
  step: FlowStep | null;
  stepIndex: number;
  totalSteps: number;
  onUpdate: (key: keyof FlowStep, value: any) => void;
  onOpenVideoPicker: () => void;
  speakerScope?: string;
  videoTopicsScope?: string;
  userProfile?: any;
}

// Helpers to read/write the JSON-encoded extras stored in unlock_rule_value
type Extras = { number?: string; cc?: string; message?: string; open_in_new_tab?: boolean; notify?: boolean };
const parseExtras = (raw: string | undefined | null): Extras => {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
};
const buildWaUrl = (cc: string, number: string, message: string) => {
  const digits = `${cc}${number}`.replace(/\D/g, "");
  if (!digits) return "";
  const base = `https://wa.me/${digits}`;
  return message?.trim() ? `${base}?text=${encodeURIComponent(message)}` : base;
};

export const StepConfigPanel = ({ open, onClose, step, stepIndex, totalSteps, onUpdate, onOpenVideoPicker }: StepConfigPanelProps) => {
  if (!step) return null;
  const meta = getStepTypeMeta(step.step_type);
  const Icon = meta.icon;
  const extras = useMemo(() => parseExtras(step.unlock_rule_value), [step.unlock_rule_value]);
  const setExtras = (patch: Partial<Extras>) => {
    onUpdate("unlock_rule_value", JSON.stringify({ ...extras, ...patch }));
  };

  // Video preview
  const { data: videoInfo } = useQuery({
    queryKey: ["step-video-preview", step.video_asset_id],
    queryFn: async () => {
      if (!step.video_asset_id) return null;
      const { data } = await supabase
        .from("video_assets")
        .select("id, title, thumbnail_url, public_url, duration_seconds")
        .eq("id", step.video_asset_id)
        .maybeSingle();
      return data;
    },
    enabled: !!step.video_asset_id,
  });

  const renderHeader = () => (
    <div className="flex items-center gap-3 pb-2">
      <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center`}>
        <Icon size={20} className={meta.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Step {stepIndex + 1} of {totalSteps}</div>
        <div className="font-heading text-lg font-semibold leading-tight">{meta.label} settings</div>
      </div>
      {/* Step Active pill toggle — top right */}
      <button
        type="button"
        onClick={() => onUpdate("is_active", step.is_active === false)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition border ${
          step.is_active !== false
            ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
            : "bg-rose-500/15 text-rose-600 border-rose-500/30"
        }`}
        title={step.is_active !== false ? "Step is active — visible to viewers" : "Step is inactive — hidden from viewers"}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${step.is_active !== false ? "bg-emerald-500" : "bg-rose-500"}`} />
        {step.is_active !== false ? "Active" : "Inactive"}
      </button>
    </div>
  );


  const renderCommon = () => (
    <div className="space-y-3">
      <div>
        <Label className="text-sm">Title</Label>
        <Input value={step.title} onChange={(e) => onUpdate("title", e.target.value)} placeholder="Step title" className="mt-1.5" />
      </div>
    </div>
  );

  // VIDEO
  const renderVideo = () => {
    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm mb-1.5 block">Video</Label>
          {videoInfo ? (
            <div className="rounded-xl border border-border p-3 flex items-center gap-3 bg-muted/30">
              <div className="w-24 flex-shrink-0">
                <VideoThumbnail thumbnailUrl={videoInfo.thumbnail_url} videoUrl={videoInfo.public_url} title={videoInfo.title} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{videoInfo.title}</p>
                {videoInfo.duration_seconds ? (
                  <p className="text-xs text-muted-foreground">
                    {Math.floor(videoInfo.duration_seconds / 60)}:{(videoInfo.duration_seconds % 60).toString().padStart(2, "0")}
                  </p>
                ) : null}
                <Button variant="link" size="sm" className="px-0 h-auto mt-1" onClick={onOpenVideoPicker}>Change video</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={onOpenVideoPicker} className="w-full justify-center gap-2">
              <VideoIcon size={16} /> Select a video from your gallery
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl bg-muted/30 border border-border p-3">
          <div className="min-w-0">
            <Label className="text-sm font-medium">Allow viewer to skip ahead</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">Independent from the video gallery setting.</p>
          </div>
          <Switch
            checked={step.allow_skip !== false}
            onCheckedChange={(v) => onUpdate("allow_skip", v)}
          />
        </div>
      </div>
    );
  };


  // LEAD FORM — funnel-level lead capture fields are reused. Per-step lead forms aren't in schema.
  const renderLeadForm = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/30 p-3 flex gap-3">
        <Info size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          Lead-form fields are shared across the funnel. Configure them once under the
          {" "}
          <RouterLink to="/tools?tab=funnels" className="text-primary underline">Lead Capture</RouterLink>
          {" "}section. This step will use that form.
        </div>
      </div>
      <div>
        <Label className="text-sm">Submit button label</Label>
        <Input
          value={step.cta_text}
          onChange={(e) => onUpdate("cta_text", e.target.value)}
          placeholder="Submit & Continue"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label className="text-sm">Description (shown above the form)</Label>
        <Textarea
          value={step.description}
          onChange={(e) => onUpdate("description", e.target.value)}
          placeholder="Tell prospects why you need this info…"
          rows={3}
          className="mt-1.5"
        />
      </div>
    </div>
  );

  // BOOKING (WhatsApp deep link)
  const renderBooking = () => {
    const cc = extras.cc ?? "+91";
    const number = extras.number ?? "";
    const message = extras.message ?? "Hi! I just finished {step_title} from your funnel and I'd like to book a call.";
    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm">Instruction to prospect</Label>
          <Textarea value={step.description} onChange={(e) => onUpdate("description", e.target.value)} placeholder="Tap the button below to message me on WhatsApp and book your call." rows={2} className="mt-1.5" />
        </div>
        <div className="grid grid-cols-[90px_1fr] gap-2">
          <div>
            <Label className="text-sm">Code</Label>
            <Input value={cc} onChange={(e) => { setExtras({ cc: e.target.value }); onUpdate("booking_url", buildWaUrl(e.target.value, number, message)); }} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-sm">WhatsApp number</Label>
            <Input value={number} onChange={(e) => { setExtras({ number: e.target.value }); onUpdate("booking_url", buildWaUrl(cc, e.target.value, message)); }} placeholder="9876543210" className="mt-1.5" />
          </div>
        </div>
        <div>
          <Label className="text-sm">Pre-filled message</Label>
          <Textarea value={message} onChange={(e) => { setExtras({ message: e.target.value }); onUpdate("booking_url", buildWaUrl(cc, number, e.target.value)); }} rows={3} className="mt-1.5" />
          <p className="text-xs text-muted-foreground mt-1">Variables: <code>{`{prospect_name}`}</code>, <code>{`{funnel_title}`}</code>, <code>{`{step_title}`}</code></p>
        </div>
        <div>
          <Label className="text-sm">Button label</Label>
          <Input value={step.cta_text} onChange={(e) => onUpdate("cta_text", e.target.value)} placeholder="Book Your Call on WhatsApp" className="mt-1.5" />
        </div>
      </div>
    );
  };

  // CTA / Link
  const renderCta = () => {
    const openNew = extras.open_in_new_tab !== false;
    const urlError = step.cta_url && !/^https?:\/\//i.test(step.cta_url) ? "URL must start with http:// or https://" : "";
    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm">Instruction to prospect</Label>
          <Textarea value={step.description} onChange={(e) => onUpdate("description", e.target.value)} placeholder="Click the button below to continue." rows={2} className="mt-1.5" />
        </div>
        <div>
          <Label className="text-sm">Button label</Label>
          <Input value={step.cta_text} onChange={(e) => onUpdate("cta_text", e.target.value)} placeholder="Click to Continue" className="mt-1.5" />
        </div>
        <div>
          <Label className="text-sm">Redirect URL</Label>
          <Input value={step.cta_url} onChange={(e) => onUpdate("cta_url", e.target.value)} placeholder="https://example.com" className="mt-1.5" />
          {urlError && <p className="text-xs text-destructive mt-1">{urlError}</p>}
        </div>
        <div className="flex items-center justify-between rounded-xl bg-muted/30 border border-border p-3">
          <div>
            <Label className="text-sm font-medium">Open in new tab</Label>
            <p className="text-xs text-muted-foreground">Recommended for external links</p>
          </div>
          <Switch checked={openNew} onCheckedChange={(v) => setExtras({ open_in_new_tab: v })} />
        </div>
      </div>
    );
  };

  // Manual unlock
  const renderManualUnlock = () => {
    const cc = extras.cc ?? "+91";
    const number = extras.number ?? "";
    const message = extras.message ?? "Hi! I'd like to request unlock for {step_title} in your funnel.";
    const notify = extras.notify !== false;
    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm">Instruction to prospect</Label>
          <Textarea value={step.description} onChange={(e) => onUpdate("description", e.target.value)} placeholder="Contact me on WhatsApp to unlock this step." rows={2} className="mt-1.5" />
        </div>
        <div className="grid grid-cols-[90px_1fr] gap-2">
          <div>
            <Label className="text-sm">Code</Label>
            <Input value={cc} onChange={(e) => { setExtras({ cc: e.target.value }); onUpdate("booking_url", buildWaUrl(e.target.value, number, message)); }} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-sm">Your WhatsApp number</Label>
            <Input value={number} onChange={(e) => { setExtras({ number: e.target.value }); onUpdate("booking_url", buildWaUrl(cc, e.target.value, message)); }} placeholder="9876543210" className="mt-1.5" />
          </div>
        </div>
        <div>
          <Label className="text-sm">Pre-filled message</Label>
          <Textarea value={message} onChange={(e) => { setExtras({ message: e.target.value }); onUpdate("booking_url", buildWaUrl(cc, number, e.target.value)); }} rows={3} className="mt-1.5" />
        </div>
        <div>
          <Label className="text-sm">Button label</Label>
          <Input value={step.cta_text} onChange={(e) => onUpdate("cta_text", e.target.value)} placeholder="Contact Mentor on WhatsApp" className="mt-1.5" />
        </div>
        <div className="flex items-center justify-between rounded-xl bg-muted/30 border border-border p-3">
          <div>
            <Label className="text-sm font-medium">Notify me on WhatsApp when prospect requests unlock</Label>
            <p className="text-xs text-muted-foreground">A pending unlock will appear in your Leads view.</p>
          </div>
          <Switch checked={notify} onCheckedChange={(v) => setExtras({ notify: v })} />
        </div>
      </div>
    );
  };

  // Payment — locked / coming soon
  const renderPayment = () => (
    <div className="rounded-2xl border border-border bg-muted/40 p-6 text-center space-y-3">
      <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
        <Lock className="text-amber-500" size={26} />
      </div>
      <div>
        <p className="font-heading text-base font-semibold">Payment step is coming soon</p>
        <p className="text-xs text-muted-foreground mt-1">
          We're building this feature. You'll be able to collect UPI payment proof directly inside a funnel step in the next update.
        </p>
      </div>
      <span className="inline-block text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-500/15 text-amber-600 px-2.5 py-1">Coming Soon</span>
    </div>
  );

  const renderBody = () => {
    switch (step.step_type) {
      case "video": return renderVideo();
      case "lead_form": return renderLeadForm();
      case "booking": return renderBooking();
      case "cta": return renderCta();
      case "manual_approval": return renderManualUnlock();
      case "payment": return renderPayment();
      default: return renderVideo();
    }
  };

  // EXTRA GATES — Waiting period + Access Code (applies to any active step type).
  const [showExtras, setShowExtras] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const renderExtraGates = () => {
    const delayOn = !!step.time_delay_enabled;
    const delayMin = step.time_delay_minutes ?? 0;
    const codeOn = !!step.access_code_enabled;
    const codeRaw = step._access_code_raw ?? step.access_code_plain ?? "";
    const codeMsg = step.access_code_message ?? "To unlock this step, contact your mentor and request the access code for this session.";
    return (
      <div className="rounded-2xl border border-border bg-muted/20 overflow-hidden">
        <Collapsible open={showExtras} onOpenChange={setShowExtras}>
          <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-muted-foreground" />
              <span className="text-sm font-semibold">Extra Gates</span>
            </div>
            <ChevronDown size={15} className={`text-muted-foreground transition-transform ${showExtras ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-4 pt-1 space-y-4">
            {/* Waiting period */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock size={14} className="text-muted-foreground shrink-0" />
                  <Label className="text-sm font-medium">Waiting period after unlock</Label>
                </div>
                <Switch checked={delayOn} onCheckedChange={(v) => { onUpdate("time_delay_enabled", v); if (v && (!delayMin || delayMin < 1)) onUpdate("time_delay_minutes", 60); }} />
              </div>
              {delayOn && (
                <div className="pl-6 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Minutes to wait after previous step completes</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10080}
                    value={delayMin || ""}
                    onChange={(e) => onUpdate("time_delay_minutes", Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="60"
                    className="h-9"
                  />
                  <p className="text-[11px] text-muted-foreground">A countdown timer is shown to the viewer. Auto-unlocks after the wait.</p>
                </div>
              )}
            </div>

            <div className="border-t border-border/60" />

            {/* Access Code Gate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-muted-foreground shrink-0" />
                    <Label className="text-sm font-medium">Access Code Gate</Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground pl-6">Require a code to view this step</p>
                </div>
                <Switch checked={codeOn} onCheckedChange={(v) => onUpdate("access_code_enabled", v)} />
              </div>
              {codeOn && (
                <div className="pl-6 space-y-3 pt-1">
                  <div>
                    <Label className="text-xs text-muted-foreground">Access Code</Label>
                    <div className="relative mt-1">
                      <Input
                        type={showCode ? "text" : "password"}
                        value={codeRaw}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24);
                          onUpdate("_access_code_raw", val);
                          onUpdate("access_code_plain", val);
                        }}
                        placeholder="E.G. MENTOR2024"
                        className="h-9 pr-9 font-mono tracking-wider"
                        maxLength={24}
                      />
                      <button type="button" onClick={() => setShowCode((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showCode ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Hashed securely on save. Save it somewhere safe.</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Message shown to viewer</Label>
                    <Textarea
                      value={codeMsg}
                      onChange={(e) => onUpdate("access_code_message", e.target.value.slice(0, 200))}
                      rows={3}
                      maxLength={200}
                      className="mt-1 text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground text-right">{codeMsg.length}/200</p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border/60" />

            {/* Step active toggle */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Lock size={14} className="text-muted-foreground shrink-0" />
                  <Label className="text-sm font-medium">Step Active</Label>
                </div>
                <p className="text-[11px] text-muted-foreground pl-6">Inactive steps are hidden from viewers</p>
              </div>
              <Switch checked={step.is_active !== false} onCheckedChange={(v) => onUpdate("is_active", v)} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-6">
        <SheetHeader className="space-y-0">
          <SheetTitle className="sr-only">Step {stepIndex + 1} settings</SheetTitle>
          <SheetDescription className="sr-only">Configure this step</SheetDescription>
        </SheetHeader>
        {renderHeader()}
        <div className="mt-4 space-y-5">
          {step.step_type !== "payment" && renderCommon()}
          {renderBody()}
          {step.step_type !== "payment" && renderExtraGates()}
        </div>
        <div className="pt-6 mt-6 border-t border-border">
          <Button onClick={onClose} className="w-full h-11">
            <Check size={16} className="mr-1.5" /> Done
          </Button>
          <p className="text-[11px] text-muted-foreground text-center mt-2">Changes are saved when you click <span className="font-medium">Save</span> at the top of the funnel.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
