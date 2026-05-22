import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Play, Lock, Check, CheckCircle2, Circle, ExternalLink,
  Calendar, CreditCard, ClipboardList, UserCheck, ChevronRight,
  Loader2, MessageCircle, Phone as PhoneIcon, BadgeCheck, Info, Sparkles
} from "lucide-react";

import { CopyNflowLinkButton } from "@/components/CopyNflowLinkButton";
import { sanitizeText } from "@/lib/sanitize";
import { captureAttribution } from "@/lib/tracking";
import {
  normalizePhone,
  trimSmart,
  validatePhone,
  validateEmail,
  validateRequired,
  phoneInputProps,
  emailInputProps,
  nameInputProps,
  cityInputProps,
  scrollToFirstError,
} from "@/lib/leadInputs";
import { PrivacyMicrocopy } from "@/components/funnel/PrivacyMicrocopy";

import { StepCodeGate } from "@/components/funnel/StepCodeGate";

interface FunnelStep {
  id: string;
  step_order: number;
  title: string;
  description: string | null;
  step_type: string;
  video_asset_id: string | null;
  is_active: boolean;
  unlock_rule_type: string;
  unlock_rule_value: string | null;
  cta_text: string | null;
  cta_url: string | null;
  booking_url: string | null;
  video_url?: string | null;
  video_thumbnail?: string | null;
  video_allow_copy_link?: boolean;
  video_allow_seek?: boolean;
  video_allow_playback_speed?: boolean;
  access_code_enabled?: boolean;
  access_code_plain?: string | null;
  access_code_message?: string | null;
  speaker_mode_step?: string;
  speaker_name_custom?: string | null;
  speaker_title?: string | null;
  speaker_bio?: string | null;
  speaker_photo_url_custom?: string | null;
  time_delay_enabled?: boolean;
  time_delay_minutes?: number;
  timer_cta_enabled?: boolean;
  timer_cta_text?: string | null;
  timer_cta_url?: string | null;
  timer_cta_style?: string | null;
  video_topics_step_enabled?: boolean;
  video_topics_step?: string[] | null;
}

interface StepProgress {
  funnel_step_id: string;
  status: string;
  max_watched_seconds: number;
  watched_percentage: number;
  last_position_seconds: number;
  completed_at: string | null;
  manually_unlocked?: boolean;
  time_spent_seconds?: number;
  permanently_unlocked?: boolean;
  condition_met_at?: string | null;
}

interface MultiStepViewerProps {
  funnel: any;
  steps: FunnelStep[];
  creatorProfile: any;
  formConfig: any;
  priceOptions: any[];
  VideoPlayer: React.ComponentType<any>;
  isDark?: boolean;
}

const STEP_ICONS: Record<string, React.ComponentType<any>> = {
  video: Play, lead_form: ClipboardList, cta: ExternalLink,
  payment: CreditCard, manual_approval: UserCheck, booking: Calendar,
};

const STEP_TYPE_LABELS: Record<string, string> = {
  video: "Video", lead_form: "Lead Form", cta: "CTA / Link",
  payment: "Payment", manual_approval: "Manual Approval", booking: "Booking",
};

const UNLOCK_HINTS: Record<string, (value?: string | null) => string> = {
  auto: () => "This step is available now.",
  watch_complete: () => "Watch the previous video fully to unlock this step.",
  watch_seconds: (v) => `Watch at least ${v || "?"} seconds of the previous video to continue.`,
  watch_percent: (v) => `Watch at least ${v || "?"}% of the previous video to continue.`,
  cta_click: () => "Click the button in the previous step to unlock this one.",
  lead_submitted: () => "Submit your details in the previous step to continue.",
  payment_submitted: () => "Complete payment in the previous step to unlock this.",
  manual: () => "The creator will unlock this step for you after review.",
  booking_done: () => "Complete the booking in the previous step to continue.",
};

const getSessionId = (funnelId: string): string => {
  const key = `nf_session_${funnelId}`;
  let sid = localStorage.getItem(key);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(key, sid);
  }
  return sid;
};

export const MultiStepViewer = ({
  funnel, steps, creatorProfile, formConfig, priceOptions, VideoPlayer, isDark = true,
}: MultiStepViewerProps) => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [progressMap, setProgressMap] = useState<Record<string, StepProgress>>({});
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", phone: "", email: "", city: "", custom_value: "", website: "" });
  const [leadErrors, setLeadErrors] = useState<Record<string, string | null>>({});
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const leadRefs = useRef<Record<string, HTMLElement | null>>({});
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [paymentProof, setPaymentProof] = useState({ upi_transaction_id: "", amount: 0 });
  const [loading, setLoading] = useState(true);
  const sessionId = useRef(getSessionId(funnel.id));
  const progressSaveTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [stepCodeUnlocked, setStepCodeUnlocked] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    try {
      const sid = sessionId.current;
      for (const s of steps) {
        if (s.access_code_enabled && localStorage.getItem(`nf_step_code_${s.id}_${sid}`) === "true") {
          map[s.id] = true;
        }
      }
    } catch {}
    return map;
  });

  const [, setTick] = useState(0);
  useEffect(() => {
    const hasDelay = steps.some((s) => s.time_delay_enabled && (s.time_delay_minutes || 0) > 0);
    if (!hasDelay) return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [steps]);

  useEffect(() => {
    const loadProgress = async () => {
      const { data } = await supabase.rpc("get_session_step_progress", {
        _funnel_id: funnel.id,
        _session_id: sessionId.current,
      });

      const map: Record<string, StepProgress> = {};
      if (data) for (const p of data as any[]) map[p.funnel_step_id] = p;

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (!map[step.id]) {
          const status = i === 0 ? "unlocked" : "locked";
          map[step.id] = {
            funnel_step_id: step.id, status,
            max_watched_seconds: 0, watched_percentage: 0,
            last_position_seconds: 0, completed_at: null,
          };
          await supabase.from("funnel_step_progress").insert({
            funnel_id: funnel.id, funnel_step_id: step.id,
            session_id: sessionId.current, status,
          });
        }
      }

      setProgressMap(map);

      let furthest = 0;
      for (let i = 0; i < steps.length; i++) {
        const p = map[steps[i].id];
        if (p && (p.status === "unlocked" || p.status === "in_progress" || p.status === "completed")) furthest = i;
      }
      for (let i = 0; i <= furthest; i++) {
        const p = map[steps[i].id];
        if (p && p.status !== "completed") { setActiveStepIndex(i); break; }
        if (i === furthest) setActiveStepIndex(furthest);
      }

      setLoading(false);
    };
    if (steps.length > 0) loadProgress();
    else setLoading(false);
  }, [funnel.id, steps]);

  const getStepStatus = (stepId: string): string => progressMap[stepId]?.status || "locked";

  const updateStepProgress = useCallback(async (stepId: string, updates: Partial<StepProgress>) => {
    setProgressMap((prev) => ({ ...prev, [stepId]: { ...prev[stepId], ...updates } }));
    await supabase.from("funnel_step_progress").update(updates as any)
      .eq("funnel_id", funnel.id).eq("funnel_step_id", stepId).eq("session_id", sessionId.current);
  }, [funnel.id]);

  const completeStep = useCallback(async (stepIndex: number) => {
    const step = steps[stepIndex];
    const nowIso = new Date().toISOString();
    await updateStepProgress(step.id, {
      status: "completed", completed_at: nowIso,
      permanently_unlocked: true, condition_met_at: nowIso,
    });

    if (stepIndex + 1 < steps.length) {
      const nextStep = steps[stepIndex + 1];
      const rule = nextStep.unlock_rule_type;
      let shouldUnlock = false;
      if (rule === "auto" || rule === "watch_complete" || rule === "cta_click" || rule === "lead_submitted" || rule === "payment_submitted" || rule === "booking_done") shouldUnlock = true;
      if (rule === "manual") shouldUnlock = false;
      if (rule === "watch_seconds") {
        const prev = progressMap[step.id];
        shouldUnlock = !!(prev && prev.max_watched_seconds >= parseInt(nextStep.unlock_rule_value || "0"));
      }
      if (rule === "watch_percent") {
        const prev = progressMap[step.id];
        shouldUnlock = !!(prev && prev.watched_percentage >= parseInt(nextStep.unlock_rule_value || "0"));
      }
      if (shouldUnlock && progressMap[nextStep.id]?.status === "locked") {
        await updateStepProgress(nextStep.id, {
          status: "unlocked", permanently_unlocked: true, condition_met_at: nowIso,
        });
      }
    }
  }, [steps, progressMap, updateStepProgress]);

  const handleVideoTimeUpdate = useCallback((stepIndex: number, currentTime: number, duration: number) => {
    const step = steps[stepIndex];
    const progress = progressMap[step.id];
    if (!progress) return;
    const maxWatched = Math.max(progress.max_watched_seconds, Math.floor(currentTime));
    const pct = duration > 0 ? Math.floor((maxWatched / duration) * 100) : 0;
    setProgressMap((prev) => ({
      ...prev,
      [step.id]: {
        ...prev[step.id],
        status: prev[step.id]?.status === "unlocked" ? "in_progress" : prev[step.id]?.status || "in_progress",
        max_watched_seconds: maxWatched, watched_percentage: pct,
        last_position_seconds: Math.floor(currentTime),
      },
    }));
    if (pct >= 95 && progress.status !== "completed") completeStep(stepIndex);

    if (stepIndex + 1 < steps.length) {
      const nextStep = steps[stepIndex + 1];
      if (getStepStatus(nextStep.id) === "locked") {
        const rule = nextStep.unlock_rule_type;
        let shouldUnlock = false;
        if (rule === "watch_seconds" && maxWatched >= parseInt(nextStep.unlock_rule_value || "0")) shouldUnlock = true;
        if (rule === "watch_percent" && pct >= parseInt(nextStep.unlock_rule_value || "0")) shouldUnlock = true;
        if (shouldUnlock) updateStepProgress(nextStep.id, {
          status: "unlocked", permanently_unlocked: true, condition_met_at: new Date().toISOString(),
        });
      }
    }
  }, [steps, progressMap, completeStep, updateStepProgress]);

  useEffect(() => {
    progressSaveTimer.current = setInterval(() => {
      const activeStep = steps[activeStepIndex];
      if (!activeStep) return;
      const p = progressMap[activeStep.id];
      if (!p || p.status === "locked") return;
      const newTimeSpent = (p.time_spent_seconds || 0) + 5;
      setProgressMap((prev) => ({
        ...prev,
        [activeStep.id]: { ...prev[activeStep.id], time_spent_seconds: newTimeSpent },
      }));
      supabase.from("funnel_step_progress").update({
        max_watched_seconds: p.max_watched_seconds,
        watched_percentage: p.watched_percentage,
        last_position_seconds: p.last_position_seconds,
        status: p.status, time_spent_seconds: newTimeSpent,
      } as any)
        .eq("funnel_id", funnel.id).eq("funnel_step_id", activeStep.id)
        .eq("session_id", sessionId.current).then(() => {});
    }, 5000);
    return () => { if (progressSaveTimer.current) clearInterval(progressSaveTimer.current); };
  }, [activeStepIndex, progressMap, steps, funnel.id]);

  // Realtime: re-fetch progress when creator manually unlocks a step for this session.
  useEffect(() => {
    const channel = supabase
      .channel(`funnel-progress-${funnel.id}-${sessionId.current}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "funnel_step_progress",
          filter: `session_id=eq.${sessionId.current}`,
        },
        (payload: any) => {
          const row = payload.new;
          if (!row || row.funnel_id !== funnel.id) return;
          setProgressMap((prev) => ({
            ...prev,
            [row.funnel_step_id]: { ...prev[row.funnel_step_id], ...row },
          }));
          if (row.manually_unlocked && row.status !== "locked") {
            toast.success("A step was unlocked for you!");
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [funnel.id]);

  // Substitute {prospect_name} / {funnel_title} / {step_title} in a wa.me URL's text= param.
  const interpolateWaUrl = (url: string | null | undefined, step: FunnelStep): string => {
    if (!url) return "";
    try {
      const u = new URL(url);
      const text = u.searchParams.get("text");
      if (text) {
        const replaced = text
          .replace(/\{prospect_name\}/g, leadForm.name?.trim() || "there")
          .replace(/\{funnel_title\}/g, funnel.title || "")
          .replace(/\{step_title\}/g, step.title || "");
        u.searchParams.set("text", replaced);
      }
      return u.toString();
    } catch {
      return url;
    }
  };

  const handleCtaClick = async (stepIndex: number) => {
    const step = steps[stepIndex];
    const target = step.cta_url || (step.booking_url ? interpolateWaUrl(step.booking_url, step) : "");
    if (target) window.open(target, "_blank", "noopener,noreferrer");
    await completeStep(stepIndex);
    toast.success("Step completed!");
  };

  // Manual approval: open WhatsApp to request unlock (does NOT auto-complete; creator unlocks).
  const handleManualUnlockRequest = (step: FunnelStep) => {
    const target = step.booking_url ? interpolateWaUrl(step.booking_url, step) : "";
    if (target) window.open(target, "_blank", "noopener,noreferrer");
    toast.success("Opening WhatsApp — the creator will unlock this step shortly.");
  };

  const validateLead = (): Record<string, string | null> => {
    const e: Record<string, string | null> = {};
    if (formConfig?.show_name && (formConfig.name_required || leadForm.name)) e.name = formConfig.name_required ? validateRequired(leadForm.name, "Name") : null;
    if (formConfig?.show_phone && (formConfig.phone_required || leadForm.phone)) e.phone = validatePhone(leadForm.phone);
    if (formConfig?.show_email && (formConfig.email_required || leadForm.email)) e.email = validateEmail(leadForm.email);
    if (formConfig?.show_city && formConfig.city_required) e.city = validateRequired(leadForm.city, "City");
    return e;
  };

  const setLeadField = (k: keyof typeof leadForm, v: string) => {
    setLeadForm((p) => ({ ...p, [k]: v }));
    if (leadErrors[k]) setLeadErrors((p) => ({ ...p, [k]: null }));
  };

  const handleLeadSubmit = async (stepIndex: number) => {
    if (leadForm.website) return;
    if (leadSubmitting) return;
    const fe = validateLead();
    setLeadErrors(fe);
    if (Object.values(fe).some(Boolean)) {
      scrollToFirstError(fe, leadRefs.current, ["name", "phone", "email", "city"]);
      return;
    }
    setLeadSubmitting(true);
    const s = (v: string | null | undefined) => (v ? sanitizeText(v) : null);
    try {
      await (supabase.from("funnel_leads") as any).insert({
        funnel_id: funnel.id,
        name: s(trimSmart(leadForm.name)),
        phone: leadForm.phone ? normalizePhone(leadForm.phone) : null,
        email: s(leadForm.email?.trim()),
        city: s(trimSmart(leadForm.city)),
        custom_value: s(leadForm.custom_value),
        device_type: /Mobi/.test(navigator.userAgent) ? "mobile" : "desktop",
        user_agent: navigator.userAgent,
        ...captureAttribution("funnel", funnel.id, (funnel as any).slug),
      });
      // Lead alert (to creator) + confirmation (to prospect) via Resend.
      import("@/lib/email").then(({ sendLeadEmails }) =>
        sendLeadEmails({
          funnelId: funnel.id,
          prospect: {
            name: trimSmart(leadForm.name),
            email: leadForm.email?.trim() || null,
            phone: leadForm.phone ? normalizePhone(leadForm.phone) : null,
          },
        }),
      );
      setLeadSubmitted(true);
      await completeStep(stepIndex);
      toast.success("Details submitted!");
    } catch (err: any) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLeadSubmitting(false);
    }
  };

  const handlePaymentSubmit = async (stepIndex: number) => {
    await supabase.from("funnel_payments").insert({
      funnel_id: funnel.id,
      amount: paymentProof.amount || priceOptions[0]?.amount || 0,
      upi_transaction_id: paymentProof.upi_transaction_id || null,
      payment_type: "upi_manual",
    });
    setPaymentSubmitted(true);
    await completeStep(stepIndex);
    toast.success("Payment submitted!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="text-primary animate-spin" />
      </div>
    );
  }

  const activeStep = steps[activeStepIndex];
  const activeProgress = activeStep ? progressMap[activeStep.id] : null;
  const completedCount = steps.filter((s) => getStepStatus(s.id) === "completed").length;
  const progressPct = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  const getUnlockHint = (step: FunnelStep, idx: number): string | null => {
    if (idx === 0) return null;
    const status = getStepStatus(step.id);
    if (status === "completed") return null;
    if (status === "locked") {
      if (step.time_delay_enabled && step.time_delay_minutes && idx > 0) {
        const prevStep = steps[idx - 1];
        const prevProgress = progressMap[prevStep.id];
        if (prevProgress?.completed_at) {
          const delayMs = step.time_delay_minutes * 60 * 1000;
          const elapsed = Date.now() - new Date(prevProgress.completed_at).getTime();
          const remainingMs = delayMs - elapsed;
          if (remainingMs > 0) return `Unlocks in ${Math.ceil(remainingMs / 60000)}m`;
        } else {
          return `Wait ${step.time_delay_minutes}m after previous step`;
        }
      }
      const hintFn = UNLOCK_HINTS[step.unlock_rule_type];
      return hintFn ? hintFn(step.unlock_rule_value) : null;
    }
    return null;
  };

  const nextStepUnlocked = !!(activeStep && activeProgress?.status === "completed" &&
    activeStepIndex + 1 < steps.length &&
    getStepStatus(steps[activeStepIndex + 1].id) !== "locked");

  const sc = {
    bg: isDark ? "#0f1117" : "#f8f9fa",
    border: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
    text: isDark ? "#ffffff" : "#0f172a",
    textMuted: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.5)",
    textDim: isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.4)",
    textDimmer: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.3)",
    textLocked: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.25)",
    iconDim: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.4)",
    iconLocked: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.2)",
    progressBg: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
    progressText: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.45)",
    itemBg: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.02)",
    itemIconBg: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
    cardBg: isDark ? "#1a1a22" : "#ffffff",
    cardBorder: isDark ? "#3f3f46" : "#e5e7eb",
    inputBg: isDark ? "#18181b" : "#f1f5f9",
    stepBarBg: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)",
    stepBarBorder: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
    stepBarActive: isDark ? "rgba(249,115,22,0.2)" : "rgba(249,115,22,0.1)",
    stepBarInactive: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.6)",
  };

  const hasContact = funnel.show_contact_buttons && (funnel.contact_whatsapp || funnel.contact_phone);

  const JourneySidebar = () => (
    <div className="hidden lg:flex flex-col w-[280px] min-w-[280px] shrink-0 h-screen sticky top-0 border-r"
      style={{ background: sc.bg, borderColor: sc.border }}>
      <div className="flex-1 overflow-y-auto" style={{ padding: "20px 14px" }}>
        {creatorProfile?.full_name && (
          <div className="flex items-center gap-3 pb-4 mb-4" style={{ borderBottom: `1px solid ${sc.border}` }}>
            <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ border: "2px solid rgba(249,115,22,0.35)", boxShadow: "0 0 0 3px rgba(249,115,22,0.08)" }}>
              {creatorProfile.avatar_url ? (
                <img src={creatorProfile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(249,115,22,0.12)" }}>
                  <span className="text-primary font-bold text-sm">{creatorProfile.full_name.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[13px] truncate" style={{ color: sc.text }}>{creatorProfile.full_name}</p>
              {creatorProfile.kyc_status === "approved" && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-[#F97316]">
                  <BadgeCheck size={10} /> Verified
                </span>
              )}
            </div>
          </div>
        )}
        <div className="pb-4 mb-4" style={{ borderBottom: `1px solid ${sc.border}` }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5" style={{ color: sc.textDim }}>Journey Progress</p>
          <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: sc.progressBg }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #FB923C, #F97316)" }} />
          </div>
          <p className="text-[12px] font-semibold" style={{ color: sc.progressText }}>{completedCount} / {steps.length} completed</p>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-3 px-1" style={{ color: sc.textDimmer }}>Journey</p>
        <div className="space-y-1.5">
          {steps.map((step, idx) => {
            const status = getStepStatus(step.id);
            const Icon = STEP_ICONS[step.step_type] || Circle;
            const isActive = idx === activeStepIndex;
            const isLocked = status === "locked";
            const isCompleted = status === "completed";
            const isInProgress = status === "in_progress";
            return (
              <button key={step.id} onClick={() => !isLocked && setActiveStepIndex(idx)} disabled={isLocked}
                className="w-full flex items-start gap-3 text-left transition-all"
                style={{
                  padding: "10px 12px", borderRadius: "12px",
                  border: isCompleted ? "1px solid rgba(249,115,22,0.25)" : isActive ? "1px solid rgba(249,115,22,0.3)" : "1px solid transparent",
                  borderLeft: isCompleted || isActive ? "3px solid #F97316" : "3px solid transparent",
                  background: isCompleted ? "rgba(249,115,22,0.1)" : isActive ? "rgba(249,115,22,0.08)" : isLocked ? "transparent" : sc.itemBg,
                  cursor: isLocked ? "not-allowed" : "pointer", opacity: isLocked ? 0.55 : 1,
                }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: isCompleted ? "rgba(249,115,22,0.2)" : isActive ? "rgba(249,115,22,0.15)" : sc.itemIconBg }}>
                  {isCompleted ? <Check size={13} className="text-[#F97316]" /> :
                   isLocked ? <Lock size={11} style={{ color: sc.iconLocked }} /> :
                   <Icon size={13} className={isActive ? "text-[#F97316]" : ""} style={!isActive ? { color: sc.iconDim } : {}} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight truncate" style={{ fontSize: "13px", color: isLocked ? sc.textLocked : sc.text }}>
                    {step.title || `Step ${idx + 1}`}
                  </p>
                  <p style={{ fontSize: "11px", color: sc.textMuted, marginTop: "2px" }}>
                    {STEP_TYPE_LABELS[step.step_type] || step.step_type} · {isCompleted ? "Completed" : isInProgress ? "In Progress" : isActive ? "Available" : isLocked ? "Locked" : "Available"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {hasContact && (
        <div className="shrink-0 px-3 py-3" style={{ borderTop: `1px solid ${sc.border}`, background: sc.bg }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5 px-1" style={{ color: sc.textDim }}>Contact Creator</p>
          <div className="space-y-2">
            {funnel.contact_whatsapp && (
              <button onClick={() => window.open(`https://wa.me/${funnel.contact_whatsapp?.replace(/\D/g, "")}`)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:opacity-90"
                style={{ background: "rgba(37,211,102,0.15)", color: "#25d366", border: "1px solid rgba(37,211,102,0.2)" }}>
                <MessageCircle size={15} /> WhatsApp
              </button>
            )}
            {funnel.contact_phone && (
              <button onClick={() => window.open(`tel:${funnel.contact_phone}`)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:opacity-90"
                style={{ background: sc.itemIconBg, color: sc.text, border: `1px solid ${sc.border}` }}>
                <PhoneIcon size={15} /> Call
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-[calc(100vh-52px)]">
      <JourneySidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <div className="lg:hidden text-center py-4 px-4" style={{ borderBottom: `1px solid ${sc.border}` }}>
          <h1 className="font-heading font-extrabold tracking-tight leading-tight" style={{ fontSize: "clamp(18px, 5vw, 28px)", letterSpacing: "-0.02em", color: sc.text }}>
            {funnel.title}
          </h1>
        </div>
        <div className="lg:hidden flex gap-2 overflow-x-auto py-3 px-4" style={{ background: sc.stepBarBg, borderBottom: `1px solid ${sc.border}` }}>
          {steps.map((step, idx) => {
            const status = getStepStatus(step.id);
            const isActive = idx === activeStepIndex;
            const isLocked = status === "locked";
            const isCompleted = status === "completed";
            return (
              <button key={step.id} onClick={() => !isLocked && setActiveStepIndex(idx)} disabled={isLocked}
                className="flex items-center gap-1.5 shrink-0 transition-all"
                style={{
                  padding: "6px 14px", borderRadius: "100px", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap",
                  border: isActive ? "1px solid rgba(249,115,22,0.4)" : isCompleted ? "1px solid rgba(249,115,22,0.25)" : `1px solid ${sc.stepBarBorder}`,
                  background: isActive ? sc.stepBarActive : isCompleted ? "rgba(249,115,22,0.08)" : sc.stepBarBg,
                  color: isActive ? "#F97316" : isCompleted ? "#FB923C" : isLocked ? sc.textLocked : sc.stepBarInactive,
                  cursor: isLocked ? "not-allowed" : "pointer", opacity: isLocked ? 0.5 : 1,
                }}>
                {isCompleted ? <Check size={12} /> : isLocked ? <Lock size={10} /> : <Circle size={10} />}
                {step.title || `Step ${idx + 1}`}
              </button>
            );
          })}
        </div>

        <div className="flex-1 px-4 lg:px-8 py-6 lg:py-8 max-w-[860px] mx-auto w-full">
          <h1 className="hidden lg:block font-heading font-extrabold tracking-tight leading-tight mb-6" style={{ fontSize: "clamp(22px, 3vw, 34px)", letterSpacing: "-0.02em", color: sc.text }}>
            {funnel.title}
          </h1>
          {activeStep && (
            <div className="space-y-5">
              <div style={{ paddingBottom: "12px", borderBottom: `1px solid ${sc.border}`, marginBottom: "16px" }}>
                <div className="flex items-center gap-3 mb-1">
                  <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: sc.textMuted }}>
                    Step {activeStepIndex + 1} of {steps.length}
                  </span>
                  {activeProgress?.status === "completed" && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-[#F97316]">
                      <Check size={10} /> Completed
                    </span>
                  )}
                </div>
                <h2 className="font-heading font-bold" style={{ fontSize: "20px", color: sc.text }}>
                  {activeStep.title || `Step ${activeStepIndex + 1}`}
                </h2>
                {activeStep.description && (
                  <p className="mt-1" style={{ fontSize: "14px", color: sc.textMuted }}>{activeStep.description}</p>
                )}
              </div>

              {getStepStatus(activeStep.id) === "locked" && (
                <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.2)" }}>
                  <Lock size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-300">Step Locked</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(251,191,36,0.7)" }}>{getUnlockHint(activeStep, activeStepIndex)}</p>
                  </div>
                </div>
              )}

              {activeStep.access_code_enabled && !stepCodeUnlocked[activeStep.id] ? (
                <StepCodeGate
                  funnelId={funnel.id} stepId={activeStep.id}
                  stepTitle={activeStep.title}
                  message={activeStep.access_code_message ?? undefined}
                  sessionId={sessionId.current}
                  isDark={isDark}
                  onSuccess={() => setStepCodeUnlocked((prev) => ({ ...prev, [activeStep.id]: true }))}
                />
              ) : (
                <>
                  {activeStep.step_type === "video" && activeStep.video_url && (
                    <div className="space-y-3">
                      <VideoPlayer
                        src={activeStep.video_url}
                        poster={activeStep.video_thumbnail || undefined}
                        allowSeek={funnel.allow_seek !== false && activeStep.video_allow_seek !== false}
                        allowSpeed={funnel.allow_speed_change !== false && activeStep.video_allow_playback_speed !== false}
                        autoplay={true}
                        initialTime={activeProgress?.last_position_seconds || 0}
                        onTimeUpdate={(ct: number, dur: number) => handleVideoTimeUpdate(activeStepIndex, ct, dur)}
                      />
                      {activeStep.video_asset_id && activeStep.video_allow_copy_link !== false && (
                        <div className="flex justify-end">
                          <CopyNflowLinkButton videoId={activeStep.video_asset_id} />
                        </div>
                      )}
                    </div>
                  )}

                  {activeStep.step_type === "video" && !activeStep.video_url && (
                    <div className="aspect-video rounded-2xl flex items-center justify-center" style={{ background: sc.cardBg, border: `1px solid ${sc.border}` }}>
                      <div className="text-center">
                        <Play size={40} style={{ color: sc.textDimmer }} className="mx-auto mb-2" />
                        <p style={{ fontSize: "12px", color: sc.textDimmer }}>Video not available</p>
                      </div>
                    </div>
                  )}

                  {activeStep.step_type === "lead_form" && (
                    <div className="rounded-2xl p-6" style={{ background: sc.cardBg, border: `1px solid ${sc.cardBorder}` }}>
                      {leadSubmitted || activeProgress?.status === "completed" ? (
                        <div className="text-center py-6">
                          <CheckCircle2 size={40} className="text-[#F97316] mx-auto mb-3" />
                          <h3 className="font-heading font-bold" style={{ color: sc.text }}>Details Submitted</h3>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-lg font-heading font-bold mb-4" style={{ color: sc.text }}>Fill in your details</h3>
                          <form onSubmit={(e) => { e.preventDefault(); handleLeadSubmit(activeStepIndex); }} className="space-y-3" noValidate>
                            <input type="text" name="website" value={leadForm.website} onChange={(e) => setLeadForm({ ...leadForm, website: e.target.value })} style={{ position: "absolute", left: "-9999px" }} tabIndex={-1} autoComplete="off" />
                            {formConfig?.show_name && (
                              <div>
                                <Input ref={(el) => { leadRefs.current.name = el; }} {...nameInputProps} placeholder="Full Name" value={leadForm.name} onChange={(e) => setLeadField("name", e.target.value)} onBlur={(e) => setLeadField("name", trimSmart(e.target.value))} aria-invalid={!!leadErrors.name} style={{ background: sc.inputBg, borderColor: leadErrors.name ? "#ef4444" : sc.cardBorder, color: sc.text }} className="h-12 rounded-xl" />
                                {leadErrors.name && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{leadErrors.name}</p>}
                              </div>
                            )}
                            {formConfig?.show_phone && (
                              <div>
                                <div className="flex gap-2">
                                  <div className="flex items-center px-3 rounded-xl text-sm shrink-0 h-12" style={{ background: sc.inputBg, border: `1px solid ${sc.cardBorder}`, color: sc.textMuted }}>+91</div>
                                  <Input ref={(el) => { leadRefs.current.phone = el; }} {...phoneInputProps} placeholder="9876543210" value={leadForm.phone} onChange={(e) => setLeadField("phone", normalizePhone(e.target.value))} aria-invalid={!!leadErrors.phone} style={{ background: sc.inputBg, borderColor: leadErrors.phone ? "#ef4444" : sc.cardBorder, color: sc.text }} className="h-12 rounded-xl" />
                                </div>
                                {leadErrors.phone && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{leadErrors.phone}</p>}
                              </div>
                            )}
                            {formConfig?.show_email && (
                              <div>
                                <Input ref={(el) => { leadRefs.current.email = el; }} {...emailInputProps} placeholder="Email" value={leadForm.email} onChange={(e) => setLeadField("email", e.target.value)} onBlur={(e) => setLeadField("email", e.target.value.trim())} aria-invalid={!!leadErrors.email} style={{ background: sc.inputBg, borderColor: leadErrors.email ? "#ef4444" : sc.cardBorder, color: sc.text }} className="h-12 rounded-xl" />
                                {leadErrors.email && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{leadErrors.email}</p>}
                              </div>
                            )}
                            {formConfig?.show_city && (
                              <div>
                                <Input ref={(el) => { leadRefs.current.city = el; }} {...cityInputProps} placeholder="City" value={leadForm.city} onChange={(e) => setLeadField("city", e.target.value)} onBlur={(e) => setLeadField("city", trimSmart(e.target.value))} aria-invalid={!!leadErrors.city} style={{ background: sc.inputBg, borderColor: leadErrors.city ? "#ef4444" : sc.cardBorder, color: sc.text }} className="h-12 rounded-xl" />
                                {leadErrors.city && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{leadErrors.city}</p>}
                              </div>
                            )}
                            <Button type="submit" disabled={leadSubmitting} className="w-full h-14 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
                              {leadSubmitting ? <><Loader2 size={16} className="animate-spin mr-2 inline" /> Submitting…</> : <>Submit →</>}
                            </Button>
                            <PrivacyMicrocopy color={sc.textMuted} />
                          </form>
                        </>
                      )}
                    </div>
                  )}

                  {(activeStep.step_type === "cta" || activeStep.step_type === "booking") && (
                    <div className="rounded-2xl p-6 text-center" style={{ background: sc.cardBg, border: `1px solid ${sc.cardBorder}` }}>
                      {activeProgress?.status === "completed" ? (
                        <>
                          <CheckCircle2 size={40} className="text-[#F97316] mx-auto mb-3" />
                          <h3 className="font-heading font-bold" style={{ color: sc.text }}>Step Completed</h3>
                        </>
                      ) : (
                        <>
                          <h3 className="text-lg font-heading font-bold mb-2" style={{ color: sc.text }}>{activeStep.cta_text || (activeStep.step_type === "booking" ? "Book Your Call" : "Continue")}</h3>
                          {activeStep.description && <p style={{ fontSize: "14px", color: sc.textMuted }} className="mb-4">{activeStep.description}</p>}
                          <Button className="h-14 px-8 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg shadow-primary/20"
                            onClick={() => handleCtaClick(activeStepIndex)}>
                            {activeStep.cta_text || (activeStep.step_type === "booking" ? "Book Now" : "Continue")} →
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {activeStep.step_type === "payment" && (
                    <div className="rounded-2xl p-6" style={{ background: sc.cardBg, border: `1px solid ${sc.cardBorder}` }}>
                      {paymentSubmitted || activeProgress?.status === "completed" ? (
                        <div className="text-center py-6">
                          <CheckCircle2 size={40} className="text-[#F97316] mx-auto mb-3" />
                          <h3 className="font-heading font-bold" style={{ color: sc.text }}>Payment Submitted</h3>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-lg font-heading font-semibold mb-4" style={{ color: sc.text }}>Complete Payment</h3>
                          {priceOptions.length > 0 && (
                            <div className="space-y-2 mb-4">
                              {priceOptions.map((opt: any) => (
                                <button key={opt.id} onClick={() => setPaymentProof({ ...paymentProof, amount: opt.amount })}
                                  className={`w-full p-3 rounded-xl border text-left transition-all ${paymentProof.amount === opt.amount ? "border-primary bg-primary/10" : ""}`}
                                  style={paymentProof.amount !== opt.amount ? { borderColor: sc.cardBorder, background: sc.inputBg } : {}}>
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium" style={{ color: sc.text }}>{opt.label}</span>
                                    <span className="font-heading font-bold" style={{ color: sc.text }}>₹{opt.amount.toLocaleString("en-IN")}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                          {funnel.upi_id && (
                            <div className="p-3 rounded-xl mb-4" style={{ background: sc.inputBg }}>
                              <span className="text-xs" style={{ color: sc.textMuted }}>Pay via UPI</span>
                              <div className="flex items-center gap-2 mt-1">
                                <code className="text-sm text-primary flex-1">{funnel.upi_id}</code>
                                <Button variant="ghost" size="sm" style={{ color: sc.textMuted }} onClick={() => { navigator.clipboard.writeText(funnel.upi_id!); toast.success("UPI ID copied!"); }}>Copy</Button>
                              </div>
                            </div>
                          )}
                          <div className="space-y-3">
                            <Input placeholder="UPI Transaction ID" value={paymentProof.upi_transaction_id} onChange={(e) => setPaymentProof({ ...paymentProof, upi_transaction_id: e.target.value })} style={{ background: sc.inputBg, borderColor: sc.cardBorder, color: sc.text }} className="h-12 rounded-xl" />
                            <Button className="w-full h-14 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl" onClick={() => handlePaymentSubmit(activeStepIndex)}>
                              I've Made the Payment
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {activeStep.step_type === "manual_approval" && (
                    <div className="rounded-2xl p-8 text-center" style={{ background: sc.cardBg, border: `1px solid ${sc.cardBorder}` }}>
                      {activeProgress?.status === "completed" || activeProgress?.manually_unlocked || activeProgress?.status === "unlocked" ? (
                        <>
                          <CheckCircle2 size={40} className="text-[#F97316] mx-auto mb-3" />
                          <h3 className="font-heading font-bold" style={{ color: sc.text }}>Step Unlocked</h3>
                          <p style={{ fontSize: "14px", color: sc.textMuted }} className="mt-2">You can now continue to the next step.</p>
                        </>
                      ) : (
                        <>
                          <Lock size={40} style={{ color: sc.textDimmer }} className="mx-auto mb-3" />
                          <h3 className="font-heading font-bold" style={{ color: sc.text }}>Awaiting Approval</h3>
                          <p style={{ fontSize: "14px", color: sc.textMuted }} className="mt-2">{activeStep.description || "The creator will unlock this step for you after review."}</p>
                          {activeStep.booking_url && (
                            <Button
                              className="mt-5 h-12 px-6 text-sm font-bold rounded-xl"
                              style={{ background: "#25d366", color: "#fff" }}
                              onClick={() => handleManualUnlockRequest(activeStep)}
                            >
                              <MessageCircle size={16} className="mr-2" />
                              {activeStep.cta_text || "Request Unlock on WhatsApp"}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {nextStepUnlocked && (
                    <button onClick={() => setActiveStepIndex(activeStepIndex + 1)}
                      className="w-full flex items-center justify-between transition-all"
                      style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: "12px", padding: "14px 18px", marginTop: "16px" }}>
                      <span className="flex items-center gap-2 text-sm font-semibold text-[#F97316]">
                        <Sparkles size={16} /> Next step unlocked!
                      </span>
                      <span className="flex items-center gap-1 text-sm font-medium text-[#F97316]">
                        Continue to Step {activeStepIndex + 2} <ChevronRight size={16} />
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
