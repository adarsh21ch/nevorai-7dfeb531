import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoImg from "@/assets/nevorai-logo-mark.png";
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
import { NPhoneInput } from "@/components/ui/PhoneInput";
import { StateSelect } from "@/components/ui/StateSelect";
import { PrivacyMicrocopy } from "@/components/funnel/PrivacyMicrocopy";

interface PrivateLeadFormProps {
  funnelId: string;
  funnelTitle: string;
  requiredFields: { phone?: boolean; email: boolean; city: boolean; state: boolean; whatsapp: boolean };
  onSuccess: () => void;
  isDark: boolean;
}

type FieldErrors = Partial<Record<"name" | "phone" | "email" | "city" | "state" | "whatsapp", string | null>>;

export const PrivateLeadForm = ({
  funnelId,
  funnelTitle,
  requiredFields,
  onSuccess,
  isDark,
}: PrivateLeadFormProps) => {
  const [form, setForm] = useState({
    name: "", phone: "", email: "", city: "", state: "", whatsapp: "",
  });
  const [website, setWebsite] = useState("");
  const formMountedAt = useState(() => Date.now())[0];
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [waSameAsPhone, setWaSameAsPhone] = useState(true);

  const refs = {
    name: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    city: useRef<HTMLInputElement>(null),
    state: useRef<HTMLInputElement>(null),
    whatsapp: useRef<HTMLInputElement>(null),
  };

  // Mirror phone -> whatsapp when checkbox is on
  useEffect(() => {
    if (requiredFields.whatsapp && waSameAsPhone) {
      setForm((f) => (f.whatsapp === f.phone ? f : { ...f, whatsapp: f.phone }));
    }
  }, [form.phone, waSameAsPhone, requiredFields.whatsapp]);

  const setField = <K extends keyof typeof form>(k: K, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k as keyof FieldErrors]) setErrors((e) => ({ ...e, [k]: null }));
  };

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    e.name = validateRequired(form.name, "Name");
    e.phone = validatePhone(form.phone);
    if (requiredFields.email) e.email = validateEmail(form.email);
    if (requiredFields.city) e.city = validateRequired(form.city, "City");
    if (requiredFields.state) e.state = validateRequired(form.state, "State");
    if (requiredFields.whatsapp && !waSameAsPhone) e.whatsapp = validatePhone(form.whatsapp);
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (website.trim() !== "") {
      setShowSuccess(true);
      setTimeout(() => onSuccess(), 1500);
      return;
    }
    if (Date.now() - formMountedAt < 2000) {
      setShowSuccess(true);
      setTimeout(() => onSuccess(), 1500);
      return;
    }

    const fe = validate();
    setErrors(fe);
    const order: (keyof FieldErrors)[] = ["name", "phone", "email", "city", "state", "whatsapp"];
    if (order.some((k) => fe[k])) {
      scrollToFirstError(fe as Record<string, string | null>, {
        name: refs.name.current,
        phone: refs.phone.current,
        email: refs.email.current,
        city: refs.city.current,
        state: refs.state.current,
        whatsapp: refs.whatsapp.current,
      }, order as string[]);
      return;
    }

    const cleanName = sanitizeText(trimSmart(form.name));
    const cleanCity = sanitizeText(trimSmart(form.city));
    const cleanState = sanitizeText(trimSmart(form.state));
    const cleanPhone = normalizePhone(form.phone);
    const cleanWhatsapp = requiredFields.whatsapp
      ? (waSameAsPhone ? cleanPhone : normalizePhone(form.whatsapp))
      : "";
    const cleanEmail = form.email ? sanitizeText(form.email.trim()) : null;

    setLoading(true);
    try {
      const { error } = await (supabase.from("funnel_leads") as any).insert({
        funnel_id: funnelId,
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        city: cleanCity || null,
        custom_value: JSON.stringify({ state: cleanState, whatsapp: cleanWhatsapp }),
        device_type: /Mobi/.test(navigator.userAgent) ? "mobile" : "desktop",
        user_agent: navigator.userAgent,
        status: "new",
        ...captureAttribution("funnel", funnelId),
      });

      if (error) throw error;

      // Lead alert (to creator) + confirmation (to prospect) via Resend.
      import("@/lib/email").then(({ sendLeadEmails }) =>
        sendLeadEmails({
          funnelId,
          prospect: { name: cleanName, email: cleanEmail, phone: cleanPhone },
        }),
      );

      localStorage.setItem(
        `nf_lead_${funnelId}`,
        JSON.stringify({ name: cleanName, phone: cleanPhone, submittedAt: Date.now() })
      );

      setShowSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2500);
    } catch (err: any) {
      console.error("[PrivateLeadForm] insert failed", err);
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const bg = isDark ? "#09090b" : "#ffffff";
  const cardBg = isDark ? "#141419" : "#f8f9fa";
  const border = isDark ? "#27272a" : "#e5e7eb";
  const text = isDark ? "#ffffff" : "#0f172a";
  const textMuted = isDark ? "#94a3b8" : "#64748b";
  const inputBg = isDark ? "#09090b" : "#f1f5f9";
  const errColor = "#ef4444";

  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bg }}>
        <div className="text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-5">
            <Check size={36} className="text-primary" />
          </div>
          <h2 className="text-2xl font-heading font-bold mb-2" style={{ color: text }}>
            Access Confirmed!
          </h2>
          <p className="text-sm mb-1" style={{ color: textMuted }}>
            Welcome to the program, {form.name.split(" ")[0]}
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Sparkles size={14} className="text-primary animate-pulse" />
            <p className="text-xs font-medium" style={{ color: textMuted }}>
              Unlocking your content…
            </p>
          </div>
        </div>
      </div>
    );
  }

  const fieldErr = (k: keyof FieldErrors) =>
    errors[k] ? (
      <p className="mt-1 text-xs" style={{ color: errColor }}>{errors[k]}</p>
    ) : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bg }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <img src={logoImg} alt="Nevorai" draggable={false} className="logo-mark-img h-9 w-9" />
          <div className="flex items-baseline text-[18px]" style={{ lineHeight: 1 }}>
            <span className="font-heading" style={{ color: text, fontStyle: "italic", fontWeight: 300 }}>n</span>
            <span className="font-heading font-extrabold" style={{ color: text }}>Flow</span>
          </div>
        </div>

        <div className="rounded-2xl p-6" style={{ background: cardBg, border: `1px solid ${border}` }}>
          <div className="text-center mb-5">
            <h3 className="text-lg font-heading font-bold mb-1" style={{ color: text }}>{funnelTitle}</h3>
            <p className="text-sm" style={{ color: textMuted }}>Enter your details to get started</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
              aria-hidden="true"
            />
            <div>
              <Label className="text-xs font-medium" style={{ color: textMuted }}>Full Name *</Label>
              <Input
                ref={refs.name}
                {...nameInputProps}
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                onBlur={(e) => setField("name", trimSmart(e.target.value))}
                placeholder="Your full name"
                className="mt-1 h-11"
                style={{ background: inputBg, borderColor: errors.name ? errColor : border, color: text }}
                aria-invalid={!!errors.name}
              />
              {fieldErr("name")}
            </div>

            <div>
              <Label className="text-xs font-medium" style={{ color: textMuted }}>Phone Number *</Label>
              <div className="mt-1">
                <NPhoneInput
                  ref={refs.phone as any}
                  value={form.phone}
                  onChange={(v: string | undefined) => setField("phone", v || "")}
                  placeholder="Phone number"
                  aria-invalid={!!errors.phone}
                  className="h-11"
                />
              </div>
              {fieldErr("phone")}
            </div>

            {requiredFields.email && (
              <div>
                <Label className="text-xs font-medium" style={{ color: textMuted }}>Email Address</Label>
                <Input
                  ref={refs.email}
                  {...emailInputProps}
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  onBlur={(e) => setField("email", e.target.value.trim())}
                  placeholder="your@email.com"
                  className="mt-1 h-11"
                  style={{ background: inputBg, borderColor: errors.email ? errColor : border, color: text }}
                  aria-invalid={!!errors.email}
                />
                {fieldErr("email")}
              </div>
            )}

            {requiredFields.city && (
              <div>
                <Label className="text-xs font-medium" style={{ color: textMuted }}>City</Label>
                <Input
                  ref={refs.city}
                  {...cityInputProps}
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                  onBlur={(e) => setField("city", trimSmart(e.target.value))}
                  placeholder="Your city"
                  className="mt-1 h-11"
                  style={{ background: inputBg, borderColor: errors.city ? errColor : border, color: text }}
                  aria-invalid={!!errors.city}
                />
                {fieldErr("city")}
              </div>
            )}

            {requiredFields.state && (
              <div>
                <Label className="text-xs font-medium" style={{ color: textMuted }}>State</Label>
                <StateSelect
                  ref={refs.state as any}
                  value={form.state}
                  onChange={(v: string) => setField("state", v)}
                  aria-invalid={!!errors.state}
                  className="mt-1 h-11"
                  style={{ background: inputBg, borderColor: errors.state ? errColor : border, color: text }}
                />
                {fieldErr("state")}
              </div>
            )}

            {requiredFields.whatsapp && (
              <div>
                <Label className="text-xs font-medium" style={{ color: textMuted }}>WhatsApp Number</Label>
                <div className="mt-1" style={{ opacity: waSameAsPhone ? 0.7 : 1 }}>
                  <NPhoneInput
                    ref={refs.whatsapp as any}
                    value={waSameAsPhone ? form.phone : form.whatsapp}
                    onChange={(v: string | undefined) => setField("whatsapp", v || "")}
                    placeholder="WhatsApp number"
                    disabled={waSameAsPhone}
                    aria-invalid={!!errors.whatsapp}
                    className="h-11"
                  />
                </div>
                <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={waSameAsPhone}
                    onChange={(e) => setWaSameAsPhone(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-xs" style={{ color: textMuted }}>Same as phone number</span>
                </label>
                {fieldErr("whatsapp")}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl mt-2"
              disabled={loading}
            >
              {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Submitting…</> : "Continue to Program →"}
            </Button>
            <PrivacyMicrocopy color={textMuted} />
          </form>
        </div>
      </div>
    </div>
  );
};
