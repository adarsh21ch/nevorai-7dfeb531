import { useState, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeText } from "@/lib/sanitize";
import {
  Shield, Check, X, Clock, Upload, FileText, CreditCard,
  ChevronRight, ChevronLeft, Eye, BadgeCheck, MapPin, Loader2,
} from "lucide-react";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu & Kashmir", "Ladakh", "Chandigarh", "Puducherry",
];

const maskPan = (pan: string) => pan.length >= 10 ? `${pan.slice(0, 5)}****${pan.slice(-1)}` : pan;
const maskAadhar = (a: string) => a.length >= 12 ? `XXXX XXXX ${a.slice(-4)}` : a;

const KYCPage = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    full_name: profile?.full_name || "",
    city: profile?.city || "",
    state: "",
    doc_type: "" as "" | "pan" | "aadhaar",
    pan_number: "",
    aadhar_number: "",
    doc_image_url: "",
    doc_file_name: "",
  });

  const { data: kyc } = useQuery({
    queryKey: ["kyc", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_kyc_submissions")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const handleFileUpload = async (file: File) => {
    if (!user || !file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Max 5MB.");
      return;
    }
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("Please upload an image or PDF file.");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${form.doc_type}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("kyc-documents")
      .upload(path, file, { upsert: true });

    if (error) {
      toast.error("Upload failed. Please try again.");
      setUploading(false);
      return;
    }

    setForm((f) => ({ ...f, doc_image_url: path, doc_file_name: file.name }));
    setUploading(false);
    toast.success("Document uploaded!");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const submitKyc = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        user_id: user!.id,
        full_name: sanitizeText(form.full_name),
        city: sanitizeText(form.city),
        state: sanitizeText(form.state),
        doc_type: form.doc_type,
        doc_image_url: form.doc_image_url,
        status: "pending",
      };
      if (form.doc_type === "pan") {
        payload.pan_number = form.pan_number;
        payload.aadhar_number = null;
      } else {
        payload.aadhar_number = form.aadhar_number;
        payload.pan_number = null;
      }
      const { error } = await supabase
        .from("user_kyc_submissions")
        .upsert(payload as any, { onConflict: "user_id" });
      if (error) throw error;

      // Update profile kyc_status to pending
      await supabase.from("profiles").update({ kyc_status: "pending" }).eq("id", user!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc"] });
      toast.success("Verification submitted! We'll review it within 1-2 business days.");
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  });

  // Validation per step
  const canProceedStep1 = form.full_name.trim() && form.city.trim() && form.state;
  const canProceedStep2 =
    form.doc_type &&
    form.doc_image_url &&
    (form.doc_type === "pan" ? /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.pan_number) : form.aadhar_number.length === 12);

  const statusBanner = () => {
    if (!kyc)
      return (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Shield className="text-primary" size={20} />
          </div>
          <div>
            <p className="font-heading font-semibold text-sm">Build Trust with Your Leads</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Complete a quick identity check to get a verified badge on your flow pages. Takes less than 2 minutes.
            </p>
          </div>
        </div>
      );
    if (kyc.status === "pending")
      return (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <Clock className="text-amber-500" size={20} />
          </div>
          <div>
            <p className="font-heading font-semibold text-sm">Verification Under Review</p>
            <p className="text-xs text-muted-foreground mt-1">Your documents are being reviewed. This usually takes 1-2 business days.</p>
          </div>
        </div>
      );
    if (kyc.status === "approved")
      return (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <BadgeCheck className="text-emerald-500" size={20} />
          </div>
          <div>
            <p className="font-heading font-semibold text-sm flex items-center gap-2">
              Verified Creator <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">VERIFIED</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Your identity has been verified. A trust badge is shown on your public flows.</p>
          </div>
        </div>
      );
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
          <X className="text-destructive" size={20} />
        </div>
        <div>
          <p className="font-heading font-semibold text-sm">Verification Unsuccessful</p>
          <p className="text-xs text-muted-foreground mt-1">
            {kyc.rejection_reason ? `Reason: ${kyc.rejection_reason}` : "Your submission was not approved."} Please re-submit with correct details.
          </p>
        </div>
      </div>
    );
  };

  const showForm = !kyc || kyc.status === "rejected";

  return (
    <DashboardLayout>
      <div className="max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold">Get Verified</h1>
          <div className="page-header-accent" />
          <p className="text-sm text-muted-foreground mt-1">Verify your identity to build more trust with your leads.</p>
        </div>

        {statusBanner()}

        {showForm && (
          <div className="glass-card p-6 sm:p-8">
            {/* Progress */}
            <div className="flex items-center gap-3 mb-8">
              {[
                { n: 1, label: "Details" },
                { n: 2, label: "Document" },
                { n: 3, label: "Review" },
              ].map((s, i) => (
                <div key={s.n} className="flex items-center gap-3 flex-1">
                  <div className="flex items-center gap-2 flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        s.n < step
                          ? "bg-primary text-primary-foreground"
                          : s.n === step
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {s.n < step ? <Check size={14} /> : s.n}
                    </div>
                    <span className={`text-xs font-medium hidden sm:block ${s.n <= step ? "text-foreground" : "text-muted-foreground"}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div className={`h-px flex-1 ${s.n < step ? "bg-primary" : "bg-border"}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: Personal Details */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-heading font-semibold text-lg">Personal Details</h3>
                  <p className="text-xs text-muted-foreground mt-1">We need a few basic details to verify your identity.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium">Full Legal Name <span className="text-destructive">*</span></Label>
                    <Input
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      placeholder="As it appears on your ID"
                      className="mt-1.5 h-11 bg-muted border-border"
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium">City <span className="text-destructive">*</span></Label>
                      <Input
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        placeholder="Your city"
                        className="mt-1.5 h-11 bg-muted border-border"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">State <span className="text-destructive">*</span></Label>
                      <select
                        value={form.state}
                        onChange={(e) => setForm({ ...form, state: e.target.value })}
                        className="mt-1.5 w-full h-11 rounded-md bg-muted border border-border px-3 text-sm text-foreground"
                      >
                        <option value="">Select state</option>
                        {INDIAN_STATES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Identity Document */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-heading font-semibold text-lg">Identity Verification</h3>
                  <p className="text-xs text-muted-foreground mt-1">Choose one document to verify your identity.</p>
                </div>

                {/* Doc type selector */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "pan" as const, label: "PAN Card", icon: CreditCard },
                    { value: "aadhaar" as const, label: "Aadhaar Card", icon: FileText },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setForm({ ...form, doc_type: opt.value })}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        form.doc_type === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <opt.icon size={20} className={form.doc_type === opt.value ? "text-primary" : "text-muted-foreground"} />
                      <p className="text-sm font-medium mt-2">{opt.label}</p>
                    </button>
                  ))}
                </div>

                {/* Doc number input */}
                {form.doc_type === "pan" && (
                  <div>
                    <Label className="text-xs font-medium">PAN Number <span className="text-destructive">*</span></Label>
                    <Input
                      value={form.pan_number}
                      onChange={(e) => setForm({ ...form, pan_number: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      className="mt-1.5 h-11 bg-muted border-border font-mono tracking-wider"
                    />
                    {form.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.pan_number) && (
                      <p className="text-[11px] text-amber-500 mt-1">Format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)</p>
                    )}
                  </div>
                )}
                {form.doc_type === "aadhaar" && (
                  <div>
                    <Label className="text-xs font-medium">Aadhaar Number <span className="text-destructive">*</span></Label>
                    <Input
                      value={form.aadhar_number.replace(/(\d{4})(?=\d)/g, "$1 ").trim()}
                      onChange={(e) => setForm({ ...form, aadhar_number: e.target.value.replace(/\D/g, "").slice(0, 12) })}
                      placeholder="1234 5678 9012"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={14}
                      className="mt-1.5 h-11 bg-muted border-border font-mono tracking-wider"
                    />
                    {form.aadhar_number && form.aadhar_number.length < 12 && (
                      <p className="text-[11px] text-amber-500 mt-1">Aadhaar number must be 12 digits</p>
                    )}
                  </div>
                )}

                {/* File upload */}
                {form.doc_type && (
                  <div>
                    <Label className="text-xs font-medium">Upload {form.doc_type === "pan" ? "PAN" : "Aadhaar"} Card Image <span className="text-destructive">*</span></Label>
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`mt-1.5 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                        form.doc_image_url
                          ? "border-primary/30 bg-primary/5"
                          : "border-border hover:border-muted-foreground/40 hover:bg-muted/50"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                      />
                      {uploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 size={24} className="text-primary animate-spin" />
                          <p className="text-xs text-muted-foreground">Uploading...</p>
                        </div>
                      ) : form.doc_image_url ? (
                        <div className="flex flex-col items-center gap-2">
                          <Check size={24} className="text-primary" />
                          <p className="text-xs font-medium text-foreground">{form.doc_file_name || "Document uploaded"}</p>
                          <p className="text-[11px] text-muted-foreground">Click to replace</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload size={24} className="text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            Drag & drop or <span className="text-primary font-medium">browse</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">JPG, PNG or PDF · Max 5MB</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-heading font-semibold text-lg">Review & Submit</h3>
                  <p className="text-xs text-muted-foreground mt-1">Please verify your details before submitting.</p>
                </div>
                <div className="rounded-xl border border-border divide-y divide-border">
                  {[
                    { label: "Full Name", value: form.full_name },
                    { label: "City", value: form.city },
                    { label: "State", value: form.state },
                    { label: "Document Type", value: form.doc_type === "pan" ? "PAN Card" : "Aadhaar Card" },
                    {
                      label: "Document Number",
                      value: form.doc_type === "pan" ? maskPan(form.pan_number) : maskAadhar(form.aadhar_number),
                    },
                    { label: "Document Upload", value: form.doc_file_name || "Uploaded ✓" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs text-muted-foreground">{row.label}</span>
                      <span className="text-sm font-medium text-foreground">{row.value}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl bg-muted/50 border border-border p-4">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    🔒 Your documents are encrypted and stored securely. They are only used for identity verification and will not be shared with anyone.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-8">
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(step - 1)} className="gap-1.5">
                  <ChevronLeft size={14} /> Back
                </Button>
              )}
              <div className="flex-1" />
              {step < 3 ? (
                <Button
                  variant="default"
                  onClick={() => setStep(step + 1)}
                  disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
                  className="gap-1.5"
                >
                  Next <ChevronRight size={14} />
                </Button>
              ) : (
                <Button
                  variant="default"
                  onClick={() => submitKyc.mutate()}
                  disabled={submitKyc.isPending}
                  className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground px-6"
                >
                  {submitKyc.isPending ? (
                    <><Loader2 size={14} className="animate-spin" /> Submitting...</>
                  ) : (
                    <>Submit for Verification <Check size={14} /></>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default KYCPage;
