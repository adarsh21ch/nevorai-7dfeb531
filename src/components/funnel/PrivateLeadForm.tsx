import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoImg from "@/assets/nevorai-flow-logo.png";
import { sanitizeText, normalizePhone, isValidPhone } from "@/lib/sanitize";

interface PrivateLeadFormProps {
  funnelId: string;
  funnelTitle: string;
  requiredFields: { email: boolean; city: boolean; state: boolean; whatsapp: boolean };
  onSuccess: () => void;
  isDark: boolean;
}

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (website.trim() !== "") {
      console.warn("[PrivateLeadForm] honeypot triggered");
      setShowSuccess(true);
      setTimeout(() => onSuccess(), 1500);
      return;
    }
    if (Date.now() - formMountedAt < 2000) {
      console.warn("[PrivateLeadForm] submit-too-fast trap");
      setShowSuccess(true);
      setTimeout(() => onSuccess(), 1500);
      return;
    }

    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    if (!isValidPhone(form.phone)) {
      toast.error("Please enter a valid phone number");
      return;
    }

    const cleanName = sanitizeText(form.name);
    const cleanCity = sanitizeText(form.city);
    const cleanState = sanitizeText(form.state);
    const cleanPhone = normalizePhone(form.phone);
    const cleanWhatsapp = normalizePhone(form.whatsapp);
    const cleanEmail = form.email ? sanitizeText(form.email) : null;

    setLoading(true);
    try {
      const { error } = await supabase.from("funnel_leads").insert({
        funnel_id: funnelId,
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        city: cleanCity || null,
        custom_value: JSON.stringify({ state: cleanState, whatsapp: cleanWhatsapp }),
        device_type: /Mobi/.test(navigator.userAgent) ? "mobile" : "desktop",
        user_agent: navigator.userAgent,
        status: "new",
      });

      if (error) throw error;

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bg }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <img src={logoImg} alt="nFlow by Nevorai" className="h-6 w-6" />
          <div className="flex items-baseline text-[14px]" style={{ lineHeight: 1 }}>
            <span className="font-heading" style={{ color: text, fontStyle: "italic", fontWeight: 300 }}>n</span>
            <span className="font-heading font-extrabold" style={{ color: text }}>Flow</span>
          </div>
        </div>

        <div className="rounded-2xl p-6" style={{ background: cardBg, border: `1px solid ${border}` }}>
          <div className="text-center mb-5">
            <h3 className="text-lg font-heading font-bold mb-1" style={{ color: text }}>{funnelTitle}</h3>
            <p className="text-sm" style={{ color: textMuted }}>Enter your details to get started</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
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
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your full name"
                required
                className="mt-1 h-11"
                style={{ background: inputBg, borderColor: border, color: text }}
              />
            </div>

            <div>
              <Label className="text-xs font-medium" style={{ color: textMuted }}>Phone Number *</Label>
              <div className="flex gap-2 mt-1">
                <div className="flex items-center px-3 rounded-md text-sm shrink-0 h-11" style={{ background: inputBg, border: `1px solid ${border}`, color: textMuted }}>+91</div>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="9876543210"
                  required
                  className="h-11"
                  style={{ background: inputBg, borderColor: border, color: text }}
                />
              </div>
            </div>

            {requiredFields.email && (
              <div>
                <Label className="text-xs font-medium" style={{ color: textMuted }}>Email Address</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="your@email.com"
                  className="mt-1 h-11"
                  style={{ background: inputBg, borderColor: border, color: text }}
                />
              </div>
            )}

            {requiredFields.city && (
              <div>
                <Label className="text-xs font-medium" style={{ color: textMuted }}>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Your city"
                  className="mt-1 h-11"
                  style={{ background: inputBg, borderColor: border, color: text }}
                />
              </div>
            )}

            {requiredFields.state && (
              <div>
                <Label className="text-xs font-medium" style={{ color: textMuted }}>State</Label>
                <Input
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  placeholder="Your state"
                  className="mt-1 h-11"
                  style={{ background: inputBg, borderColor: border, color: text }}
                />
              </div>
            )}

            {requiredFields.whatsapp && (
              <div>
                <Label className="text-xs font-medium" style={{ color: textMuted }}>WhatsApp Number</Label>
                <Input
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="WhatsApp number"
                  className="mt-1 h-11"
                  style={{ background: inputBg, borderColor: border, color: text }}
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl mt-2"
              disabled={loading}
            >
              {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Unlocking access...</> : "Continue to Program →"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
