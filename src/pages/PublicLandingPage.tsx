import { useState, useEffect } from "react";
import { useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/landing/Logo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Check, Lock, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { TestimonialsViewer } from "@/components/funnel/TestimonialsViewer";
import { LandingPageCodeGate } from "@/components/funnel/LandingPageCodeGate";
import { DateOfBirthInput } from "@/components/funnel/DateOfBirthInput";
import { PostSubmitVideoPlayer } from "@/components/landing/PostSubmitVideoPlayer";
import { BrandingWatermark } from "@/components/BrandingWatermark";

const PublicLandingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<any>(null);
  const [video, setVideo] = useState<any>(null);
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState("");
  const [pageUnlocked, setPageUnlocked] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      const { data } = await supabase
        .from("landing_pages").select("*")
        .eq("slug", slug).eq("status", "published").single();
      if (data) {
        setPage(data);
        const saved = localStorage.getItem(`nf_registered_${data.id}`);
        if (saved) setSubmitted(true);
        if ((data as any).access_code_enabled) {
          try {
            const verified = localStorage.getItem(`nf_lp_verified_${data.id}`);
            if (verified) setPageUnlocked(true);
          } catch {}
        } else {
          setPageUnlocked(true);
        }
        if ((data as any).post_submit_video_asset_id) {
          const { data: v } = await supabase
            .from("video_assets").select("id,title,public_url,thumbnail_url,allow_seek,allow_playback_speed")
            .eq("id", (data as any).post_submit_video_asset_id).single();
          if (v) setVideo(v);
        }
        supabase.rpc("increment_landing_page_views", { _landing_page_id: data.id });
        if ((data as any).testimonials_enabled) {
          const { data: tData } = await supabase
            .from("landing_page_testimonials").select("*")
            .eq("landing_page_id", data.id).eq("is_active", true)
            .order("display_order", { ascending: true });
          setTestimonials(tData || []);
        }
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!page || submitting) return;
    if (honeypot) { setSubmitted(true); return; }

    const minAgeEnabled = !!(page as any).min_age_enabled;
    const minAge = Number((page as any).min_age) || 0;
    if (minAgeEnabled && minAge > 0) {
      const dob: string = formData.dob || "";
      if (!dob) { toast.error(`Please enter your date of birth (${minAge}+ required).`); return; }
      const dobDate = new Date(dob);
      if (isNaN(dobDate.getTime())) { toast.error("Please enter a valid date of birth."); return; }
      const today = new Date();
      let age = today.getFullYear() - dobDate.getFullYear();
      const monthDiff = today.getMonth() - dobDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) age--;
      if (age < minAge) { toast.error(`Sorry, you must be ${minAge}+ to register.`); return; }
    }

    setSubmitting(true);
    try {
      const payload: any = { landing_page_id: page.id, honeypot: "", ...formData, user_agent: navigator.userAgent };
      const { data, error } = await supabase.functions.invoke("submit-landing-page-registration", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      localStorage.setItem(`nf_registered_${page.id}`, JSON.stringify({
        name: formData.name, email: formData.email, submittedAt: Date.now(),
      }));
      toast.success("🎉 You're registered! Check your email for confirmation.", { duration: 5000 });
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
          <p className="text-muted-foreground">This landing page doesn't exist or isn't published.</p>
        </div>
      </div>
    );
  }

  if (page.access_code_enabled && !pageUnlocked) {
    return (
      <LandingPageCodeGate
        pageId={page.id}
        pageTitle={page.title || "Private page"}
        message={(page as any).access_code_message}
        onSuccess={() => setPageUnlocked(true)}
      />
    );
  }

  const sections = (page.sections as any[]) || [];
  const bgClass = page.background_style === "light"
    ? "bg-background text-foreground"
    : page.background_style === "gradient"
    ? "bg-gradient-to-br from-background to-muted text-foreground"
    : "bg-card text-card-foreground";

  const formFields = [
    { key: "name", label: "Full Name", enabled: page.field_name_enabled, required: page.field_name_required },
    { key: "phone", label: "Phone Number", enabled: page.field_phone_enabled, required: page.field_phone_required, prefix: "+91" },
    { key: "email", label: "Email Address", enabled: page.field_email_enabled, required: page.field_email_required, type: "email" },
    { key: "age", label: "Age", enabled: page.field_age_enabled, required: page.field_age_required },
    { key: "dob", label: "Date of Birth", enabled: !!page.field_dob_enabled, required: !!page.field_dob_required, fieldType: "dob" },
    { key: "city", label: "City", enabled: page.field_city_enabled, required: page.field_city_required },
    { key: "state", label: "State", enabled: page.field_state_enabled, required: page.field_state_required, fieldType: "state_dropdown" },
    { key: "occupation", label: "Occupation", enabled: page.field_occupation_enabled, required: page.field_occupation_required },
    ...(page.field_custom_1_enabled ? [{ key: "custom_1_value", label: page.field_custom_1_label || "Custom 1", enabled: true, required: page.field_custom_1_required }] : []),
    ...(page.field_custom_2_enabled ? [{ key: "custom_2_value", label: page.field_custom_2_label || "Custom 2", enabled: true, required: page.field_custom_2_required }] : []),
  ].filter((f) => f.enabled);

  const renderSection = (section: any, i: number) => {
    switch (section.type) {
      case "hero":
        return (
          <div key={i} className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">{section.headline}</h1>
            {section.subheadline && <p className="text-lg text-muted-foreground">{section.subheadline}</p>}
            {section.image_url && <img src={section.image_url} alt="" className="rounded-xl w-full object-contain" />}
            {section.cta_text && <p className="text-primary font-semibold text-lg">{section.cta_text}</p>}
          </div>
        );
      case "text":
        return (
          <div key={i} className={`space-y-2 ${section.alignment === "center" ? "text-center" : ""}`}>
            {section.heading && <h2 className="text-2xl font-bold">{section.heading}</h2>}
            {section.body && <p className="text-muted-foreground whitespace-pre-line">{section.body}</p>}
          </div>
        );
      case "features":
        return (
          <div key={i} className="space-y-4">
            {section.title && <h2 className="text-2xl font-bold">{section.title}</h2>}
            <div className={section.layout === "grid" ? "grid grid-cols-2 gap-3" : "space-y-2"}>
              {(section.items || []).map((item: any, j: number) => (
                <div key={j} className="flex items-start gap-2">
                  <span className="text-lg">{item.emoji}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        );
      case "testimonials":
        return (
          <div key={i} className="space-y-4">
            {section.title && <h2 className="text-2xl font-bold">{section.title}</h2>}
            <div className="grid gap-4 md:grid-cols-2">
              {(section.items || []).map((item: any, j: number) => (
                <Card key={j} className="p-4">
                  <p className="italic text-muted-foreground mb-3">"{item.quote}"</p>
                  <div className="font-semibold">{item.name}</div>
                  {item.role && <div className="text-xs text-muted-foreground">{item.role}</div>}
                </Card>
              ))}
            </div>
          </div>
        );
      case "faq":
        return (
          <div key={i} className="space-y-4">
            {section.title && <h2 className="text-2xl font-bold">{section.title}</h2>}
            <Accordion type="single" collapsible className="w-full">
              {(section.items || []).map((item: any, j: number) => (
                <AccordionItem key={j} value={`faq-${i}-${j}`}>
                  <AccordionTrigger>{item.question}</AccordionTrigger>
                  <AccordionContent>{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        );
      case "image":
        return (
          <div key={i} className={section.size === "full" ? "" : "max-w-lg mx-auto"}>
            {section.url && <img src={section.url} alt={section.caption || ""} className="rounded-xl w-full" />}
            {section.caption && <p className="text-xs text-muted-foreground text-center mt-2">{section.caption}</p>}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${bgClass}`}>
      <header className="flex items-center justify-center px-4 md:px-8 py-4 border-b border-border">
        <Logo size="sm" />
      </header>

      <main className="flex-1 px-4 md:px-8 py-8 max-w-7xl mx-auto w-full">
        {submitted ? (
          <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in">
            {video?.public_url ? (
              <>
                {page.post_submit_video_title && (
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold">{page.post_submit_video_title}</h2>
                    {page.post_submit_video_description && (
                      <p className="text-muted-foreground">{page.post_submit_video_description}</p>
                    )}
                  </div>
                )}
                <PostSubmitVideoPlayer
                  videoUrl={video.public_url}
                  thumbnailUrl={video.thumbnail_url}
                  allowSeek={video.allow_seek !== false}
                  allowSpeed={video.allow_playback_speed !== false}
                />
              </>
            ) : (
              <Card className="p-12 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Check className="text-primary" size={32} />
                </div>
                <h2 className="text-2xl font-bold">You're Registered!</h2>
                <p className="text-muted-foreground">Thank you for registering. We'll see you at the session!</p>
              </Card>
            )}
            {page.testimonials_enabled && testimonials.length > 0 &&
              ((page as any).testimonials_display_position !== "before_registration") && (
              <div className="mt-10">
                <TestimonialsViewer testimonials={testimonials} sectionTitle={page.testimonials_section_title || "What our members say"} />
              </div>
            )}
            {page.linked_funnel_id && (
              <Button className="w-full" onClick={() => window.location.href = `/f/${page.linked_funnel_id}`}>
                Continue to full session journey <ChevronRight size={16} className="ml-1" />
              </Button>
            )}
          </div>
        ) : (
          <div className="grid lg:grid-cols-5 gap-8 items-start">
            <div className="lg:col-span-3 space-y-8">
              {sections.map(renderSection)}
              {sections.length === 0 && (
                <div className="space-y-4">
                  <h1 className="text-3xl md:text-4xl font-bold">{page.title}</h1>
                  {page.description && <p className="text-lg text-muted-foreground">{page.description}</p>}
                </div>
              )}

              {(page.speaker_name || page.speaker_photo_url) && (
                <Card className="p-6 flex flex-col sm:flex-row gap-4 items-start">
                  {page.speaker_photo_url && (
                    <img src={page.speaker_photo_url} alt={page.speaker_name || "Speaker"} className="w-24 h-24 rounded-full object-cover shrink-0 ring-2 ring-primary/30" />
                  )}
                  <div className="flex-1">
                    <h3 className="text-xl font-bold">{page.speaker_name}</h3>
                    {page.speaker_role && <p className="text-sm text-muted-foreground">{page.speaker_role}</p>}
                    {page.speaker_bio && (
                      <details className="mt-2 group">
                        <summary className="text-sm cursor-pointer text-primary list-none [&::-webkit-details-marker]:hidden">
                          <span className="group-open:hidden">Read bio →</span>
                          <span className="hidden group-open:inline">Hide bio ↑</span>
                        </summary>
                        <p className="mt-2 text-sm whitespace-pre-line">{page.speaker_bio}</p>
                      </details>
                    )}
                  </div>
                </Card>
              )}

              {page.testimonials_enabled && testimonials.length > 0 &&
                ((page as any).testimonials_display_position === "before_registration" ||
                 (page as any).testimonials_display_position === "both") && (
                <TestimonialsViewer testimonials={testimonials} sectionTitle={page.testimonials_section_title || "What our members say"} />
              )}

              {Array.isArray((page as any).faq_items) && (page as any).faq_items.length > 0 && (
                <Card className="p-6">
                  <h3 className="text-xl font-bold mb-4">Frequently Asked Questions</h3>
                  <Accordion type="single" collapsible className="w-full">
                    {(page as any).faq_items.map((f: any, idx: number) =>
                      f?.question ? (
                        <AccordionItem key={idx} value={`top-faq-${idx}`}>
                          <AccordionTrigger className="text-left">{f.question}</AccordionTrigger>
                          <AccordionContent className="whitespace-pre-line">{f.answer}</AccordionContent>
                        </AccordionItem>
                      ) : null,
                    )}
                  </Accordion>
                </Card>
              )}
            </div>

            <div className="lg:col-span-2 lg:sticky lg:top-8">
              <Card className="p-6 space-y-5">
                <div>
                  <h3 className="text-lg font-bold">{page.form_title}</h3>
                  <p className="text-sm text-muted-foreground">{page.form_subtitle}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <input
                    type="text" name="website" value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    className="absolute opacity-0 h-0 w-0 pointer-events-none"
                    tabIndex={-1} autoComplete="off"
                  />

                  {formFields.map((f) => (
                    <div key={f.key} className="space-y-1.5">
                      <Label>{f.label} {f.required && <span className="text-destructive">*</span>}</Label>
                      {(f as any).fieldType === "state_dropdown" ? (
                        <Select
                          value={formData[f.key] || "__none__"}
                          onValueChange={(val) => setFormData((prev) => ({ ...prev, [f.key]: val === "__none__" ? "" : val }))}
                        >
                          <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" disabled>Select State</SelectItem>
                            {[
                              "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman & Nicobar Islands","Chandigarh","Dadra & Nagar Haveli and Daman & Diu","Delhi","Jammu & Kashmir","Ladakh","Lakshadweep","Puducherry"
                            ].map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      ) : (f as any).fieldType === "dob" ? (
                        <DateOfBirthInput
                          value={formData[f.key] || ""}
                          onChange={(val) => setFormData((prev) => ({ ...prev, [f.key]: val }))}
                          required={f.required}
                        />
                      ) : (
                        <Input
                          type={(f as any).type || "text"}
                          placeholder={(f as any).prefix ? `${(f as any).prefix} ` : ""}
                          value={formData[f.key] || ""}
                          onChange={(e) => setFormData((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          required={f.required}
                        />
                      )}
                    </div>
                  ))}

                  <Button type="submit" className="w-full" disabled={submitting} style={{ backgroundColor: page.theme_color }}>
                    {submitting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                    {page.form_button_text} →
                  </Button>
                </form>

                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  <Lock size={12} /> Your information is safe with us
                </p>
              </Card>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center py-6 text-xs text-muted-foreground border-t border-border">
        Nevorai Flow
      </footer>
      <BrandingWatermark ownerId={page?.owner_id} />
    </div>
  );
};

export default PublicLandingPage;
