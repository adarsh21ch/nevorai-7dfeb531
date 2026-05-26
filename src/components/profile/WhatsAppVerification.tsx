import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Check, MessageCircle } from "lucide-react";

export const WhatsAppVerification = () => {
  const { user, profile, refreshProfile } = useAuth();
  const p = profile as any;
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"input" | "otp" | "verified">("input");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (p?.whatsapp_verified && p.whatsapp_number) {
      setPhone(p.whatsapp_number);
      setStep("verified");
    } else if (p?.whatsapp_number) {
      setPhone(p.whatsapp_number);
    }
  }, [p?.whatsapp_verified, p?.whatsapp_number]);

  const sendOtp = async () => {
    const clean = phone.replace(/\D/g, "");
    if (clean.length < 10) { toast.error("Enter a valid phone"); return; }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-send-otp", {
      body: { phone_number: clean, user_id: user?.id },
    });
    setLoading(false);
    // Read JSON from error.context when non-2xx so we get the real message
    let payload: any = data;
    if (!payload && error && (error as any).context?.json) {
      try { payload = await (error as any).context.json(); } catch { /* noop */ }
    }
    if (error || payload?.error) {
      toast.error(payload?.message || payload?.error || "Failed to send OTP");
      return;
    }
    toast.success("OTP sent on WhatsApp");
    setStep("otp");
  };


  const verifyOtp = async () => {
    const clean = phone.replace(/\D/g, "");
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-verify-otp", {
      body: { phone_number: clean, code: otp.trim() },
    });
    if (error || !data?.verified) {
      setLoading(false);
      toast.error("Wrong OTP, try again");
      return;
    }
    await supabase.from("profiles" as any)
      .update({ whatsapp_number: clean, whatsapp_verified: true })
      .eq("id", user!.id);
    await refreshProfile();
    setLoading(false);
    setStep("verified");
    toast.success("WhatsApp verified!");
  };

  const changeNumber = () => { setStep("input"); setOtp(""); };

  return (
    <div className="premium-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircle size={16} className="text-primary" />
        <h3 className="text-sm font-semibold">WhatsApp Notifications</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Get instant WhatsApp alerts when new leads register on your landing pages.
      </p>

      {step === "verified" ? (
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <Check size={12} /> WhatsApp Verified — +91 {phone.replace(/\D/g, "").slice(-10)}
          </div>
          <Button variant="outline" size="sm" onClick={changeNumber}>Change</Button>
        </div>
      ) : step === "otp" ? (
        <div className="space-y-2">
          <Label className="text-xs">Enter the 6-digit OTP</Label>
          <div className="flex gap-2">
            <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" maxLength={6} className="bg-muted border-border" />
            <Button onClick={verifyOtp} disabled={loading || otp.length < 4}>Verify</Button>
          </div>
          <button onClick={() => setStep("input")} className="text-xs text-muted-foreground hover:text-foreground underline">Change number</button>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-xs">WhatsApp Number</Label>
          <div className="flex gap-2">
            <span className="inline-flex items-center px-2 rounded-md bg-muted text-xs">+91</span>
            <Input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="9876543210" maxLength={10} className="bg-muted border-border" />
            <Button onClick={sendOtp} disabled={loading || phone.replace(/\D/g, "").length < 10}>Send OTP</Button>
          </div>
        </div>
      )}
    </div>
  );
};
