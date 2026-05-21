import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useVideoGate } from "@/hooks/useVideoGate";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Video, Settings, ClipboardList, Mic, MessageCircle, IndianRupee,
  Radio, Rocket, Check, Copy, Plus, Trash2, GripVertical, Lock, ExternalLink,
  Play, CreditCard, UserCheck, Calendar, Layers, ChevronDown, ChevronUp, Pencil,
  User, ListChecks, X, MoreVertical
} from "lucide-react";
import { VideoPickerModal } from "@/components/VideoPickerModal";
import { StepTypeSelector, getStepTypeMeta } from "@/components/funnel/StepTypeSelector";
import { StepConfigPanel, type FlowStep as PanelFlowStep } from "@/components/funnel/StepConfigPanel";
import { PrivacySettings } from "@/components/funnel/PrivacySettings";
import { FunnelLivePreview } from "@/components/funnel/FunnelLivePreview";
import { CustomFieldsBuilder, type CustomField } from "@/components/funnel/CustomFieldsBuilder";
import { SpeakerPhotoUpload } from "@/components/funnel/SpeakerPhotoUpload";
import { PerStepSpeakerAssignment } from "@/components/funnel/PerStepSpeakerAssignment";
import { usePlan } from "@/hooks/usePlan";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { StepLockOverlay } from "@/components/funnel/StepLockOverlay";
import { Crown } from "lucide-react";
import { sanitizeText } from "@/lib/sanitize";
import { generateUniqueSuffixedSlug } from "@/lib/slugSuffix";
import { EditorScrollLayout, EditorSectionBlock, type EditorSection } from "@/components/editor/EditorScrollLayout";
import { AudioNoteRecorder } from "@/components/funnel/AudioNoteRecorder";

type FlowStep = PanelFlowStep;

const createEmptyStep = (order: number, type: string = "video"): FlowStep => ({
  step_order: order,
  title: "",
  description: "",
  step_type: type,
  video_asset_id: null,
  is_active: true,
  unlock_rule_type: order === 0 ? "auto" : "watch_complete",
  unlock_rule_value: "",
  cta_text: "",
  cta_url: "",
  booking_url: "",
});

// Pretty base slug from a title. Trimmed to 40 chars to leave room for the
// random suffix that `ensureUniqueSlug` appends at save time.
const generateSlug = (title: string) => {
  return (
    title.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40)
    || "my-funnel"
  );
};

const RESERVED_SLUGS = new Set([
  "admin","api","app","login","signup","dashboard","settings","profile",
  "funnels","videos","live","auth","billing","pricing","help","faq","about",
  "contact","onboarding","new","edit","create","tools","leads","insights",
  "analytics","payments","upgrade","kyc","notifications","f","v","l","s",
]);

// Always appends a 4-char random base62 suffix so URLs cannot be enumerated
// by stripping a numeric "-2" tail. Existing slugs (edit path) are NOT
// re-suffixed — we only generate when this funnel has no slug yet.
const ensureUniqueSlug = async (base: string, existingSlug?: string): Promise<string> => {
  // Preserve any slug that's already saved on this funnel — never break a
  // shared link by re-rolling its suffix.
  if (existingSlug && existingSlug.trim()) return existingSlug.trim();
  const safeBase = RESERVED_SLUGS.has(base) ? `${base}-x` : base;
  return generateUniqueSuffixedSlug(safeBase, "funnels");
};

const SINGLE_STEPS = [
  { icon: FileText, label: "Name & Info", num: "1" },
  { icon: Video, label: "Video", num: "2" },
  { icon: Settings, label: "Video Settings", num: "3" },
  { icon: User, label: "Speaker", num: "4" },
  { icon: ListChecks, label: "Video Topics", num: "5" },
  { icon: ClipboardList, label: "Lead Capture", num: "6" },
  { icon: MessageCircle, label: "Contact Info", num: "7" },
  { icon: IndianRupee, label: "Payment", num: "8" },
  { icon: Lock, label: "Privacy", num: "9" },
  { icon: Rocket, label: "Publish", num: "10" },
];

const MULTI_STEPS = [
  { icon: FileText, label: "Name & Info", num: "1" },
  { icon: Layers, label: "Build Journey", num: "2" },
  { icon: Settings, label: "Video Settings", num: "3" },
  { icon: User, label: "Speaker", num: "4" },
  { icon: ListChecks, label: "Video Topics", num: "5" },
  { icon: ClipboardList, label: "Lead Capture", num: "6" },
  { icon: MessageCircle, label: "Contact Info", num: "7" },
  { icon: IndianRupee, label: "Payment", num: "8" },
  { icon: Lock, label: "Privacy", num: "9" },
  { icon: Rocket, label: "Publish", num: "10" },
];

const UNLOCK_LABELS: Record<string, string> = {
  auto: "Auto",
  watch_complete: "Full watch",
  watch_seconds: "Watch seconds",
  watch_percent: "Watch %",
  cta_click: "CTA click",
  lead_submitted: "Form submit",
  payment_submitted: "Payment",
  manual: "Manual",
  booking_done: "Booking done",
};

const FunnelEditor = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { canUseMultiStep } = usePlan();
  const planLimits = usePlanLimits();
  const { features, planConfigs } = planLimits;
  const queryClient = useQueryClient();
  // Phase 6 gate: starting a brand-new funnel without any uploaded videos = upload first.
  useVideoGate(!isEdit);

  // Wizard step navigation removed — editor is now a single scrollable page.
  const [modeChosen, setModeChosen] = useState(isEdit);

  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const preselectedVideoId = searchParams.get("videoId");
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);
  const [stepVideoPickerIdx, setStepVideoPickerIdx] = useState<number | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<{ id: string; title: string; url: string | null; thumbnail?: string | null } | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstAutoSaveRun = useRef(true);

  const [stepTypeSelectorOpen, setStepTypeSelectorOpen] = useState(false);
  const [editingStepIdx, setEditingStepIdx] = useState<number | null>(null);
  const [stepMenuOpenIdx, setStepMenuOpenIdx] = useState<number | null>(null);

  const [audioNoteEnabled, setAudioNoteEnabled] = useState(false);

  const [funnel, setFunnel] = useState({
    title: "", slug: "", description: "", visibility: "public", intent_type: "lead",
    funnel_mode: "single" as "single" | "multi",
    allow_seek: false, allow_speed_change: true, lock_cta: false,
    cta_enabled: true, cta_text: "Get Started", cta_timing_seconds: 60, cta_url: "",
    video_access_minutes: null as number | null,
    show_contact_buttons: false, contact_whatsapp: "", contact_phone: "", contact_instagram: "",
    show_contact_after_cta: true, whatsapp_auto_message: false, whatsapp_message_template: "Hi {name}, thanks for watching!",
    audio_note_url: "", audio_note_timing: "before", audio_note_autoplay: false, audio_lock_video: false,
    payment_enabled: false, upi_id: "", qr_code_url: "", payment_instructions: "",
    is_live_broadcast: false, broadcast_scheduled_at: "", broadcast_password: "", broadcast_replay_enabled: true,
    is_published: false,
    access_code_plain: "",
    required_fields: { email: false, city: false, state: false, whatsapp: false } as { email: boolean; city: boolean; state: boolean; whatsapp: boolean },
    speaker_mode: "account" as "none" | "account" | "custom",
    speaker_name: "", speaker_photo_url: "", speaker_about: "",
    video_topics_enabled: false,
    video_topics: [] as string[],
    speaker_scope: "global" as "global" | "per_step",
    video_topics_scope: "global" as "global" | "per_step",
  });

  const [leadForm, setLeadForm] = useState({
    capture_enabled: false, capture_timing: "before_video",
    show_name: true, name_required: true, show_phone: true, phone_required: true,
    show_email: false, email_required: false, show_city: true, city_required: false,
    show_state: false, state_required: false, show_whatsapp: false, whatsapp_required: false,
    custom_field_label: "", show_custom: false, custom_required: false,
    custom_fields: [] as CustomField[],
  });

  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([]);

  const { data: userProfile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => { if (!user) return null; const { data } = await supabase.from("profiles").select("full_name, avatar_url, bio").eq("id", user.id).single(); return data; },
    enabled: !!user && !authLoading,
  });
  const { data: existingFunnel, isLoading: funnelLoading, error: funnelError } = useQuery({
    queryKey: ["funnel", id],
    queryFn: async () => { if (!id) return null; const { data } = await supabase.from("funnels").select("*").eq("id", id).single(); return data; },
    enabled: isEdit && !!user?.id && !authLoading,
  });
  const { data: existingLeadForm, isLoading: leadFormLoading } = useQuery({
    queryKey: ["funnel-lead-form", id],
    queryFn: async () => { if (!id) return null; const { data } = await supabase.from("funnel_lead_form_config").select("*").eq("funnel_id", id).single(); return data; },
    enabled: isEdit && !!user?.id && !authLoading,
  });
  const { data: existingSteps, isLoading: stepsLoading } = useQuery({
    queryKey: ["funnel-steps", id],
    queryFn: async () => { if (!id) return []; const { data } = await supabase.from("funnel_steps").select("*").eq("funnel_id", id).order("step_order"); return data || []; },
    enabled: isEdit && !!user?.id && !authLoading,
  });

  useEffect(() => {
    if (existingFunnel) {
      const f = existingFunnel;
      setFunnel((prev) => ({
        ...prev,
        title: f.title || "", slug: f.slug || "", description: f.description || "",
        visibility: f.visibility || "public", intent_type: f.intent_type || "lead",
        funnel_mode: (f as any).funnel_mode || "single",
        allow_seek: f.allow_seek || false, allow_speed_change: f.allow_speed_change ?? true,
        lock_cta: f.lock_cta || false, cta_enabled: (f as any).cta_enabled ?? true,
        cta_text: f.cta_text || "Get Started", cta_timing_seconds: f.cta_timing_seconds || 60,
        cta_url: f.cta_url || "", video_access_minutes: f.video_access_minutes || null,
        show_contact_buttons: f.show_contact_buttons ?? true,
        contact_whatsapp: f.contact_whatsapp || "", contact_phone: f.contact_phone || "",
        contact_instagram: f.contact_instagram || "", show_contact_after_cta: f.show_contact_after_cta ?? true,
        whatsapp_auto_message: f.whatsapp_auto_message ?? true,
        whatsapp_message_template: f.whatsapp_message_template || "Hi {name}, thanks for watching!",
        payment_enabled: f.payment_enabled || false, upi_id: f.upi_id || "",
        qr_code_url: f.qr_code_url || "", payment_instructions: f.payment_instructions || "",
        is_live_broadcast: f.is_live_broadcast || false,
        broadcast_scheduled_at: f.broadcast_scheduled_at || "", broadcast_password: f.broadcast_password || "",
        broadcast_replay_enabled: f.broadcast_replay_enabled ?? true,
        is_published: f.is_published || false,
        access_code_plain: (f as any).access_code_plain || "",
        required_fields: (f as any).required_fields || { email: false, city: false, state: false, whatsapp: false },
        speaker_mode: (f as any).speaker_mode || "account",
        speaker_name: (f as any).speaker_name || "",
        speaker_photo_url: (f as any).speaker_photo_url || "",
        speaker_about: (f as any).speaker_about || "",
        video_topics_enabled: (f as any).video_topics_enabled ?? true,
        video_topics: Array.isArray((f as any).video_topics) ? (f as any).video_topics : [],
        speaker_scope: (f as any).speaker_scope || "global",
        video_topics_scope: (f as any).video_topics_scope || "global",
      }));
      setModeChosen(true);
      if (f.audio_note_url) setAudioNoteEnabled(true);
      if (f.video_asset_id) {
        supabase.from("video_assets").select("id, title, public_url, thumbnail_url").eq("id", f.video_asset_id).single().then(({ data }) => {
          if (data) setSelectedVideo({ id: data.id, title: data.title, url: data.public_url, thumbnail: data.thumbnail_url });
        });
      }
    }
  }, [existingFunnel]);

  useEffect(() => {
    if (existingLeadForm) {
      const l: any = existingLeadForm;
      setLeadForm({
        capture_enabled: l.capture_enabled ?? true, capture_timing: l.capture_timing || "before_video",
        show_name: l.show_name ?? true, name_required: l.name_required ?? true,
        show_phone: l.show_phone ?? true, phone_required: l.phone_required ?? true,
        show_email: l.show_email ?? false, email_required: l.email_required ?? false,
        show_city: l.show_city ?? true, city_required: l.city_required ?? false,
        show_state: l.show_state ?? false, state_required: l.state_required ?? false,
        show_whatsapp: l.show_whatsapp ?? false, whatsapp_required: l.whatsapp_required ?? false,
        custom_field_label: l.custom_field_label || "", show_custom: l.show_custom ?? false,
        custom_required: l.custom_required ?? false,
        custom_fields: Array.isArray(l.custom_fields) ? (l.custom_fields as CustomField[]) : [],
      });
    }
  }, [existingLeadForm]);

  useEffect(() => {
    if (existingSteps && existingSteps.length > 0) {
      setFlowSteps(existingSteps.map((s: any) => ({
        id: s.id, step_order: s.step_order, title: s.title || "", description: s.description || "",
        step_type: s.step_type || "video", video_asset_id: s.video_asset_id, is_active: s.is_active ?? true,
        unlock_rule_type: s.unlock_rule_type || "auto", unlock_rule_value: s.unlock_rule_value || "",
        cta_text: s.cta_text || "", cta_url: s.cta_url || "", booking_url: s.booking_url || "",
        unlock_condition: s.unlock_condition || "full_watch",
        unlock_percentage: s.unlock_percentage ?? 80,
        time_delay_enabled: s.time_delay_enabled ?? false,
        time_delay_minutes: s.time_delay_minutes ?? 0,
        speaker_mode_step: s.speaker_mode_step || "inherit",
        speaker_name_custom: s.speaker_name_custom || "",
        speaker_title: s.speaker_title || "",
        speaker_bio: s.speaker_bio || "",
        speaker_photo_url_custom: s.speaker_photo_url_custom || "",
        video_topics_step_enabled: s.video_topics_step_enabled ?? false,
        video_topics_step: Array.isArray(s.video_topics_step) ? s.video_topics_step : [],
        timer_cta_enabled: s.timer_cta_enabled ?? false,
        timer_cta_text: s.timer_cta_text || "",
        timer_cta_url: s.timer_cta_url || "",
        timer_cta_style: s.timer_cta_style || "gold",
        access_code_enabled: !!s.access_code_enabled,
        access_code_plain: s.access_code_plain || "",
        access_code_hash: s.access_code_hash || null,
        access_code_message: s.access_code_message || "",
      })));
    }
  }, [existingSteps]);

  useEffect(() => {
    if (preselectedVideoId && !isEdit && !selectedVideo) {
      supabase.from("video_assets").select("id, title, public_url, thumbnail_url").eq("id", preselectedVideoId).single().then(({ data }) => {
        if (data) setSelectedVideo({ id: data.id, title: data.title, url: data.public_url, thumbnail: data.thumbnail_url });
      });
    }
  }, [preselectedVideoId, isEdit, selectedVideo]);

  const update = (key: string, value: any) => setFunnel((p) => ({ ...p, [key]: value }));
  const isMulti = funnel.funnel_mode === "multi";

  const buildPayload = useCallback(() => {
    if (!user) return null;
    const slug = funnel.slug || generateSlug(funnel.title);
    const s = sanitizeText;
    return {
      owner_id: user.id, title: s(funnel.title), slug, description: s(funnel.description),
      visibility: funnel.visibility, intent_type: funnel.intent_type, funnel_mode: funnel.funnel_mode,
      allow_seek: funnel.allow_seek, allow_speed_change: funnel.allow_speed_change,
      lock_cta: funnel.lock_cta, cta_enabled: funnel.cta_enabled,
      cta_text: s(funnel.cta_text), cta_timing_seconds: funnel.cta_timing_seconds,
      cta_url: funnel.cta_url || null, video_access_minutes: funnel.video_access_minutes,
      show_contact_buttons: funnel.show_contact_buttons,
      contact_whatsapp: funnel.contact_whatsapp || null, contact_phone: funnel.contact_phone || null,
      contact_instagram: funnel.contact_instagram || null, show_contact_after_cta: funnel.show_contact_after_cta,
      whatsapp_auto_message: funnel.whatsapp_auto_message,
      whatsapp_message_template: funnel.whatsapp_message_template ? s(funnel.whatsapp_message_template) : null,
      payment_enabled: funnel.payment_enabled, upi_id: funnel.upi_id || null,
      qr_code_url: funnel.qr_code_url || null,
      payment_instructions: funnel.payment_instructions ? s(funnel.payment_instructions) : null,
      is_live_broadcast: funnel.is_live_broadcast, broadcast_scheduled_at: funnel.broadcast_scheduled_at || null,
      broadcast_password: funnel.broadcast_password || null, broadcast_replay_enabled: funnel.broadcast_replay_enabled,
      is_published: funnel.is_published, video_asset_id: selectedVideo?.id || null,
      required_fields: funnel.required_fields,
      speaker_mode: funnel.speaker_mode,
      speaker_name: funnel.speaker_name ? s(funnel.speaker_name) : null,
      speaker_photo_url: funnel.speaker_photo_url || null,
      speaker_about: funnel.speaker_about ? s(funnel.speaker_about) : null,
      video_topics_enabled: funnel.video_topics_enabled,
      video_topics: funnel.video_topics.filter((t: string) => t.trim() !== "").map((t: string) => s(t)),
      speaker_scope: funnel.speaker_scope,
      video_topics_scope: funnel.video_topics_scope,
    };
  }, [user, funnel, selectedVideo]);

  const saveMutation = useMutation({
    mutationFn: async (opts?: { publish?: boolean }) => {
      const payload = buildPayload();
      if (!payload) throw new Error("Not authenticated");
      if (opts?.publish) payload.is_published = true;
      // Preserve existing slug on edit; generate suffixed slug for new funnels.
      // The random suffix protects against URL enumeration regardless of whether
      // the user typed a custom slug or we derived one from the title.
      const existingFunnelSlug = isEdit ? (funnel.slug || "") : "";
      const desired = (funnel.slug && funnel.slug.trim()) ? generateSlug(funnel.slug) : generateSlug(funnel.title);
      payload.slug = await ensureUniqueSlug(desired, existingFunnelSlug);
      if (funnel.access_code_plain && funnel.access_code_plain.trim()) {
        const codeUp = funnel.access_code_plain.trim().toUpperCase();
        const enc = new TextEncoder();
        const buf = await crypto.subtle.digest("SHA-256", enc.encode(codeUp));
        (payload as any).access_code_hash = Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, "0")).join("");
        (payload as any).access_code_plain = codeUp;
      } else if (funnel.visibility === "public") {
        // Clear stored code when funnel is made public
        (payload as any).access_code_hash = null;
        (payload as any).access_code_plain = null;
      }
      let funnelId: string;
      if (isEdit) {
        const { error } = await supabase.from("funnels").update(payload).eq("id", id);
        if (error) throw error;
        await (supabase.from("funnel_lead_form_config") as any).upsert({ funnel_id: id, ...leadForm }, { onConflict: "funnel_id" });
        funnelId = id!;
      } else {
        const { data, error } = await supabase.from("funnels").insert(payload).select("id").single();
        if (error) throw error;
        await (supabase.from("funnel_lead_form_config") as any).insert({ funnel_id: data.id, ...leadForm });
        funnelId = data.id;
      }
      if (funnel.funnel_mode === "multi" && flowSteps.length > 0) {
        await supabase.from("funnel_steps").delete().eq("funnel_id", funnelId);
        const stepsPayload = await Promise.all(flowSteps.map(async (s, i) => {
          let accessCodeHash: string | null = s.access_code_hash || null;
          let accessCodePlain: string | null = s.access_code_plain || (s as any)._access_code_raw || null;
          if (accessCodePlain) accessCodePlain = String(accessCodePlain).trim().toUpperCase();
          if (s.access_code_enabled && (s as any)._access_code_raw) {
            const encoder = new TextEncoder();
            const buf = await crypto.subtle.digest("SHA-256", encoder.encode(String((s as any)._access_code_raw).trim().toUpperCase()));
            accessCodeHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
          }
          const isStepOverride = s.speaker_mode_step === "override" || s.speaker_mode_step === "custom";
          return {
            funnel_id: funnelId, step_order: i,
            title: sanitizeText(s.title),
            description: s.description ? sanitizeText(s.description) : null,
            step_type: s.step_type, video_asset_id: s.video_asset_id || null, is_active: s.is_active,
            unlock_rule_type: s.unlock_rule_type, unlock_rule_value: s.unlock_rule_value || null,
            cta_text: s.cta_text ? sanitizeText(s.cta_text) : null,
            cta_url: s.cta_url || null, booking_url: s.booking_url || null,
            unlock_condition: s.unlock_condition || "full_watch",
            unlock_percentage: s.unlock_percentage ?? 80,
            time_delay_enabled: s.time_delay_enabled ?? false,
            time_delay_minutes: s.time_delay_minutes ?? 0,
            timer_cta_enabled: s.timer_cta_enabled ?? false,
            timer_cta_text: s.timer_cta_text ? sanitizeText(s.timer_cta_text) : null,
            timer_cta_url: s.timer_cta_url || null,
            timer_cta_style: s.timer_cta_style || "gold",
            video_topics_step_enabled: s.video_topics_step_enabled ?? false,
            video_topics_step: Array.isArray(s.video_topics_step) ? s.video_topics_step : [],
            access_code_enabled: !!s.access_code_enabled,
            access_code_hash: s.access_code_enabled ? accessCodeHash : null,
            access_code_plain: s.access_code_enabled ? accessCodePlain : null,
            access_code_message: s.access_code_enabled ? (s.access_code_message ? sanitizeText(s.access_code_message) : null) : null,
            speaker_mode_step: s.speaker_mode_step || "inherit",
            speaker_name_custom: isStepOverride ? (s.speaker_name_custom ? sanitizeText(s.speaker_name_custom) : null) : null,
            speaker_title: isStepOverride ? (s.speaker_title ? sanitizeText(s.speaker_title) : null) : null,
            speaker_bio: isStepOverride ? (s.speaker_bio ? sanitizeText(s.speaker_bio) : null) : null,
            speaker_photo_url_custom: isStepOverride ? (s.speaker_photo_url_custom || null) : null,
          };
        }));
        const { error: stepErr } = await (supabase.from("funnel_steps") as any).insert(stepsPayload);
        if (stepErr) throw stepErr;
      }
      return funnelId;
    },
    onSuccess: (funnelId) => {
      queryClient.invalidateQueries({ queryKey: ["my-funnels"] });
      queryClient.invalidateQueries({ queryKey: ["funnel-steps", id] });
      setLastSavedAt(new Date());
      toast.success(isEdit ? "Funnel updated!" : "Funnel created!");
      navigate(`/funnels/${funnelId}`);
    },
    onError: (err: any) => toast.error(err.message || "Failed to save"),
  });

  useEffect(() => {
    if (!isEdit || !id) return;
    if (isFirstAutoSaveRun.current) { isFirstAutoSaveRun.current = false; return; }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const payload = buildPayload();
      if (!payload || !payload.title) return;
      try {
        setIsAutoSaving(true);
        await supabase.from("funnels").update(payload).eq("id", id);
        await (supabase.from("funnel_lead_form_config") as any).upsert({ funnel_id: id, ...leadForm }, { onConflict: "funnel_id" });
        setLastSavedAt(new Date());
      } catch {
      } finally {
        setIsAutoSaving(false);
      }
    }, 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [isEdit, id, funnel, leadForm, selectedVideo, buildPayload]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const addFlowStep = (type: string) => {
    const newStep = createEmptyStep(flowSteps.length, type);
    setFlowSteps((prev) => [...prev, newStep]);
    setEditingStepIdx(flowSteps.length);
  };

  const updateFlowStep = (index: number, key: keyof FlowStep, value: any) => {
    setFlowSteps((prev) => prev.map((s, i) => i === index ? { ...s, [key]: value } : s));
  };

  const removeFlowStep = (index: number) => {
    setFlowSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i })));
    if (editingStepIdx === index) setEditingStepIdx(null);
  };

  const duplicateStep = (index: number) => {
    const original = flowSteps[index];
    const newStep = { ...original, id: undefined, title: `${original.title} (copy)`, step_order: flowSteps.length };
    setFlowSteps((prev) => [...prev, newStep]);
  };

  const moveStep = (from: number, to: number) => {
    if (to < 0 || to >= flowSteps.length) return;
    setFlowSteps((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr.map((s, i) => ({ ...s, step_order: i }));
    });
  };

  const baseSteps = isMulti ? MULTI_STEPS : SINGLE_STEPS;
  // Show Lead Capture step always so users can enable/configure it.
  // Payment step is still gated by its own toggle (set elsewhere in the editor).
  const visibleSteps = baseSteps.filter((s) => {
    if (s.label === "Payment" && !funnel.payment_enabled) return false;
    return true;
  });
  const totalSteps = visibleSteps.length;
  const lastStepIdx = totalSteps - 1;

  // (lastStepIdx kept for future use; no clamping needed without wizardStep)
  void lastStepIdx;

  type StepLock = { featureName: string; requiredPlan: "Basic" | "Pro"; priceLabel: string } | null;
  const basicPrice = `from ₹149/mo`;
  const proPrice = `from ₹599/mo`;

  const getStepLock = (label: string): StepLock => {
    switch (label) {
      case "Speaker":
        return features.speakerProfile ? null : { featureName: "Speaker Profile", requiredPlan: "Basic", priceLabel: basicPrice };
      case "Video Topics":
        return features.videoTopics ? null : { featureName: "Video Topics", requiredPlan: "Basic", priceLabel: basicPrice };
      case "Lead Capture":
        return features.leadCapture ? null : { featureName: "Lead Capture", requiredPlan: "Basic", priceLabel: basicPrice };
      case "Contact Info":
        return features.contactForm ? null : { featureName: "Contact Form", requiredPlan: "Basic", priceLabel: basicPrice };
      case "Payment":
        // Payment is Pro-only; gated by advanced analytics flag as proxy until a
        // dedicated `feature_payment_collection` column is added.
        return features.advancedAnalytics ? null : { featureName: "Payment Collection", requiredPlan: "Pro", priceLabel: proPrice };
      case "Privacy":
        return features.privacySettings ? null : { featureName: "Privacy & Access Codes", requiredPlan: "Basic", priceLabel: basicPrice };
      default:
        return null;
    }
  };

  // currentStepLock removed — locks now applied per-section in the scrollable layout.

  const renderByLabel = (label: string) => {
    switch (label) {
      case "Name & Info": return renderBasicInfo();
      case "Video": return renderVideoStep();
      case "Build Journey": return renderFlowStepsBuilder();
      case "Video Settings": return renderControlsStep();
      case "Speaker": return renderSpeakerStep();
      case "Video Topics": return renderVideoTopicsStep();
      case "Lead Capture": return renderLeadFormStep();
      case "Contact Info": return renderWhatsappStep();
      case "Payment": return renderPaymentStep();
      case "Privacy": return renderPrivacyStep();
      case "Publish": return renderPublishStep();
      default: return null;
    }
  };

  const renderBasicInfo = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Basic Info</h2>
      <p className="text-sm text-muted-foreground">Give your funnel a name and description.</p>
      <div className="space-y-4 mt-4">
        <div>
          <Label>Funnel Name *</Label>
          <Input value={funnel.title} onChange={(e) => { update("title", e.target.value); if (!isEdit) update("slug", generateSlug(e.target.value)); }} className="mt-1.5 bg-muted border-border" placeholder="e.g. Free Training Funnel" />
        </div>
        <div>
          <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Textarea value={funnel.description} onChange={(e) => update("description", e.target.value)} className="mt-1.5 bg-muted border-border" rows={3} placeholder="What is this funnel about?" />
        </div>
      </div>
    </>
  );

  const renderModePicker = () => (
    <>
      <h2 className="text-xl font-heading font-bold">Create New Funnel</h2>
      <p className="text-sm text-muted-foreground">What type of funnel do you want to build?</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
        <button
          onClick={() => { update("funnel_mode", "single"); setModeChosen(true); }}
          className="p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 text-left transition-all group"
        >
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <Video size={22} className="text-primary" />
          </div>
          <h3 className="font-heading font-bold text-sm group-hover:text-primary transition-colors">Single Video Funnel</h3>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            One video with lead capture, CTA, and optional payment. Simple and effective.
          </p>
        </button>
        <button
          onClick={() => {
            update("funnel_mode", "multi");
            if (flowSteps.length === 0) setFlowSteps([createEmptyStep(0)]);
            setModeChosen(true);
            // No wizard step navigation needed.
          }}
          className="p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 text-left transition-all group"
        >
          <div className="w-11 h-11 rounded-xl bg-accent/20 flex items-center justify-center mb-3">
            <Layers size={22} className="text-accent-foreground" />
          </div>
          <h3 className="font-heading font-bold text-sm group-hover:text-primary transition-colors">Multi-Step Flow</h3>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            A guided journey with sequential steps, unlock rules, and progress tracking.
          </p>
        </button>
      </div>
    </>
  );

  const renderVideoStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Video</h2>
      <p className="text-sm text-muted-foreground">Select the video for your funnel.</p>
      {selectedVideo ? (
        <div className="space-y-4 mt-4">
          <div className="border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="w-16 h-11 bg-muted rounded-lg flex items-center justify-center shrink-0">
              <Video size={18} className="text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{selectedVideo.title}</p>
              <p className="text-xs text-emerald-500 mt-0.5">✓ Selected</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setVideoPickerOpen(true)}>Change</Button>
          </div>
          {selectedVideo.url && (
            <div className="rounded-xl overflow-hidden border border-border">
              <video src={selectedVideo.url} poster={selectedVideo.thumbnail || undefined} className="w-full aspect-video object-contain bg-black" controls playsInline />
            </div>
          )}
        </div>
      ) : (
        <div className="border-2 border-dashed border-border rounded-xl p-10 text-center mt-4">
          <Video size={36} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">Choose a video from your gallery</p>
          <Button variant="hero" size="sm" onClick={() => setVideoPickerOpen(true)}>Select Video</Button>
        </div>
      )}

      <div className="mt-6 border-t border-border pt-5">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
          <div>
            <Label className="font-semibold flex items-center gap-2"><Mic size={15} /> Add Audio Note</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Add a personal audio message for your prospects</p>
          </div>
          <Switch checked={audioNoteEnabled} onCheckedChange={setAudioNoteEnabled} />
        </div>
        {audioNoteEnabled && (
          <div className="space-y-4 mt-4">
            <AudioNoteRecorder
              value={funnel.audio_note_url || ""}
              onChange={(url) => update("audio_note_url", url)}
            />
            <div className="p-4 bg-muted/50 rounded-xl">
              <Label className="font-semibold">When to Play</Label>
              <Select value={funnel.audio_note_timing} onValueChange={(v) => update("audio_note_timing", v)}>
                <SelectTrigger className="mt-1.5 bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="before">Before video starts</SelectItem>
                  <SelectItem value="after">After video ends</SelectItem>
                  <SelectItem value="at_cta">When CTA appears</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div><Label className="font-semibold">Autoplay Audio</Label><p className="text-xs text-muted-foreground mt-0.5">Play automatically when triggered</p></div>
              <Switch checked={funnel.audio_note_autoplay} onCheckedChange={(v) => update("audio_note_autoplay", v)} />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div><Label className="font-semibold">Pause Video During Audio</Label><p className="text-xs text-muted-foreground mt-0.5">Lock video until audio completes</p></div>
              <Switch checked={funnel.audio_lock_video} onCheckedChange={(v) => update("audio_lock_video", v)} />
            </div>
          </div>
        )}
      </div>

      <VideoPickerModal open={videoPickerOpen} onClose={() => setVideoPickerOpen(false)} onSelect={(videoId, title, publicUrl, thumbnailUrl) => { setSelectedVideo({ id: videoId, title, url: publicUrl, thumbnail: thumbnailUrl }); setVideoPickerOpen(false); }} />
    </>
  );

  const renderFlowStepsBuilder = () => (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-heading font-semibold">Build Your Journey</h2>
          <p className="text-sm text-muted-foreground">Create a step-by-step experience for your prospects.</p>
        </div>
      </div>

      <div className="mt-4">
        {flowSteps.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-[14px] p-10 text-center">
            <Layers size={36} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground mb-1">No steps yet</p>
            <p className="text-xs text-muted-foreground mb-4">Start building your journey by adding the first step.</p>
            <Button variant="hero" size="sm" onClick={() => setStepTypeSelectorOpen(true)}>
              <Plus size={14} /> Add First Step
            </Button>
          </div>
        ) : (
          <div className="space-y-0">
            {flowSteps.map((fs, idx) => {
              const meta = getStepTypeMeta(fs.step_type);
              const isEditing = editingStepIdx === idx;
              const unlockBadge = fs.unlock_condition === "full_watch" ? "Full watch" :
                fs.unlock_condition === "percentage" ? `${fs.unlock_percentage || 80}%` :
                fs.unlock_condition === "time_spent" ? `${fs.unlock_percentage || 10} min` :
                UNLOCK_LABELS[fs.unlock_rule_type] || "Auto";
              const menuOpen = stepMenuOpenIdx === idx;
              return (
                <div key={idx}>
                  <div
                    className={`group relative rounded-xl transition-all duration-150 ${
                      isEditing
                        ? "border-l-[3px] border-l-primary border-t border-r border-b border-border bg-card shadow-lg shadow-primary/5"
                        : "border border-border bg-card hover:border-primary/30"
                    }`}
                    style={{ padding: "16px 20px" }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
                        <meta.icon size={16} className={meta.color} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">STEP {idx + 1}</span>
                          {!fs.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">Inactive</span>}
                        </div>
                        <p className="text-[15px] font-semibold text-foreground truncate mt-0.5 uppercase tracking-wide">
                          {fs.title || <span className="text-muted-foreground italic normal-case tracking-normal">Untitled {meta.label}</span>}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-background/60 border border-border text-foreground">
                            {meta.label}
                          </span>
                          {idx > 0 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-muted text-muted-foreground flex items-center gap-1">
                              <Lock size={9} />
                              {unlockBadge}
                            </span>
                          )}
                        </div>
                      </div>

                      <Button
                        variant={isEditing ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs shrink-0 gap-1.5"
                        onClick={() => setEditingStepIdx(isEditing ? null : idx)}
                      >
                        <Pencil size={12} />
                        {isEditing ? "Editing" : "Edit"}
                      </Button>

                      <div className="relative shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => setStepMenuOpenIdx(menuOpen ? null : idx)}
                          aria-label="Step options"
                        >
                          <MoreVertical size={14} />
                        </Button>
                        {menuOpen && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setStepMenuOpenIdx(null)} />
                            <div className="absolute right-0 top-9 z-40 w-44 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                              <button
                                onClick={() => { moveStep(idx, idx - 1); setStepMenuOpenIdx(null); }}
                                disabled={idx === 0}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <ChevronUp size={13} /> Move up
                              </button>
                              <button
                                onClick={() => { moveStep(idx, idx + 1); setStepMenuOpenIdx(null); }}
                                disabled={idx === flowSteps.length - 1}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <ChevronDown size={13} /> Move down
                              </button>
                              <button
                                onClick={() => { duplicateStep(idx); setStepMenuOpenIdx(null); }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted"
                              >
                                <Copy size={13} /> Duplicate
                              </button>
                              <button
                                onClick={() => { removeFlowStep(idx); setStepMenuOpenIdx(null); }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 border-t border-border"
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {idx < flowSteps.length - 1 && (
                    <div className="flex justify-center py-1">
                      <div className="w-px h-5 bg-border relative">
                        <ChevronDown size={10} className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {flowSteps.length > 0 && (
          <button
            onClick={() => setStepTypeSelectorOpen(true)}
            className="w-full mt-3 rounded-[14px] py-5 text-center transition-all border-2 border-dashed border-border text-muted-foreground font-semibold text-sm hover:border-primary/40 hover:text-primary hover:bg-primary/5"
          >
            <Plus size={16} className="inline mr-1.5" />
            Add Step
            <span className="block text-[11px] font-normal mt-0.5 opacity-60">Add a video, form, call booking, or payment step</span>
          </button>
        )}
      </div>

      <StepTypeSelector open={stepTypeSelectorOpen} onClose={() => setStepTypeSelectorOpen(false)} onSelect={addFlowStep} />
      <StepConfigPanel
        open={editingStepIdx !== null}
        onClose={() => setEditingStepIdx(null)}
        step={editingStepIdx !== null ? flowSteps[editingStepIdx] : null}
        stepIndex={editingStepIdx ?? 0}
        totalSteps={flowSteps.length}
        onUpdate={(key, value) => { if (editingStepIdx !== null) updateFlowStep(editingStepIdx, key, value); }}
        onOpenVideoPicker={() => { setStepVideoPickerIdx(editingStepIdx); }}
        speakerScope={funnel.speaker_scope}
        videoTopicsScope={funnel.video_topics_scope}
        userProfile={userProfile}
      />
      <VideoPickerModal
        open={stepVideoPickerIdx !== null}
        onClose={() => setStepVideoPickerIdx(null)}
        onSelect={(videoId, title) => {
          if (stepVideoPickerIdx !== null) {
            updateFlowStep(stepVideoPickerIdx, "video_asset_id", videoId);
            toast.success(`Video attached: ${title || "selected video"}`);
          }
          setStepVideoPickerIdx(null);
        }}
      />
    </>
  );

  const renderControlsStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Video Controls</h2>
      <p className="text-sm text-muted-foreground">Configure playback behavior for your viewers.</p>
      <div className="space-y-4 mt-4">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl"><div><Label className="font-semibold">Allow Speed Control</Label><p className="text-xs text-muted-foreground mt-0.5">Let viewers change playback speed</p></div><Switch checked={funnel.allow_speed_change} onCheckedChange={(v) => update("allow_speed_change", v)} /></div>
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl"><div><Label className="font-semibold">Allow Forward Seek</Label><p className="text-xs text-muted-foreground mt-0.5">Let viewers skip ahead in the video</p></div><Switch checked={funnel.allow_seek} onCheckedChange={(v) => update("allow_seek", v)} /></div>
        <div className="p-4 bg-muted/50 rounded-xl">
          <Label className="font-semibold">Access Time Limit</Label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-2">Auto-expire access after a set time</p>
          <Select value={funnel.video_access_minutes?.toString() || "unlimited"} onValueChange={(v) => update("video_access_minutes", v === "unlimited" ? null : parseInt(v))}>
            <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="unlimited">No limit</SelectItem>
              <SelectItem value="1440">24 hours</SelectItem>
              <SelectItem value="2880">48 hours</SelectItem>
              <SelectItem value="4320">72 hours</SelectItem>
              <SelectItem value="10080">1 week</SelectItem>
              <SelectItem value="20160">2 weeks</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  );

  const renderLeadFormStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Lead Capture</h2>
      <p className="text-sm text-muted-foreground">Configure which details to collect from viewers.</p>
      <div className="space-y-4 mt-4">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl"><div><Label className="font-semibold">Enable Lead Capture</Label><p className="text-xs text-muted-foreground mt-0.5">Collect viewer information</p></div><Switch checked={leadForm.capture_enabled} onCheckedChange={(v) => setLeadForm({ ...leadForm, capture_enabled: v })} /></div>
        {leadForm.capture_enabled && (
          <>
            <div className="p-4 bg-muted/50 rounded-xl">
              <Label className="font-semibold">When to Show</Label>
              <Select value={leadForm.capture_timing} onValueChange={(v) => setLeadForm({ ...leadForm, capture_timing: v })}>
                <SelectTrigger className="mt-1.5 bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border"><SelectItem value="before_video">Before Video</SelectItem><SelectItem value="after_cta">After CTA</SelectItem><SelectItem value="immediately">Immediately</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
              {[
                { key: "name", label: "Full Name" }, { key: "phone", label: "Phone Number" },
                { key: "email", label: "Email Address" }, { key: "city", label: "City" },
                { key: "state", label: "State" }, { key: "whatsapp", label: "WhatsApp Number" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-4 p-3.5">
                  <span className="text-sm font-medium">{label}</span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Show <Switch checked={(leadForm as any)[`show_${key}`]} onCheckedChange={(v) => setLeadForm({ ...leadForm, [`show_${key}`]: v })} />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Required <Switch checked={(leadForm as any)[`${key}_required`]} onCheckedChange={(v) => setLeadForm({ ...leadForm, [`${key}_required`]: v })} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <CustomFieldsBuilder
              fields={leadForm.custom_fields}
              onChange={(fields) => setLeadForm({ ...leadForm, custom_fields: fields })}
              enabled={planLimits.features.customFormFields}
              maxFields={planLimits.config.max_custom_form_fields ?? 0}
            />
          </>
        )}
      </div>
    </>
  );

  const renderSpeakerStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Speaker</h2>
      <p className="text-sm text-muted-foreground">Choose how the speaker is shown on your funnel page.</p>
      <div className="space-y-5 mt-4">
        {isMulti && (
          <div className="p-4 bg-muted/50 rounded-xl space-y-3">
            <Label className="font-semibold">Speaker Mode</Label>
            <div className="flex rounded-xl border border-border overflow-hidden">
              {(["global", "per_step"] as const).map((scope) => (
                <button
                  key={scope}
                  onClick={() => update("speaker_scope", scope)}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                    funnel.speaker_scope === scope
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {scope === "global" ? "🌍 One speaker for all steps" : "🎯 Different per step"}
                </button>
              ))}
            </div>
          </div>
        )}

        {isMulti && funnel.speaker_scope === "per_step" && (
          <PerStepSpeakerAssignment steps={flowSteps as any} setSteps={setFlowSteps as any} />
        )}

        {(funnel.speaker_scope === "global" || !isMulti) && (
          <>
            <div className="flex rounded-xl border border-border overflow-hidden">
              {(["none", "account", "custom"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => update("speaker_mode", mode)}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                    funnel.speaker_mode === mode
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mode === "none" ? "None" : mode === "account" ? "Account" : "Custom"}
                </button>
              ))}
            </div>

            {funnel.speaker_mode === "none" && (
              <p className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-xl">No speaker info will be shown on the funnel page.</p>
            )}

            {funnel.speaker_mode === "account" && (
              <div className="p-4 bg-muted/50 rounded-xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center overflow-hidden ring-2 ring-primary/20 shrink-0">
                    {userProfile?.avatar_url ? (
                      <img src={userProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-primary font-heading font-bold text-sm">{userProfile?.full_name?.charAt(0)?.toUpperCase() || "?"}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-sm truncate">{userProfile?.full_name || "Your Name"}</p>
                    {userProfile?.bio && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{userProfile.bio}</p>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">This is pulled from your account profile. Update it in Profile Settings.</p>
              </div>
            )}

            {funnel.speaker_mode === "custom" && (
              <div className="space-y-4">
                <SpeakerPhotoUpload
                  value={funnel.speaker_photo_url}
                  onChange={(url) => update("speaker_photo_url", url)}
                />
                <div>
                  <Label className="text-sm font-medium">Speaker Name</Label>
                  <Input
                    value={funnel.speaker_name}
                    onChange={(e) => update("speaker_name", e.target.value.slice(0, 60))}
                    placeholder="e.g. Anmol Kapoor"
                    className="mt-1.5 bg-muted border-border"
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{funnel.speaker_name.length}/60</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">About Speaker</Label>
                  <Textarea
                    value={funnel.speaker_about}
                    onChange={(e) => update("speaker_about", e.target.value.slice(0, 200))}
                    placeholder="e.g. Network Marketing Leader | Diamond Director at Forever Living"
                    className="mt-1.5 bg-muted border-border"
                    rows={3}
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{funnel.speaker_about.length}/200</p>
                </div>
                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Preview</p>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                    <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center overflow-hidden ring-2 ring-primary/20 shrink-0">
                      {funnel.speaker_photo_url ? (
                        <img src={funnel.speaker_photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-primary font-heading font-bold text-sm">{funnel.speaker_name?.charAt(0)?.toUpperCase() || "?"}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-heading font-bold text-sm">{funnel.speaker_name || "Speaker Name"}</p>
                      {funnel.speaker_about && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{funnel.speaker_about}</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  const renderVideoTopicsStep = () => {
    const topics = funnel.video_topics;
    const updateTopics = (newTopics: string[]) => update("video_topics", newTopics);
    const addTopic = () => { if (topics.length < 10) updateTopics([...topics, ""]); };
    const removeTopic = (i: number) => updateTopics(topics.filter((_: string, idx: number) => idx !== i));
    const updateTopic = (i: number, val: string) => updateTopics(topics.map((t: string, idx: number) => idx === i ? val.slice(0, 100) : t));
    const moveTopic = (from: number, to: number) => {
      if (to < 0 || to >= topics.length) return;
      const arr = [...topics];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      updateTopics(arr);
    };

    return (
      <>
        <h2 className="text-lg font-heading font-semibold">Video Topics</h2>
        <p className="text-sm text-muted-foreground">Add key points covered in your video. These will appear on your funnel page.</p>
        <div className="space-y-5 mt-4">
          {isMulti && (
            <div className="p-4 bg-muted/50 rounded-xl space-y-3">
              <Label className="font-semibold">Video Topics Mode</Label>
              <div className="flex rounded-xl border border-border overflow-hidden">
                {(["global", "per_step"] as const).map((scope) => (
                  <button
                    key={scope}
                    onClick={() => update("video_topics_scope", scope)}
                    className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                      funnel.video_topics_scope === scope
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {scope === "global" ? "🌍 Same topics on all steps" : "🎯 Different per step"}
                  </button>
                ))}
              </div>
              {funnel.video_topics_scope === "per_step" && (
                <p className="text-xs text-muted-foreground">Configure key points individually inside each step's settings.</p>
              )}
            </div>
          )}

          {(funnel.video_topics_scope === "global" || !isMulti) && (
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div>
                <Label className="font-semibold">Show Video Topics on funnel page</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Display key points below the video</p>
              </div>
              <Switch checked={funnel.video_topics_enabled} onCheckedChange={(v) => {
                update("video_topics_enabled", v);
                if (v && funnel.video_topics.length === 0) update("video_topics", ["", "", ""]);
              }} />
            </div>
          )}

          {(funnel.video_topics_scope === "global" || !isMulti) && !funnel.video_topics_enabled && (
            <p className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-xl">Video topics section will be hidden on the funnel page.</p>
          )}

          {(funnel.video_topics_scope === "global" || !isMulti) && funnel.video_topics_enabled && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Topics / Key Points</Label>
              <p className="text-xs text-muted-foreground">Add what your prospects will learn from this video.</p>
              <div className="space-y-2">
                {topics.map((topic: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveTopic(idx, idx - 1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"><ChevronUp size={10} /></button>
                      <button onClick={() => moveTopic(idx, idx + 1)} disabled={idx === topics.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"><ChevronDown size={10} /></button>
                    </div>
                    <Input
                      value={topic}
                      onChange={(e) => updateTopic(idx, e.target.value)}
                      placeholder="Enter a topic..."
                      className="flex-1 bg-muted border-border"
                      maxLength={100}
                    />
                    {topics.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeTopic(idx)}>
                        <X size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {topics.length < 10 ? (
                <Button variant="outline" className="w-full" onClick={addTopic}>
                  <Plus size={14} /> Add Topic
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground text-center">Maximum 10 topics allowed.</p>
              )}

              {topics.filter((t: string) => t.trim()).length > 0 && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Preview</p>
                  <div className="p-4 bg-muted/50 rounded-xl space-y-2">
                    <p className="font-heading font-bold text-sm">What you'll learn in this session</p>
                    {topics.filter((t: string) => t.trim()).map((topic: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
                          <Check size={11} className="text-emerald-500" />
                        </div>
                        <span className="text-sm">{topic}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </>
    );
  };

  const renderPrivacyStep = () => (
    <PrivacySettings
      visibility={funnel.visibility}
      accessCode={funnel.access_code_plain}
      requiredFields={funnel.required_fields}
      onVisibilityChange={(v) => update("visibility", v)}
      onAccessCodeChange={(code) => update("access_code_plain", code)}
      onRequiredFieldsChange={(fields) => update("required_fields", fields)}
    />
  );

  const renderWhatsappStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Contact & WhatsApp</h2>
      <div className="space-y-4 mt-4">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl"><div><Label className="font-semibold">Show Contact Buttons</Label></div><Switch checked={funnel.show_contact_buttons} onCheckedChange={(v) => update("show_contact_buttons", v)} /></div>
        {funnel.show_contact_buttons && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-xl">
            <div>
              <Label className="text-xs text-muted-foreground mb-1">WhatsApp Number</Label>
              <div className="flex gap-2">
                <div className="flex items-center px-3 bg-muted border border-border rounded-md text-sm text-muted-foreground shrink-0">+91</div>
                <Input placeholder="9876543210" value={funnel.contact_whatsapp?.replace(/^\+91/, "")} onChange={(e) => update("contact_whatsapp", "+91" + e.target.value.replace(/\D/g, ""))} className="bg-muted border-border" />
              </div>
            </div>
            <Input placeholder="Phone Number" value={funnel.contact_phone} onChange={(e) => update("contact_phone", e.target.value)} className="bg-muted border-border" />
            <Input placeholder="Instagram Handle" value={funnel.contact_instagram} onChange={(e) => update("contact_instagram", e.target.value)} className="bg-muted border-border" />
            <div className="flex items-center justify-between"><Label className="text-sm">Show Only After CTA</Label><Switch checked={funnel.show_contact_after_cta} onCheckedChange={(v) => update("show_contact_after_cta", v)} /></div>
          </div>
        )}
        <div className="p-4 bg-muted/50 rounded-xl space-y-3">
          <div className="flex items-center justify-between"><Label className="font-semibold">WhatsApp Auto-message</Label><Switch checked={funnel.whatsapp_auto_message} onCheckedChange={(v) => update("whatsapp_auto_message", v)} /></div>
          {funnel.whatsapp_auto_message && (
            <Textarea value={funnel.whatsapp_message_template} onChange={(e) => update("whatsapp_message_template", e.target.value)} className="bg-muted border-border" placeholder="Use {name}, {phone}, {funnel_title}" rows={3} />
          )}
        </div>
      </div>
    </>
  );

  const renderPaymentStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Payment (UPI Manual)</h2>
      <div className="space-y-4 mt-4">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl"><div><Label className="font-semibold">Enable Payment Collection</Label></div><Switch checked={funnel.payment_enabled} onCheckedChange={(v) => update("payment_enabled", v)} /></div>
        {funnel.payment_enabled && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-xl">
            <div><Label className="text-sm">UPI ID</Label><Input value={funnel.upi_id} onChange={(e) => update("upi_id", e.target.value)} placeholder="yourname@upi" className="mt-1 bg-muted border-border" /></div>
            <div><Label className="text-sm">QR Code Image URL</Label><Input value={funnel.qr_code_url} onChange={(e) => update("qr_code_url", e.target.value)} placeholder="Paste QR image URL" className="mt-1 bg-muted border-border" /></div>
            <div><Label className="text-sm">Payment Instructions</Label><Textarea value={funnel.payment_instructions} onChange={(e) => update("payment_instructions", e.target.value)} className="mt-1 bg-muted border-border" rows={3} /></div>
          </div>
        )}
      </div>
    </>
  );

  const renderPublishStep = () => (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-heading font-semibold flex items-center gap-2">
            <Rocket size={18} className="text-primary" /> Publish
          </h2>
          <p className="text-sm text-muted-foreground">Review and publish your funnel.</p>
        </div>
        {/* Top-right status dot */}
        <span
          className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
            funnel.is_published
              ? "bg-emerald-500/15 text-emerald-500"
              : "bg-red-500/15 text-red-500"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              funnel.is_published ? "bg-emerald-500 animate-pulse" : "bg-red-500"
            }`}
          />
          {funnel.is_published ? "Live" : "Draft"}
        </span>
      </div>

      <div className="space-y-4 mt-4">
        <div className="border border-border rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-2"><Check size={16} className={funnel.title ? "text-emerald-500" : "text-muted-foreground"} /><span className="text-sm">{funnel.title ? "Title added" : "Add a title"}</span></div>
          {!isMulti && <div className="flex items-center gap-2"><Check size={16} className={selectedVideo ? "text-emerald-500" : "text-muted-foreground"} /><span className="text-sm">{selectedVideo ? "Video selected" : "Select a video"}</span></div>}
          {isMulti && <div className="flex items-center gap-2"><Check size={16} className={flowSteps.length > 0 ? "text-emerald-500" : "text-muted-foreground"} /><span className="text-sm">{flowSteps.length > 0 ? `${flowSteps.length} journey steps configured` : "Add journey steps"}</span></div>}
          {!isMulti && <div className="flex items-center gap-2"><Check size={16} className={leadForm.capture_enabled ? "text-emerald-500" : "text-muted-foreground"} /><span className="text-sm">{leadForm.capture_enabled ? "Lead capture configured" : "Lead capture disabled"}</span></div>}
        </div>
        {funnel.slug && (
          <div className="p-4 bg-muted/50 rounded-xl">
            <Label className="text-xs text-muted-foreground">Funnel URL</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-sm text-primary flex-1 truncate">{typeof window !== "undefined" ? window.location.origin : ""}/f/{funnel.slug}</code>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/f/${funnel.slug}`); toast.success("Copied!"); }}>
                <Copy size={14} />
              </Button>
            </div>
          </div>
        )}
        <div className="rounded-xl p-4 bg-gradient-to-br from-emerald-500/10 via-primary/10 to-blue-500/10 border-2 border-emerald-500/30 shadow-[0_0_24px_-8px_rgba(0,200,150,0.45)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label className="font-semibold flex items-center gap-1.5">
                <Rocket size={14} className="text-emerald-500" />
                {funnel.is_published ? "Published" : "Make it live"}
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                {funnel.is_published
                  ? "Your funnel is live — anyone with the link can see it."
                  : "Turn this on to publish. Tip: clicking Save will publish automatically."}
              </p>
            </div>
            <Switch checked={funnel.is_published} onCheckedChange={(v) => update("is_published", v)} />
          </div>
        </div>
      </div>
    </>
  );

  const labelToId = (label: string) => `section-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;

  const sectionCompleteByLabel = (label: string): boolean => {
    switch (label) {
      case "Name & Info": return !!funnel.title.trim();
      case "Video": return !!selectedVideo;
      case "Build Journey": return flowSteps.length > 0;
      case "Lead Capture": return leadForm.capture_enabled;
      case "Contact Info": return !!(funnel.contact_whatsapp || funnel.contact_phone || funnel.contact_instagram);
      case "Payment": return !!funnel.upi_id || !!funnel.qr_code_url;
      case "Publish": return !!funnel.is_published;
      default: return false;
    }
  };

  const editorSections: EditorSection[] = visibleSteps.map((s) => ({
    id: labelToId(s.label),
    label: s.label,
    num: (s as any).num,
    icon: s.icon,
    locked: !!getStepLock(s.label),
    complete: sectionCompleteByLabel(s.label),
  }));

  if (authLoading || (isEdit && (funnelLoading || leadFormLoading || stepsLoading))) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (isEdit && funnelError) {
    return (
      <DashboardLayout>
        <div className="glass-card p-10 text-center">
          <h1 className="text-xl font-heading font-semibold">Couldn’t open this funnel</h1>
          <p className="mt-2 text-sm text-muted-foreground">The funnel was not found or you don’t have access.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (isEdit && !existingFunnel) {
    return (
      <DashboardLayout>
        <div className="glass-card p-10 text-center">
          <h1 className="text-xl font-heading font-semibold">Funnel not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This funnel no longer exists or isn’t yours.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!modeChosen) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto glass-card p-6 sm:p-8">
          {renderModePicker()}
        </div>
      </DashboardLayout>
    );
  }

  const headerNode = (
    <div
      className="px-3 sm:px-4 md:px-8 py-3 border-b border-border flex items-center justify-between gap-2"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/tools")}>
          <ChevronDown className="rotate-90" size={18} />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-heading font-bold truncate">{funnel.title || "New Funnel"}</h1>
          {isAutoSaving ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Saving…
            </p>
          ) : lastSavedAt ? (
            <p className="text-xs text-muted-foreground">Auto-saved {lastSavedAt.toLocaleTimeString()}</p>
          ) : null}
        </div>
      </div>
      <Button
        variant="hero"
        size="sm"
        onClick={() => { update("is_published", true); saveMutation.mutate({ publish: true }); }}
        disabled={saveMutation.isPending || !funnel.title}
        className="shrink-0"
      >
        {saveMutation.isPending ? "Saving..." : isEdit ? "Update" : "Save"}
      </Button>
    </div>
  );

  return (
    <DashboardLayout editorMode>
      <EditorScrollLayout
        sections={editorSections}
        header={headerNode}
        rightPane={
          <FunnelLivePreview
            funnel={funnel}
            selectedVideo={selectedVideo}
            flowSteps={flowSteps}
            leadForm={leadForm}
            previewStepIndex={editingStepIdx}
          />
        }
      >
        {visibleSteps.map((s) => {
          const lock = getStepLock(s.label);
          const content = renderByLabel(s.label);
          return (
            <EditorSectionBlock key={s.label} id={labelToId(s.label)}>
              {lock ? (
                <StepLockOverlay
                  featureName={lock.featureName}
                  requiredPlan={lock.requiredPlan}
                  priceLabel={lock.priceLabel}
                >
                  {content}
                </StepLockOverlay>
              ) : (
                content
              )}
            </EditorSectionBlock>
          );
        })}
      </EditorScrollLayout>
    </DashboardLayout>
  );
};

export default FunnelEditor;
