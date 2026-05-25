import { useState, useEffect } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVideoGate } from "@/hooks/useVideoGate";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { LandingPagePreview } from "@/components/funnel/LandingPagePreview";
import { VideoPickerModal } from "@/components/VideoPickerModal";
import { Video as VideoIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  FileText, Palette, ClipboardList, Mail, Video, Link2, Rocket, Mic,
  Save, ArrowLeft, Check, X, Plus, Trash2, GripVertical, Eye, Edit3, Search, Star,
  Lock as LockIcon,
} from "lucide-react";
import { TestimonialsBuilderStep } from "@/components/funnel/TestimonialsBuilderStep";
import { toast } from "sonner";
import { sanitizeText } from "@/lib/sanitize";
import { generateUniqueSuffixedSlug } from "@/lib/slugSuffix";
import { EditorScrollLayout, EditorSectionBlock, type EditorSection } from "@/components/editor/EditorScrollLayout";

const TEXT_FIELDS = [
  "title", "description", "form_title", "form_subtitle", "form_button_text",
  "speaker_name", "speaker_role", "speaker_bio",
  "email_subject", "email_heading", "email_body", "email_footer_text",
  "sender_display_name", "post_submit_video_title", "post_submit_video_description",
  "testimonials_section_title", "field_custom_1_label", "field_custom_2_label",
  "og_title", "og_description",
  "session_link", "resource_link", "redirect_url",
] as const;

const sanitizeLandingPagePayload = (payload: Record<string, any>) => {
  const out = { ...payload };
  for (const k of TEXT_FIELDS) {
    if (typeof out[k] === "string") out[k] = sanitizeText(out[k]);
  }
  return out;
};

// Pretty base. Trimmed to 40 chars to leave room for the random suffix that
// the save mutation appends on insert.
const generateSlug = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

const defaultFormState = {
  title: "",
  slug: "",
  description: "",
  status: "draft",
  sections: [] as any[],
  form_title: "Register for the Session",
  form_subtitle: "Fill in your details to secure your spot",
  form_button_text: "Register Now",
  field_name_enabled: true, field_name_required: true,
  field_phone_enabled: true, field_phone_required: true,
  field_email_enabled: true, field_email_required: true,
  field_age_enabled: false, field_age_required: false,
  field_dob_enabled: false, field_dob_required: false,
  field_city_enabled: false, field_city_required: false,
  field_state_enabled: false, field_state_required: false,
  field_occupation_enabled: false, field_occupation_required: false,
  access_code_enabled: false,
  access_code_plain: "",
  field_custom_1_enabled: false, field_custom_1_label: "", field_custom_1_required: false,
  field_custom_2_enabled: false, field_custom_2_label: "", field_custom_2_required: false,
  send_confirmation_email: true,
  sender_display_name: "Nevorai",
  email_subject: "You're Registered! Get Ready for the Session",
  email_heading: "Welcome! You Are Successfully Registered",
  email_body: `Thank you for registering.\n\nYour registration has been successfully confirmed, and your spot is now secured.\n\nBe ready for the session at [7:00 PM].`,
  email_footer_text: "Regards,\nTeam Nevorai",
  post_submit_video_asset_id: null as string | null,
  post_submit_video_title: "",
  post_submit_video_description: "",
  linked_funnel_id: null as string | null,
  invite_code_required: false,
  invite_code: "",
  og_title: "",
  og_description: "",
  og_image_url: "",
  theme_color: "#22c55e",
  background_style: "dark",
  speaker_name: "",
  speaker_role: "",
  speaker_bio: "",
  speaker_photo_url: "",
  testimonials_enabled: false,
  testimonials_section_title: "What our members say",
  testimonials_display_position: "after_registration" as string,
  min_age_enabled: false,
  min_age: 18,
  access_code_message: "",
  faq_items: [] as { question: string; answer: string }[],
  session_link: "",
  resource_link: "",
  session_datetime: "" as string | "",
  email_banner_url: "",
  attachment_pdf_url: "",
  redirect_url: "",
};

const sectionTypes = [
  { type: "hero", label: "Hero Section", icon: "🎯" },
  { type: "text", label: "Text Block", icon: "📝" },
  { type: "features", label: "Features / Benefits", icon: "✨" },
  { type: "testimonials", label: "Testimonials", icon: "💬" },
  { type: "faq", label: "FAQ", icon: "❓" },
  { type: "image", label: "Image", icon: "🖼️" },
];

const formFields = [
  { key: "name", label: "Full Name" },
  { key: "phone", label: "Phone Number" },
  { key: "email", label: "Email Address" },
  { key: "age", label: "Age" },
  { key: "dob", label: "Date of Birth" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "occupation", label: "Current Occupation" },
];

const WIZARD_STEPS = [
  { icon: FileText, label: "Page Info", num: "1" },
  { icon: Palette, label: "Design", num: "2" },
  { icon: ClipboardList, label: "Form", num: "3" },
  { icon: Mail, label: "Email", num: "4" },
  { icon: Mic, label: "Speaker", num: "5" },
  { icon: Video, label: "Video", num: "6" },
  { icon: Star, label: "Testimonials", num: "7" },
  { icon: Search, label: "SEO", num: "8" },
  { icon: Rocket, label: "Publish", num: "9" },
];

const LandingPageEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  // Phase 7 gate: must have at least one uploaded video before creating a new landing page.
  useVideoGate(!isEdit);
  const isMobile = useIsMobile();
  const { features: planFeatures } = usePlanLimits();
  const emailFeatureLocked = !planFeatures.landingPageEmail;
  const [wizardStep, setWizardStep] = useState(0);
  const [form, setForm] = useState(defaultFormState);
  const [slugEdited, setSlugEdited] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewStage, setPreviewStage] = useState<"form" | "after-submit">("form");
  const [videoToggle, setVideoToggle] = useState(false);
  const [funnelToggle, setFunnelToggle] = useState(false);
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["landing-page", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("landing_pages").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  const { data: videos = [] } = useQuery({
    queryKey: ["my-videos", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("video_assets").select("id,title,public_url,thumbnail_url").eq("owner_id", user!.id).eq("status", "ready");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: previewTestimonials = [] } = useQuery({
    queryKey: ["landing-page-testimonials", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("landing_page_testimonials")
        .select("*")
        .eq("landing_page_id", id!)
        .order("display_order", { ascending: true });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: funnels = [] } = useQuery({
    queryKey: ["my-funnels", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("funnels").select("id,title,slug").eq("owner_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const selectedPostSubmitVideo = videos.find((video: any) => video.id === form.post_submit_video_asset_id) || null;

  useEffect(() => {
    if (existing) {
      const ex = existing as any;
      setForm({
        ...defaultFormState,
        ...ex,
        sections: (ex.sections as any[]) || [],
        faq_items: Array.isArray(ex.faq_items) ? ex.faq_items : [],
      });
      setSlugEdited(true);
      setVideoToggle(!!ex.post_submit_video_asset_id);
      setFunnelToggle(!!ex.linked_funnel_id);
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = sanitizeLandingPagePayload({ ...form, owner_id: user!.id });

      if (payload.access_code_enabled && payload.access_code_plain) {
        try {
          const codeUp = String(payload.access_code_plain).trim().toUpperCase();
          const enc = new TextEncoder().encode(codeUp);
          const buf = await crypto.subtle.digest("SHA-256", enc);
          payload.access_code_hash = Array.from(new Uint8Array(buf))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          payload.access_code_plain = codeUp; // persist for owner display
        } catch {
          // noop
        }
      }
      if (!payload.access_code_enabled) {
        payload.access_code_hash = null;
        payload.access_code_plain = null;
      }

      if (Array.isArray(payload.faq_items) && payload.faq_items.length > 10) {
        payload.faq_items = payload.faq_items.slice(0, 10);
      }

      if (isEdit) {
        const { error } = await supabase.from("landing_pages").update(payload).eq("id", id!);
        if (error) throw error;
      } else {
        // Append a 4-char random base62 suffix so URLs cannot be enumerated.
        // Existing landing pages keep their slug — we only suffix on first insert.
        const baseSlug = generateSlug(payload.slug || payload.title || "page") || "page";
        payload.slug = await generateUniqueSuffixedSlug(baseSlug, "landing_pages");
        const { error } = await supabase.from("landing_pages").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success(isEdit ? "Landing page updated" : "Landing page created");
      await queryClient.invalidateQueries({ queryKey: ["landing-pages"] });
      await queryClient.refetchQueries({ queryKey: ["landing-pages"] });
      if (!isEdit) navigate("/tools?tab=landing-pages");
    },
    onError: (e: any) => toast.error(e.message || "Failed to save"),
  });

  const updateField = (key: string, value: any) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "title" && !slugEdited) {
        next.slug = generateSlug(value);
      }
      // Structural rule: confirmation email requires a prospect email address.
      // When the confirmation email toggle is ON, email field must be enabled
      // AND required. We enforce this both when the toggle flips on, and when
      // someone tries to disable / un-require the email field while it's on.
      if (key === "send_confirmation_email" && value === true) {
        next.field_email_enabled = true;
        next.field_email_required = true;
      }
      if (
        next.send_confirmation_email &&
        (key === "field_email_enabled" || key === "field_email_required")
      ) {
        next.field_email_enabled = true;
        next.field_email_required = true;
      }
      return next;
    });
  };

  const addSection = (type: string) => {
    const defaults: Record<string, any> = {
      hero: { type: "hero", headline: "", subheadline: "", image_url: "", cta_text: "" },
      text: { type: "text", heading: "", body: "", alignment: "left" },
      features: { type: "features", title: "What You Will Learn", items: [{ emoji: "✅", text: "" }], layout: "list" },
      testimonials: { type: "testimonials", title: "What People Say", items: [{ name: "", role: "", quote: "" }] },
      faq: { type: "faq", title: "Frequently Asked Questions", items: [{ question: "", answer: "" }] },
      image: { type: "image", url: "", caption: "", size: "full" },
    };
    setForm((prev) => ({ ...prev, sections: [...prev.sections, defaults[type] || { type }] }));
  };

  const updateSection = (index: number, updates: any) => {
    setForm((prev) => {
      const sections = [...prev.sections];
      sections[index] = { ...sections[index], ...updates };
      return { ...prev, sections };
    });
  };

  const removeSection = (index: number) => {
    setForm((prev) => ({ ...prev, sections: prev.sections.filter((_, i) => i !== index) }));
  };

  if (isEdit && isLoading) {
    return <DashboardLayout><div className="animate-pulse p-8">Loading...</div></DashboardLayout>;
  }

  const totalSteps = WIZARD_STEPS.length;
  const lastStepIdx = totalSteps - 1;

  const renderPageInfo = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Page Info</h2>
      <p className="text-sm text-muted-foreground">Basic information about your landing page.</p>
      <div className="space-y-4 mt-4">
        <div>
          <Label>Landing Page Title *</Label>
          <Input value={form.title} onChange={(e) => updateField("title", e.target.value)} placeholder="Join Our Exclusive Business Session" className="mt-1.5 bg-muted border-border" />
        </div>
        {/* Slug is auto-generated server-side with a random suffix to prevent
            URL enumeration. The shareable URL is shown in the Publish step. */}
        <div>
          <Label>Short Description</Label>
          <Textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} rows={3} placeholder="A brief description shown below the title" className="mt-1.5 bg-muted border-border" />
        </div>
      </div>
    </>
  );

  const renderDesign = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Design</h2>
      <p className="text-sm text-muted-foreground">Customize the look and content sections of your page.</p>
      <div className="space-y-4 mt-4">
        <div className="p-4 bg-muted/50 rounded-xl space-y-3">
          <Label className="font-semibold">Background Style</Label>
          <Select value={form.background_style} onValueChange={(v) => updateField("background_style", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="gradient">Gradient</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="p-4 bg-muted/50 rounded-xl space-y-3">
          <Label className="font-semibold">Theme Color</Label>
          <div className="flex items-center gap-3">
            <input type="color" value={form.theme_color} onChange={(e) => updateField("theme_color", e.target.value)} className="w-10 h-10 rounded border cursor-pointer" />
            <Input value={form.theme_color} onChange={(e) => updateField("theme_color", e.target.value)} className="w-32 bg-muted border-border" />
          </div>
        </div>

        <div className="border-t pt-5 space-y-4">
          <h3 className="font-semibold">Page Sections</h3>
          <p className="text-xs text-muted-foreground">Add hero banners, text blocks, features, testimonials, FAQ, and images.</p>
          {form.sections.map((section, i) => (
            <div key={i} className="p-4 bg-muted/50 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical size={14} className="text-muted-foreground" />
                  <Badge variant="outline" className="capitalize">{section.type}</Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSection(i)}>
                  <Trash2 size={14} />
                </Button>
              </div>
              {section.type === "hero" && (
                <div className="space-y-3">
                  <Input placeholder="Headline" value={section.headline || ""} onChange={(e) => updateSection(i, { headline: e.target.value })} className="bg-muted border-border" />
                  <Input placeholder="Subheadline" value={section.subheadline || ""} onChange={(e) => updateSection(i, { subheadline: e.target.value })} className="bg-muted border-border" />
                  <ImageUploadField
                    label="Hero Image"
                    value={section.image_url || ""}
                    onChange={(url) => updateSection(i, { image_url: url })}
                    folder="hero"
                  />
                  <Input placeholder="CTA text above form" value={section.cta_text || ""} onChange={(e) => updateSection(i, { cta_text: e.target.value })} className="bg-muted border-border" />
                </div>
              )}
              {section.type === "text" && (
                <div className="space-y-3">
                  <Input placeholder="Heading" value={section.heading || ""} onChange={(e) => updateSection(i, { heading: e.target.value })} className="bg-muted border-border" />
                  <Textarea placeholder="Body text" value={section.body || ""} onChange={(e) => updateSection(i, { body: e.target.value })} rows={4} className="bg-muted border-border" />
                </div>
              )}
              {section.type === "features" && (
                <div className="space-y-3">
                  <Input placeholder="Section title" value={section.title || ""} onChange={(e) => updateSection(i, { title: e.target.value })} className="bg-muted border-border" />
                  {(section.items || []).map((item: any, j: number) => (
                    <div key={j} className="flex items-center gap-2">
                      <Input className="w-14 bg-muted border-border" value={item.emoji} onChange={(e) => {
                        const items = [...section.items]; items[j] = { ...item, emoji: e.target.value };
                        updateSection(i, { items });
                      }} />
                      <Input className="flex-1 bg-muted border-border" placeholder="Benefit..." value={item.text} onChange={(e) => {
                        const items = [...section.items]; items[j] = { ...item, text: e.target.value };
                        updateSection(i, { items });
                      }} />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        const items = section.items.filter((_: any, k: number) => k !== j);
                        updateSection(i, { items });
                      }}><X size={12} /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => updateSection(i, { items: [...(section.items || []), { emoji: "✅", text: "" }] })}>
                    <Plus size={12} className="mr-1" /> Add Item
                  </Button>
                </div>
              )}
              {section.type === "faq" && (
                <div className="space-y-3">
                  <Input placeholder="Section title" value={section.title || ""} onChange={(e) => updateSection(i, { title: e.target.value })} className="bg-muted border-border" />
                  {(section.items || []).map((item: any, j: number) => (
                    <div key={j} className="space-y-2 border border-border rounded-lg p-3">
                      <Input placeholder="Question" value={item.question} onChange={(e) => {
                        const items = [...section.items]; items[j] = { ...item, question: e.target.value };
                        updateSection(i, { items });
                      }} className="bg-muted border-border" />
                      <Textarea placeholder="Answer" value={item.answer} onChange={(e) => {
                        const items = [...section.items]; items[j] = { ...item, answer: e.target.value };
                        updateSection(i, { items });
                      }} rows={2} className="bg-muted border-border" />
                      <Button variant="ghost" size="sm" onClick={() => {
                        const items = section.items.filter((_: any, k: number) => k !== j);
                        updateSection(i, { items });
                      }}><Trash2 size={12} className="mr-1" /> Remove</Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => updateSection(i, { items: [...(section.items || []), { question: "", answer: "" }] })}>
                    <Plus size={12} className="mr-1" /> Add Q&A
                  </Button>
                </div>
              )}
              {section.type === "testimonials" && (
                <div className="space-y-3">
                  <Input placeholder="Section title" value={section.title || ""} onChange={(e) => updateSection(i, { title: e.target.value })} className="bg-muted border-border" />
                  {(section.items || []).map((item: any, j: number) => (
                    <div key={j} className="space-y-2 border border-border rounded-lg p-3">
                      <Input placeholder="Name" value={item.name} onChange={(e) => {
                        const items = [...section.items]; items[j] = { ...item, name: e.target.value };
                        updateSection(i, { items });
                      }} className="bg-muted border-border" />
                      <Input placeholder="Role" value={item.role} onChange={(e) => {
                        const items = [...section.items]; items[j] = { ...item, role: e.target.value };
                        updateSection(i, { items });
                      }} className="bg-muted border-border" />
                      <Textarea placeholder="Quote" value={item.quote} onChange={(e) => {
                        const items = [...section.items]; items[j] = { ...item, quote: e.target.value };
                        updateSection(i, { items });
                      }} rows={2} className="bg-muted border-border" />
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => updateSection(i, { items: [...(section.items || []), { name: "", role: "", quote: "" }] })}>
                    <Plus size={12} className="mr-1" /> Add Testimonial
                  </Button>
                </div>
              )}
              {section.type === "image" && (
                <div className="space-y-3">
                  <ImageUploadField
                    label="Section Image"
                    value={section.url || ""}
                    onChange={(url) => updateSection(i, { url })}
                    folder="sections"
                  />
                  <Input placeholder="Caption (optional)" value={section.caption || ""} onChange={(e) => updateSection(i, { caption: e.target.value })} className="bg-muted border-border" />
                </div>
              )}
            </div>
          ))}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {sectionTypes.map((st) => (
              <Button key={st.type} variant="outline" size="sm" onClick={() => addSection(st.type)} className="justify-start text-xs">
                <span className="mr-1">{st.icon}</span> {st.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  const renderFormStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Registration Form</h2>
      <p className="text-sm text-muted-foreground">Configure the fields viewers fill out.</p>
      <div className="space-y-4 mt-4">
        <div className="p-4 bg-muted/50 rounded-xl space-y-3">
          <div><Label>Form Title</Label><Input value={form.form_title} onChange={(e) => updateField("form_title", e.target.value)} className="mt-1.5 bg-muted border-border" /></div>
          <div><Label>Form Subtitle</Label><Input value={form.form_subtitle} onChange={(e) => updateField("form_subtitle", e.target.value)} className="mt-1.5 bg-muted border-border" /></div>
          <div><Label>Submit Button Text</Label><Input value={form.form_button_text} onChange={(e) => updateField("form_button_text", e.target.value)} className="mt-1.5 bg-muted border-border" /></div>
        </div>

        <div className="p-4 bg-muted/50 rounded-xl space-y-3">
          <h3 className="font-semibold">Form Fields</h3>
          <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
            {formFields.map((f) => {
              const enabledKey = `field_${f.key}_enabled` as keyof typeof form;
              const requiredKey = `field_${f.key}_required` as keyof typeof form;
              // Email field is locked ON + Required whenever the confirmation
              // email is enabled — we need an address to send it to.
              const emailLocked = f.key === "email" && form.send_confirmation_email;
              return (
                <div key={f.key} className="flex items-center justify-between p-3.5">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={form[enabledKey] as boolean}
                      onCheckedChange={(v) => updateField(enabledKey as string, v)}
                      disabled={emailLocked}
                    />
                    <span className={!(form[enabledKey] as boolean) ? "text-muted-foreground text-sm" : "text-sm font-medium"}>
                      {f.label}
                      {emailLocked && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-primary font-semibold">
                          Required for emails
                        </span>
                      )}
                    </span>
                  </div>
                  {form[enabledKey] as boolean && (
                    <div className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={form[requiredKey] as boolean}
                        onCheckedChange={(v) => updateField(requiredKey as string, v)}
                        disabled={emailLocked}
                      />
                      <span className="text-muted-foreground text-xs">Required</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {[1, 2].map((n) => {
          const enabledKey = `field_custom_${n}_enabled` as keyof typeof form;
          const labelKey = `field_custom_${n}_label` as keyof typeof form;
          const requiredKey = `field_custom_${n}_required` as keyof typeof form;
          return (
            <div key={n} className="p-4 bg-muted/50 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch checked={form[enabledKey] as boolean} onCheckedChange={(v) => updateField(enabledKey as string, v)} />
                  <span className="text-sm font-medium">Custom Field {n}</span>
                </div>
                {form[enabledKey] as boolean && (
                  <div className="flex items-center gap-2 text-sm">
                    <Switch checked={form[requiredKey] as boolean} onCheckedChange={(v) => updateField(requiredKey as string, v)} />
                    <span className="text-muted-foreground text-xs">Required</span>
                  </div>
                )}
              </div>
              {form[enabledKey] as boolean && (
                <Input placeholder="Field label..." value={form[labelKey] as string} onChange={(e) => updateField(labelKey as string, e.target.value)} className="bg-muted border-border" />
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  const renderEmailStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Confirmation Email</h2>
      <p className="text-sm text-muted-foreground">Configure the email sent to registrants after they sign up.</p>
      <div className="space-y-4 mt-4">
        <div className={`p-4 bg-muted/50 rounded-xl ${emailFeatureLocked ? "border border-dashed border-primary/40" : ""}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label className="font-semibold flex items-center gap-1.5">
                {emailFeatureLocked && <LockIcon size={14} className="text-primary" />}
                Send Confirmation Email
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {emailFeatureLocked
                  ? "Available on the Pro plan — upgrade to send branded confirmation emails to prospects"
                  : "Automatically send an email when someone registers"}
              </p>
            </div>
            {emailFeatureLocked ? (
              <Button
                size="sm"
                variant="hero"
                onClick={() => navigate("/upgrade")}
                className="shrink-0 gap-1.5"
              >
                <LockIcon size={12} /> Upgrade
              </Button>
            ) : (
              <Switch checked={form.send_confirmation_email} onCheckedChange={(v) => updateField("send_confirmation_email", v)} />
            )}
          </div>
        </div>
        {form.send_confirmation_email && !emailFeatureLocked && (
          <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
            <div className="p-4 bg-muted/50 rounded-xl space-y-3">
              <div>
                <Label className="font-semibold">Email Sent As</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Choose who the email appears from</p>
                <div className="mt-2 space-y-2">
                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    form.sender_display_name === "Nevorai" ? "border-primary bg-primary/5" : "border-border bg-muted/50"
                  }`}>
                    <input type="radio" name="sender_display_name" checked={form.sender_display_name === "Nevorai"} onChange={() => updateField("sender_display_name", "Nevorai")} className="accent-primary" />
                    <div>
                      <p className="text-sm font-medium">Platform Name</p>
                      <p className="text-xs text-muted-foreground">Nevorai</p>
                    </div>
                  </label>
                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    form.sender_display_name !== "Nevorai" ? "border-primary bg-primary/5" : "border-border bg-muted/50"
                  }`}>
                    <input type="radio" name="sender_display_name" checked={form.sender_display_name !== "Nevorai"} onChange={() => updateField("sender_display_name", form.sender_display_name !== "Nevorai" ? form.sender_display_name : (profile?.full_name || ""))} className="accent-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Custom Name</p>
                      {form.sender_display_name !== "Nevorai" && (
                        <Input value={form.sender_display_name || ""} onChange={(e) => updateField("sender_display_name", e.target.value || "")} placeholder="e.g. Adarsh from LaunchPad" className="mt-1 bg-background border-border text-sm h-8" onClick={(e) => e.stopPropagation()} />
                      )}
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-xl space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Mail size={14} className="text-primary" /> What recipients see</h3>
              <div><Label>Email Subject</Label><Input value={form.email_subject} onChange={(e) => updateField("email_subject", e.target.value)} className="mt-1.5 bg-muted border-border" /></div>
              <div><Label>Email Heading</Label><Input value={form.email_heading} onChange={(e) => updateField("email_heading", e.target.value)} className="mt-1.5 bg-muted border-border" /></div>
            </div>

            <div className="p-4 bg-muted/50 rounded-xl space-y-3">
              <div>
                <Label className="font-semibold">Email Body</Label>
                <Textarea value={form.email_body} onChange={(e) => updateField("email_body", e.target.value)} rows={8} className="mt-1.5 bg-muted border-border" />
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-xl space-y-3">
              <div>
                <Label className="font-semibold">Email Footer</Label>
                <Textarea value={form.email_footer_text} onChange={(e) => updateField("email_footer_text", e.target.value)} rows={2} className="mt-1.5 bg-muted border-border" />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );

  const renderSpeakerStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Speaker / Host</h2>
      <p className="text-sm text-muted-foreground">Add details about the speaker.</p>
      <div className="space-y-4 mt-4">
        <div className="p-4 bg-muted/50 rounded-xl space-y-4">
          <ImageUploadField label="Speaker Photo" value={form.speaker_photo_url} onChange={(url) => updateField("speaker_photo_url", url)} folder="speakers" />
          <div><Label>Speaker Name</Label><Input value={form.speaker_name} onChange={(e) => updateField("speaker_name", e.target.value)} className="mt-1.5 bg-muted border-border" /></div>
          <div><Label>Title / Role</Label><Input value={form.speaker_role} onChange={(e) => updateField("speaker_role", e.target.value)} className="mt-1.5 bg-muted border-border" /></div>
          <div><Label>Speaker Bio</Label><Textarea value={form.speaker_bio} onChange={(e) => updateField("speaker_bio", e.target.value)} rows={4} className="mt-1.5 bg-muted border-border" /></div>
        </div>
      </div>
    </>
  );

  const renderVideoStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Post-Submit Video</h2>
      <div className="space-y-4 mt-4">
        <div className="p-4 bg-muted/50 rounded-xl flex items-center justify-between">
          <div>
            <Label className="font-semibold">Enable Post-Submit Video</Label>
          </div>
          <Switch checked={videoToggle} onCheckedChange={(checked) => {
            setVideoToggle(checked);
            if (!checked) {
              updateField("post_submit_video_asset_id", null);
              updateField("post_submit_video_title", "");
              updateField("post_submit_video_description", "");
            }
          }} />
        </div>

        {videoToggle && (
          <>
            <div className="p-4 bg-muted/50 rounded-xl space-y-3">
              <Label className="font-semibold">Select Video</Label>
              {selectedPostSubmitVideo ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background/40">
                  <div className="w-20 h-12 rounded bg-muted overflow-hidden flex-shrink-0">
                    {(selectedPostSubmitVideo as any).thumbnail_url ? (
                      <img src={(selectedPostSubmitVideo as any).thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><VideoIcon size={16} className="text-muted-foreground" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{(selectedPostSubmitVideo as any).title}</p>
                    <p className="text-xs text-muted-foreground">From your video library</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setVideoPickerOpen(true)}>Change</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => updateField("post_submit_video_asset_id", null)}>Remove</Button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="w-full justify-start gap-2" onClick={() => setVideoPickerOpen(true)}>
                  <VideoIcon size={16} /> Pick a video from your library
                </Button>
              )}
              <VideoPickerModal
                open={videoPickerOpen}
                onClose={() => setVideoPickerOpen(false)}
                onSelect={(videoId, title) => {
                  updateField("post_submit_video_asset_id", videoId);
                  if (!form.post_submit_video_title) updateField("post_submit_video_title", title);
                  setVideoPickerOpen(false);
                }}
              />
            </div>
            <div className="p-4 bg-muted/50 rounded-xl space-y-3">
              <div><Label>Video Title</Label><Input value={form.post_submit_video_title} onChange={(e) => updateField("post_submit_video_title", e.target.value)} className="mt-1.5 bg-muted border-border" /></div>
              <div><Label>Video Description</Label><Textarea value={form.post_submit_video_description} onChange={(e) => updateField("post_submit_video_description", e.target.value)} rows={3} className="mt-1.5 bg-muted border-border" /></div>
            </div>
          </>
        )}

        <div className="p-4 bg-muted/50 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <Label className="font-semibold">Link to Funnel</Label>
            <Switch checked={funnelToggle} onCheckedChange={(checked) => {
              setFunnelToggle(checked);
              if (!checked) updateField("linked_funnel_id", null);
            }} />
          </div>
          {funnelToggle && (
            <Select value={form.linked_funnel_id || "__none__"} onValueChange={(v) => updateField("linked_funnel_id", v === "__none__" ? null : v)}>
              <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Select funnel..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {funnels.map((f: any) => (<SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </>
  );

  const renderSeoStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">SEO & Social</h2>
      <div className="space-y-4 mt-4">
        <div className="p-4 bg-muted/50 rounded-xl space-y-3">
          <Label className="font-semibold">Landing Page URL</Label>
          <div className="flex items-center gap-2">
            <Input readOnly value={`${typeof window !== "undefined" ? window.location.origin : ""}/l/${form.slug}`} className="bg-muted border-border" />
            <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/l/${form.slug}`); toast.success("Copied!"); }}>
              <Link2 size={14} />
            </Button>
          </div>
        </div>

        <div className="p-4 bg-muted/50 rounded-xl space-y-3">
          <h3 className="font-semibold">SEO / Social Preview</h3>
          <div><Label>OG Title</Label><Input value={form.og_title || ""} onChange={(e) => updateField("og_title", e.target.value)} placeholder={form.title} className="mt-1.5 bg-muted border-border" /></div>
          <div><Label>OG Description</Label><Textarea value={form.og_description || ""} onChange={(e) => updateField("og_description", e.target.value)} rows={2} className="mt-1.5 bg-muted border-border" /></div>
          <ImageUploadField label="Social Preview Image" value={form.og_image_url || ""} onChange={(url) => updateField("og_image_url", url)} folder="og-images" />
        </div>
      </div>
    </>
  );

  const renderPublishStep = () => {
    const isLive = form.status === "published";
    return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-heading font-semibold flex items-center gap-2">
            <Rocket size={18} className="text-primary" /> Publish
          </h2>
          <p className="text-sm text-muted-foreground">Review and publish your landing page.</p>
        </div>
        <span
          className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
            isLive ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/15 text-red-500"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
          {isLive ? "Live" : "Draft"}
        </span>
      </div>
      <div className="space-y-4 mt-4">
        <div className="rounded-xl p-4 bg-gradient-to-br from-emerald-500/10 via-primary/10 to-blue-500/10 border-2 border-emerald-500/30 shadow-[0_0_24px_-8px_rgba(0,200,150,0.45)] space-y-3">
          <Label className="font-semibold flex items-center gap-1.5">
            <Rocket size={14} className="text-emerald-500" /> Status
          </Label>
          <Select value={form.status} onValueChange={(v) => updateField("status", v)}>
            <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Tip: clicking Save will publish automatically.</p>
        </div>

        <div className="p-4 bg-muted/50 rounded-xl space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label className="font-semibold flex items-center gap-2"><LockIcon size={14} /> Private page (access code)</Label>
              <p className="text-xs text-muted-foreground mt-1">Visitors must enter a code to view this page.</p>
            </div>
            <Switch checked={!!form.access_code_enabled} onCheckedChange={(v) => updateField("access_code_enabled", v)} />
          </div>
          {form.access_code_enabled && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Access code</Label>
                <Input value={form.access_code_plain || ""} onChange={(e) => updateField("access_code_plain", e.target.value.toUpperCase().slice(0, 32))} placeholder="e.g. SESSION-2025" className="font-mono uppercase tracking-wider" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hint message (optional)</Label>
                <Input value={form.access_code_message || ""} onChange={(e) => updateField("access_code_message", e.target.value.slice(0, 200))} />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-muted/50 rounded-xl space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label className="font-semibold">Minimum age requirement</Label>
              <p className="text-xs text-muted-foreground mt-1">Visitors must confirm DOB before submission.</p>
            </div>
            <Switch checked={!!form.min_age_enabled} onCheckedChange={(v) => updateField("min_age_enabled", v)} />
          </div>
          {form.min_age_enabled && (
            <div className="flex items-center gap-2">
              <Label className="text-xs">Must be at least</Label>
              <Input type="number" min={1} max={120} value={form.min_age ?? 18} onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                updateField("min_age", isNaN(n) ? 18 : Math.max(1, Math.min(120, n)));
              }} className="w-20" />
              <span className="text-xs text-muted-foreground">years old</span>
            </div>
          )}
        </div>

        <div className="p-4 bg-muted/50 rounded-xl space-y-3">
          <Label className="font-semibold">Frequently Asked Questions</Label>
          <div className="space-y-3">
            {(form.faq_items || []).map((item, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">FAQ #{idx + 1}</span>
                  <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" onClick={() => {
                    const next = [...(form.faq_items || [])];
                    next.splice(idx, 1);
                    updateField("faq_items", next);
                  }}>Remove</Button>
                </div>
                <Input placeholder="Question" value={item.question} onChange={(e) => {
                  const next = [...(form.faq_items || [])];
                  next[idx] = { ...next[idx], question: e.target.value.slice(0, 200) };
                  updateField("faq_items", next);
                }} />
                <textarea placeholder="Answer" value={item.answer} onChange={(e) => {
                  const next = [...(form.faq_items || [])];
                  next[idx] = { ...next[idx], answer: e.target.value.slice(0, 1000) };
                  updateField("faq_items", next);
                }} className="w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
            ))}
            {(form.faq_items?.length || 0) < 10 && (
              <Button variant="outline" size="sm" onClick={() => updateField("faq_items", [...(form.faq_items || []), { question: "", answer: "" }])}>+ Add FAQ item</Button>
            )}
          </div>
        </div>

        <div className="border border-border rounded-xl p-4 space-y-2.5">
          <h3 className="font-semibold mb-2">Publish Checklist</h3>
          {[
            { ok: !!form.title, label: "Title added" },
            { ok: form.sections.length > 0, label: "At least one section added" },
            { ok: form.field_email_enabled, label: "Email field enabled" },
            { ok: form.send_confirmation_email, label: "Confirmation email configured" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {item.ok ? <Check size={16} className="text-primary" /> : <X size={16} className="text-muted-foreground" />}
              <span className={item.ok ? "" : "text-muted-foreground"}>{item.label}</span>
            </div>
          ))}
        </div>

        <Button className="w-full" onClick={() => {
          updateField("status", "published");
          setTimeout(() => saveMutation.mutate(), 100);
        }} disabled={!form.title || saveMutation.isPending}>
          <Rocket size={16} className="mr-2" /> Publish Landing Page
        </Button>
      </div>
    </>
    );
  };

  const renderTestimonialsStep = () => (
    <div className="space-y-6">
      <TestimonialsBuilderStep
        landingPageId={id}
        userId={user!.id}
        testimonialsEnabled={form.testimonials_enabled ?? false}
        testimonialsSectionTitle={form.testimonials_section_title ?? "What our members say"}
        onToggleEnabled={(v) => updateField("testimonials_enabled", v)}
        onTitleChange={(v) => updateField("testimonials_section_title", v)}
      />

      {form.testimonials_enabled && (
        <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
          <Label className="font-semibold">Where should testimonials appear?</Label>
          <div className="grid sm:grid-cols-3 gap-2">
            {[
              { v: "before_registration", label: "Before form", desc: "Build trust upfront" },
              { v: "after_registration", label: "After form", desc: "Reassure post-submit" },
              { v: "both", label: "Both", desc: "Maximum exposure" },
            ].map((opt) => {
              const active = (form.testimonials_display_position || "after_registration") === opt.v;
              return (
                <button key={opt.v} type="button" onClick={() => updateField("testimonials_display_position", opt.v)}
                  className={`text-left p-3 rounded-lg border transition ${active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"}`}>
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const STEP_RENDERERS = [
    renderPageInfo, renderDesign, renderFormStep, renderEmailStep,
    renderSpeakerStep, renderVideoStep, renderTestimonialsStep, renderSeoStep, renderPublishStep,
  ];

  const labelToId = (label: string) => `section-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;

  const editorSections: EditorSection[] = WIZARD_STEPS.map((s, i) => ({
    id: labelToId(s.label),
    label: s.label,
    num: s.num,
    icon: s.icon,
    complete: i === lastStepIdx ? form.status === "published" : false,
  }));

  if (isMobile && previewMode) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-heading font-bold">Live Preview</h2>
            <div className="flex items-center gap-2">
              <Button variant={previewStage === "form" ? "default" : "outline"} size="sm" onClick={() => setPreviewStage("form")}>Form</Button>
              <Button variant={previewStage === "after-submit" ? "default" : "outline"} size="sm" onClick={() => setPreviewStage("after-submit")}>After registration</Button>
              <Button variant="outline" size="sm" onClick={() => setPreviewMode(false)}><Edit3 size={14} className="mr-1.5" /> Edit</Button>
            </div>
          </div>
          <div className="rounded-xl border border-border overflow-hidden bg-card" style={{ minHeight: "60vh" }}>
            <LandingPagePreview form={form} testimonials={previewTestimonials} previewStage={previewStage} postSubmitVideo={selectedPostSubmitVideo} />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const headerNode = (
    <div
      className="px-3 sm:px-4 md:px-8 py-3 border-b border-border flex items-center justify-between gap-2"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/tools?tab=landing-pages")}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-lg sm:text-xl font-heading font-bold truncate">
          {form.title || (isEdit ? "Edit Landing Page" : "New Landing Page")}
        </h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isMobile && (
          <Button variant="outline" size="sm" onClick={() => setPreviewMode(true)}>
            <Eye size={14} className="mr-1.5" /> Preview
          </Button>
        )}
        <Button size="sm" onClick={() => { updateField("status", "published"); setTimeout(() => saveMutation.mutate(), 50); }} disabled={saveMutation.isPending || !form.title}>
          <Save size={14} className="mr-1.5" /> {saveMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );

  const rightPaneNode = !isMobile ? (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Eye size={14} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Preview</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant={previewStage === "form" ? "default" : "outline"} size="sm" onClick={() => setPreviewStage("form")}>Form</Button>
          <Button variant={previewStage === "after-submit" ? "default" : "outline"} size="sm" onClick={() => setPreviewStage("after-submit")}>After</Button>
        </div>
      </div>
      <div className="rounded-xl border border-border overflow-hidden shadow-xl" style={{ maxHeight: "calc(100vh - 12rem)", overflowY: "auto" }}>
        <LandingPagePreview form={form} testimonials={previewTestimonials} previewStage={previewStage} postSubmitVideo={selectedPostSubmitVideo} />
      </div>
    </div>
  ) : undefined;

  if (authLoading || !user) {
    return (
      <DashboardLayout editorMode>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout editorMode>
      <EditorScrollLayout sections={editorSections} header={headerNode} rightPane={rightPaneNode}>
        {WIZARD_STEPS.map((s, i) => (
          <EditorSectionBlock key={s.label} id={labelToId(s.label)}>
            {STEP_RENDERERS[i]()}
          </EditorSectionBlock>
        ))}
      </EditorScrollLayout>
    </DashboardLayout>
  );
};

export default LandingPageEditor;
