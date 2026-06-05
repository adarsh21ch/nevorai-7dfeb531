import { Lock, Star, Play, Check, ChevronRight } from "lucide-react";

interface Testimonial {
  id: string;
  type: string;
  student_name: string;
  student_location?: string | null;
  student_photo_url?: string | null;
  review_text?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  video_duration_seconds?: number | null;
  is_active: boolean;
}

interface LandingPagePreviewProps {
  form: {
    title: string;
    description: string;
    sections: any[];
    form_title: string;
    form_subtitle: string;
    form_button_text: string;
    theme_color: string;
    background_style: string;
    field_name_enabled: boolean;
    field_phone_enabled: boolean;
    field_email_enabled: boolean;
    field_age_enabled: boolean;
    field_city_enabled: boolean;
    field_state_enabled: boolean;
    field_occupation_enabled: boolean;
    field_custom_1_enabled: boolean;
    field_custom_1_label: string;
    field_custom_2_enabled: boolean;
    field_custom_2_label: string;
    speaker_name?: string;
    speaker_role?: string;
    speaker_bio?: string;
    speaker_photo_url?: string;
    [key: string]: any;
  };
  testimonials?: Testimonial[];
  previewStage?: "form" | "after-submit";
  postSubmitVideo?: {
    id?: string;
    title?: string | null;
    public_url?: string | null;
    thumbnail_url?: string | null;
  } | null;
}

export const LandingPagePreview = ({
  form, testimonials = [], previewStage = "form", postSubmitVideo = null,
}: LandingPagePreviewProps) => {
  const bgClass = form.background_style === "light"
    ? "bg-white text-gray-900"
    : form.background_style === "gradient"
    ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white"
    : "bg-gray-950 text-white";

  const cardBg = form.background_style === "light" ? "bg-gray-50 border-gray-200" : "bg-gray-900/50 border-gray-800";

  const sections = form.sections || [];
  const hasSpeaker = !!(form.speaker_name || form.speaker_photo_url);
  const activeTestimonials = testimonials.filter((t) => {
    if (t.type === "both") return Boolean(t.review_text?.trim()) || Boolean(t.video_url);
    return t.is_active && (t.type === "text" ? Boolean(t.review_text?.trim()) : Boolean(t.video_url));
  }).filter((t) => t.is_active);

  const formFields = [
    { key: "name", label: "Full Name", enabled: form.field_name_enabled },
    { key: "phone", label: "Phone Number", enabled: form.field_phone_enabled },
    { key: "email", label: "Email Address", enabled: form.field_email_enabled },
    { key: "age", label: "Age", enabled: form.field_age_enabled },
    { key: "dob", label: "Date of Birth (DD / MM / YYYY)", enabled: !!form.field_dob_enabled },
    { key: "city", label: "City", enabled: form.field_city_enabled },
    { key: "state", label: "State", enabled: form.field_state_enabled },
    { key: "occupation", label: "Occupation", enabled: form.field_occupation_enabled },
    ...(form.field_custom_1_enabled ? [{ key: "custom_1", label: form.field_custom_1_label || "Custom 1", enabled: true }] : []),
    ...(form.field_custom_2_enabled ? [{ key: "custom_2", label: form.field_custom_2_label || "Custom 2", enabled: true }] : []),
  ].filter(f => f.enabled);

  const formatDuration = (seconds?: number | null) => {
    if (!seconds && seconds !== 0) return null;
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  };

  const renderSection = (section: any, i: number) => {
    switch (section.type) {
      case "hero":
        return (
          <div key={i} className="space-y-3">
            {section.headline && <h1 className="text-2xl md:text-3xl font-bold leading-tight">{section.headline}</h1>}
            {section.subheadline && <p className="text-sm opacity-70">{section.subheadline}</p>}
            {section.image_url && <img src={section.image_url} alt="" loading="lazy" decoding="async" className="rounded-lg w-full max-h-48 object-cover" />}
            {section.cta_text && <p className="font-semibold text-sm" style={{ color: form.theme_color }}>{section.cta_text}</p>}
          </div>
        );
      case "text":
        return (
          <div key={i} className={`space-y-1 ${section.alignment === "center" ? "text-center" : ""}`}>
            {section.heading && <h2 className="text-lg font-bold">{section.heading}</h2>}
            {section.body && <p className="text-xs opacity-70 whitespace-pre-line">{section.body}</p>}
          </div>
        );
      case "features":
        return (
          <div key={i} className="space-y-2">
            {section.title && <h2 className="text-lg font-bold">{section.title}</h2>}
            <div className="space-y-1">
              {(section.items || []).map((item: any, j: number) => (
                <div key={j} className="flex items-start gap-2 text-xs">
                  <span>{item.emoji}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        );
      case "testimonials":
        return (
          <div key={i} className="space-y-2">
            {section.title && <h2 className="text-lg font-bold">{section.title}</h2>}
            <div className="grid gap-2">
              {(section.items || []).map((item: any, j: number) => (
                <div key={j} className={`rounded-lg p-3 text-xs ${cardBg} border`}>
                  <p className="italic opacity-70">"{item.quote}"</p>
                  <p className="font-semibold mt-1">{item.name}</p>
                  {item.role && <p className="opacity-50 text-[10px]">{item.role}</p>}
                </div>
              ))}
            </div>
          </div>
        );
      case "faq":
        return (
          <div key={i} className="space-y-2">
            {section.title && <h2 className="text-lg font-bold">{section.title}</h2>}
            <div className="space-y-1">
              {(section.items || []).map((item: any, j: number) => (
                <div key={j} className={`rounded-lg p-2 text-xs ${cardBg} border`}>
                  <p className="font-semibold">{item.question}</p>
                  <p className="opacity-70 mt-1">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case "image":
        return (
          <div key={i}>
            {section.url && <img src={section.url} alt={section.caption || ""} loading="lazy" decoding="async" className="rounded-lg w-full" />}
            {section.caption && <p className="text-[10px] opacity-50 text-center mt-1">{section.caption}</p>}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-full rounded-xl overflow-hidden ${bgClass}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-current/10">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-primary/20" />
          <span className="text-xs font-bold">Nevorai</span>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {previewStage === "after-submit" ? (
          <>
            {(postSubmitVideo?.public_url || form.post_submit_video_asset_id) ? (
              <div className="space-y-3">
                {(form.post_submit_video_title || form.post_submit_video_description) && (
                  <div className="text-center space-y-1">
                    {form.post_submit_video_title && (<h2 className="text-lg font-bold">{form.post_submit_video_title}</h2>)}
                    {form.post_submit_video_description && (<p className="text-xs opacity-70">{form.post_submit_video_description}</p>)}
                  </div>
                )}
                <div className={`rounded-xl overflow-hidden border ${cardBg}`}>
                  <div className="relative aspect-video bg-black flex items-center justify-center">
                    {postSubmitVideo?.thumbnail_url && (
                      <img src={postSubmitVideo.thumbnail_url} alt={postSubmitVideo.title || "Post registration video"} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-black/35" />
                    <div className="relative z-10 w-12 h-12 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
                      <Play size={18} className="text-white" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`rounded-xl p-5 text-center space-y-2 ${cardBg} border`}>
                <div className="w-12 h-12 rounded-full bg-primary/15 text-primary flex items-center justify-center mx-auto">
                  <Check size={20} />
                </div>
                <h2 className="text-lg font-bold">You're Registered!</h2>
                <p className="text-xs opacity-70">This is the success screen visitors will see right after they register.</p>
              </div>
            )}

            {form.testimonials_enabled && activeTestimonials.length > 0 && (
              <div className="space-y-3 mt-4">
                <h3 className="text-sm font-bold text-center opacity-80">
                  {form.testimonials_section_title || "What our members say"}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {activeTestimonials.map((t) => {
                    const tInitials = (t.student_name || "?").split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
                    const durationLabel = formatDuration(t.video_duration_seconds);

                    return (
                      <div key={t.id} className={`border ${cardBg} rounded-xl overflow-hidden`}>
                        <div className="flex items-center gap-2 p-2.5 pb-1.5">
                          {t.student_photo_url ? (
                            <img src={t.student_photo_url} alt={t.student_name || "Student"} className="h-7 w-7 rounded-full object-cover shrink-0" loading="lazy" />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-[9px] font-bold text-primary shrink-0">
                              {tInitials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-[10px] font-bold">{t.student_name || "Student"}</p>
                            {t.student_location && <p className="truncate text-[8px] opacity-50">{t.student_location}</p>}
                          </div>
                        </div>

                        <div className="px-2.5 pb-1 flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => <Star key={s} size={8} className="text-amber-400 fill-amber-400" />)}
                        </div>

                        {(t.type === "text" || t.type === "both") && t.review_text && (
                          <div className="px-2.5 pb-2"><p className="line-clamp-3 text-[9px] opacity-70">{t.review_text}</p></div>
                        )}

                        {(t.type === "video" || t.type === "both") && t.video_url && (
                          <div className="px-2 pb-2">
                            <div className="relative overflow-hidden rounded-lg bg-foreground/10 aspect-[9/16]">
                              {t.thumbnail_url ? (
                                <img src={t.thumbnail_url} alt="Video testimonial" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                              ) : (
                                <video src={t.video_url} className="absolute inset-0 h-full w-full object-cover" muted playsInline preload="metadata" />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm">
                                  <Play size={12} className="text-foreground" />
                                </div>
                              </div>
                              {durationLabel && (
                                <span className="absolute right-1.5 top-1.5 rounded-full bg-background/80 px-1.5 py-0.5 text-[8px] font-medium text-foreground">
                                  {durationLabel}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {form.linked_funnel_id && (
              <div className="h-9 rounded-lg flex items-center justify-center gap-1 text-xs font-bold text-white" style={{ backgroundColor: form.theme_color }}>
                Continue to full session journey <ChevronRight size={12} />
              </div>
            )}
          </>
        ) : (
          <>
            <div className="space-y-5">
              {form.access_code_enabled && (
                <div className="rounded-md border border-current/20 bg-current/5 px-2.5 py-1.5 text-[10px] flex items-center gap-1.5 opacity-80">
                  <Lock size={11} /> Private page · viewers must enter access code
                </div>
              )}
              {sections.length > 0 ? sections.map(renderSection) : (
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold">{form.title || "Your Landing Page"}</h1>
                  {form.description && <p className="text-sm opacity-70">{form.description}</p>}
                </div>
              )}
            </div>

            {hasSpeaker && (
              <div className={`rounded-lg p-4 flex items-center gap-3 ${cardBg} border`}>
                {form.speaker_photo_url && (
                  <img src={form.speaker_photo_url} alt={form.speaker_name} width={64} height={64} loading="lazy" decoding="async" className="w-16 h-16 rounded-full object-cover shrink-0" />
                )}
                <div>
                  <h3 className="font-bold text-sm">{form.speaker_name}</h3>
                  {form.speaker_role && <p className="text-[10px] opacity-50">{form.speaker_role}</p>}
                  {form.speaker_bio && <p className="text-xs opacity-70 mt-1 line-clamp-2">{form.speaker_bio}</p>}
                </div>
              </div>
            )}

            <div className={`rounded-xl p-4 ${cardBg} border`}>
              <h3 className="font-bold text-sm">{form.form_title}</h3>
              <p className="text-[10px] opacity-60 mb-3">{form.form_subtitle}</p>
              <div className="space-y-2">
                {formFields.map(f => (
                  <div key={f.key} className="h-8 rounded-md bg-current/5 border border-current/10 px-2 flex items-center text-[10px] opacity-40">
                    {f.label}
                  </div>
                ))}
                <div className="h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: form.theme_color }}>
                  {form.form_button_text} →
                </div>
              </div>
              <p className="text-[9px] opacity-30 text-center mt-2 flex items-center justify-center gap-1">
                <Lock size={8} /> Your information is safe
              </p>
            </div>
          </>
        )}
      </div>

      <div className="text-center py-3 text-[9px] opacity-20 border-t border-current/5">
        © Nevorai
      </div>
    </div>
  );
};
