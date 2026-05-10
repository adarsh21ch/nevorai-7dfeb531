import { Play, Lock, Eye, ExternalLink, Share2 } from "lucide-react";

interface PreviewStep {
  title: string;
  step_type: string;
  step_order: number;
  is_active?: boolean;
  time_delay_enabled?: boolean;
  time_delay_minutes?: number;
  timer_cta_enabled?: boolean;
  timer_cta_text?: string;
  timer_cta_style?: string;
  access_code_enabled?: boolean;
}

interface FunnelLivePreviewProps {
  funnel: {
    title: string;
    description: string;
    funnel_mode: "single" | "multi";
    visibility: string;
    slug?: string;
    cta_enabled: boolean;
    cta_text: string;
    show_contact_buttons: boolean;
    contact_whatsapp: string;
    contact_phone: string;
    payment_enabled: boolean;
    required_fields: { email: boolean; city: boolean; state: boolean; whatsapp: boolean };
  };
  selectedVideo: { title: string; url: string | null; thumbnail?: string | null } | null;
  flowSteps: PreviewStep[];
  leadForm: {
    capture_enabled: boolean;
    show_name: boolean;
    show_phone: boolean;
    show_email: boolean;
    show_city: boolean;
    show_custom: boolean;
    custom_field_label: string;
  };
  previewStepIndex?: number | null;
}

export const FunnelLivePreview = ({ funnel, selectedVideo, flowSteps, leadForm, previewStepIndex = null }: FunnelLivePreviewProps) => {
  const isMulti = funnel.funnel_mode === "multi";
  const isPrivate = funnel.visibility === "private";
  const activeSteps = flowSteps.filter((s) => s.is_active !== false);
  const activeIdx = typeof previewStepIndex === "number" ? previewStepIndex : 0;
  const activeStep = activeSteps[activeIdx] || activeSteps[0];
  const maxVisibleSteps = 5;
  const hiddenCount = Math.max(0, activeSteps.length - maxVisibleSteps);
  const visibleSteps = activeSteps.slice(0, maxVisibleSteps);

  const previewUrl = funnel.slug && typeof window !== "undefined" ? `${window.location.origin}/f/${funnel.slug}` : null;

  return (
    <div className="w-full rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <Eye size={12} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Live Preview</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">What your prospect sees</p>
        </div>
        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1">
            Open <ExternalLink size={9} />
          </a>
        )}
      </div>
      <div className="m-3 rounded-lg border border-border bg-background overflow-hidden">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
          <span className="text-[9px] font-heading font-bold text-muted-foreground tracking-wide">nFlow</span>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Share2 size={8} /><span className="text-[8px]">Share</span>
          </div>
        </div>
        <div className="p-2.5 space-y-2.5">
          <h3 className="font-heading font-extrabold text-center text-[12px] leading-tight text-foreground">{funnel.title || "Your Funnel Title"}</h3>
          {isPrivate && (
            <div className="flex items-center justify-center gap-1 text-[9px] text-amber-400">
              <Lock size={8} /> Private
            </div>
          )}
          <div className="aspect-video rounded-lg bg-muted/50 border border-border flex items-center justify-center relative overflow-hidden">
            {selectedVideo?.thumbnail ? <img src={selectedVideo.thumbnail} alt="" className="w-full h-full object-cover rounded-lg opacity-60" /> : null}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Play size={14} className="text-primary ml-0.5" fill="currentColor" />
              </div>
            </div>
            {activeStep && (
              <div className="absolute bottom-1.5 left-1.5 right-1.5">
                <p className="text-[9px] font-semibold text-foreground truncate bg-background/70 backdrop-blur-sm rounded px-1.5 py-0.5">{activeStep.title || `Step ${(activeStep.step_order || 0) + 1}`}</p>
              </div>
            )}
          </div>
          {isMulti && activeSteps.length > 0 && (
            <div className="space-y-1">
              {visibleSteps.map((step, idx) => {
                const isActive = idx === activeIdx;
                const isLocked = idx > activeIdx;
                return (
                  <div key={idx} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px] transition-all ${isActive ? "bg-primary/10 border-l-2 border-l-primary" : isLocked ? "opacity-40" : ""}`}>
                    <span className="text-[8px] font-bold text-muted-foreground bg-muted rounded-full w-4 h-4 flex items-center justify-center shrink-0">{idx + 1}</span>
                    {isActive ? <Play size={8} className="text-primary shrink-0" fill="currentColor" /> : <Lock size={8} className="text-muted-foreground shrink-0" />}
                    <span className={`truncate flex-1 ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>{step.title || `Step ${idx + 1}`}</span>
                    {step.access_code_enabled && <span className="text-amber-400 shrink-0" title="Requires access code"><Lock size={8} /></span>}
                  </div>
                );
              })}
              {hiddenCount > 0 && <p className="text-[9px] text-muted-foreground text-center py-1">+ {hiddenCount} more steps</p>}
            </div>
          )}
          {leadForm.capture_enabled && !isPrivate && (
            <div className="space-y-1.5 pt-1.5 border-t border-border">
              <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Lead Form</p>
              {leadForm.show_name && <div className="h-6 rounded bg-muted border border-border px-2 flex items-center text-[9px] text-muted-foreground">Full Name</div>}
              {leadForm.show_phone && <div className="h-6 rounded bg-muted border border-border px-2 flex items-center text-[9px] text-muted-foreground">Phone Number</div>}
              {leadForm.show_email && <div className="h-6 rounded bg-muted border border-border px-2 flex items-center text-[9px] text-muted-foreground">Email</div>}
              {leadForm.show_city && <div className="h-6 rounded bg-muted border border-border px-2 flex items-center text-[9px] text-muted-foreground">City</div>}
              {leadForm.show_custom && <div className="h-6 rounded bg-muted border border-border px-2 flex items-center text-[9px] text-muted-foreground">{leadForm.custom_field_label || "Custom"}</div>}
            </div>
          )}
          {isPrivate && (
            <div className="space-y-1.5 pt-1.5 border-t border-border">
              <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Registration</p>
              <div className="h-6 rounded bg-muted border border-border px-2 flex items-center text-[9px] text-muted-foreground">Full Name</div>
              <div className="h-6 rounded bg-muted border border-border px-2 flex items-center text-[9px] text-muted-foreground">Phone</div>
              {funnel.required_fields.email && <div className="h-6 rounded bg-muted border border-border px-2 flex items-center text-[9px] text-muted-foreground">Email</div>}
            </div>
          )}
          {funnel.cta_enabled && !isMulti && (
            <div className="w-full py-1.5 rounded-md bg-primary text-center text-[10px] font-bold text-primary-foreground">{funnel.cta_text || "Get Started"} →</div>
          )}
        </div>
      </div>
      <p className="text-[9px] text-muted-foreground text-center pb-3 px-3">Prospects see this exact experience</p>
    </div>
  );
};
