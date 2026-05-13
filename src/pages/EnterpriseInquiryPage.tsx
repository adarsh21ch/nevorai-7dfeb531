import { useState } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Crown, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "@/lib/router-compat";
import { sanitizeText, normalizePhone } from "@/lib/sanitize";

const TEAM_SIZES = ["100-500", "500-1000", "1000-5000", "5000+"];

interface FormState {
  full_name: string;
  whatsapp_phone: string;
  email: string;
  network_name: string;
  team_size: string;
  platform: string;
  custom_needs: string;
}

const empty: FormState = {
  full_name: "",
  whatsapp_phone: "",
  email: "",
  network_name: "",
  team_size: "",
  platform: "",
  custom_needs: "",
};

const EnterpriseInquiryPage = () => {
  const [form, setForm] = useState<FormState>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const update = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!form.full_name.trim()) e.full_name = "Required";
    if (!form.whatsapp_phone.trim()) e.whatsapp_phone = "Required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Valid email required";
    if (!form.network_name.trim()) e.network_name = "Required";
    if (!form.team_size) e.team_size = "Pick a range";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    setSubmitting(true);
    try {
      // Sanitize all text fields client-side; server mirror will re-sanitize.
      const cleanForm = {
        full_name: sanitizeText(form.full_name),
        whatsapp_phone: normalizePhone(form.whatsapp_phone),
        email: sanitizeText(form.email),
        network_name: sanitizeText(form.network_name),
        team_size: form.team_size,
        platform: sanitizeText(form.platform),
        custom_needs: sanitizeText(form.custom_needs),
      };
      const { data, error } = await supabase.functions.invoke(
        "submit-enterprise-inquiry",
        { body: cleanForm },
      );
      if (error || !data?.ok) {
        const fields = (data as any)?.fields;
        if (fields && typeof fields === "object") {
          setErrors(fields);
          toast.error("Please check the highlighted fields.");
        } else {
          toast.error("Could not submit. Please try again.");
        }
        return;
      }
      setSubmitted(true);
      setForm(empty);
    } catch (err: any) {
      toast.error(err?.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <div className="container-app max-w-5xl">
          {/* Header */}
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/15 to-yellow-500/15 border border-amber-500/30 text-xs font-semibold text-amber-500 mb-4">
              <Crown size={14} /> Enterprise — For Large Networks
            </div>
            <h1 className="text-3xl md:text-5xl font-heading font-bold mb-3">
              Your own branded app.<br />
              <span className="gradient-text">Built for your team.</span>
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
              For team leaders with 1,000+ active members. We build a separate
              white-label app with your branding, plus all nFlow by Nevorai features and
              custom additions for your network.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-start">
            {/* What you get */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-6 md:p-8 space-y-4"
            >
              <div className="flex items-center gap-2 text-amber-500 mb-2">
                <Sparkles size={18} />
                <h2 className="text-lg font-heading font-semibold">What you get</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Everything in the Leaders plan, plus a custom-built app
                experience designed exclusively for your network.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  "Your own white-label mobile app (your brand, your logo)",
                  "Custom features built for your network",
                  "Dedicated onboarding support",
                  "Direct WhatsApp support line",
                  "Custom domain for your app",
                  "Team admin dashboard",
                  "Priority feature requests",
                  "Everything in Leaders plan",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <CheckCircle2
                      size={16}
                      className="text-amber-500 shrink-0 mt-0.5"
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-4 mt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">Starting at</p>
                <p className="text-2xl font-heading font-bold">
                  ₹5,999<span className="text-sm text-muted-foreground font-normal">/month</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Final pricing depends on the scope of customizations.
                </p>
              </div>
            </motion.div>

            {/* Inquiry form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card p-6 md:p-8"
            >
              {submitted ? (
                <div className="text-center py-12 space-y-4">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-success/10">
                    <CheckCircle2 className="text-success" size={28} />
                  </div>
                  <h3 className="text-xl font-heading font-semibold">Thank you!</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    We'll contact you on WhatsApp within 24 hours to discuss
                    your custom app.
                  </p>
                  <div className="flex gap-2 justify-center pt-2">
                    <Link to="/">
                      <Button variant="outline">Back to home</Button>
                    </Link>
                    <Button onClick={() => setSubmitted(false)}>
                      Submit another
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h3 className="text-lg font-heading font-semibold mb-1">
                    Book a Call
                  </h3>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Tell us about your network. We respond within 24 hours.
                  </p>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="full_name" className="text-xs">
                        Full Name *
                      </Label>
                      <Input
                        id="full_name"
                        value={form.full_name}
                        onChange={(e) => update("full_name", e.target.value)}
                        className="mt-1"
                        aria-invalid={!!errors.full_name}
                      />
                      {errors.full_name && (
                        <p className="text-[11px] text-destructive mt-0.5">{errors.full_name}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="whatsapp_phone" className="text-xs">
                        WhatsApp Number *
                      </Label>
                      <Input
                        id="whatsapp_phone"
                        type="tel"
                        value={form.whatsapp_phone}
                        onChange={(e) => update("whatsapp_phone", e.target.value)}
                        className="mt-1"
                        placeholder="+91 ..."
                        aria-invalid={!!errors.whatsapp_phone}
                      />
                      {errors.whatsapp_phone && (
                        <p className="text-[11px] text-destructive mt-0.5">{errors.whatsapp_phone}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-xs">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      className="mt-1"
                      aria-invalid={!!errors.email}
                    />
                    {errors.email && (
                      <p className="text-[11px] text-destructive mt-0.5">{errors.email}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="network_name" className="text-xs">
                      Your Network / Company Name *
                    </Label>
                    <Input
                      id="network_name"
                      value={form.network_name}
                      onChange={(e) => update("network_name", e.target.value)}
                      className="mt-1"
                      aria-invalid={!!errors.network_name}
                    />
                    {errors.network_name && (
                      <p className="text-[11px] text-destructive mt-0.5">{errors.network_name}</p>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Approximate team size *</Label>
                      <Select
                        value={form.team_size}
                        onValueChange={(v) => update("team_size", v)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                        <SelectContent>
                          {TEAM_SIZES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.team_size && (
                        <p className="text-[11px] text-destructive mt-0.5">{errors.team_size}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="platform" className="text-xs">
                        Which platform are you on?
                      </Label>
                      <Input
                        id="platform"
                        value={form.platform}
                        onChange={(e) => update("platform", e.target.value)}
                        className="mt-1"
                        placeholder="e.g. Vestige, Amway, ..."
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="custom_needs" className="text-xs">
                      What custom features do you need?
                    </Label>
                    <Textarea
                      id="custom_needs"
                      value={form.custom_needs}
                      onChange={(e) => update("custom_needs", e.target.value)}
                      className="mt-1 min-h-[90px]"
                      placeholder="Optional — anything specific you'd like in your app."
                    />
                  </div>

                  <Button type="submit" className="w-full gap-2" disabled={submitting}>
                    {submitting && <Loader2 size={16} className="animate-spin" />}
                    Submit Inquiry
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    By submitting, you agree to be contacted by our team on WhatsApp & email.
                  </p>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default EnterpriseInquiryPage;
