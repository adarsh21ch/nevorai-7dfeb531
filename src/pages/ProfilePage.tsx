import { useState, useEffect } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Crown, CreditCard, FileCheck, IndianRupee,
  Bell, Settings, Download, ChevronRight, ChevronDown, Pencil,
  Sun, Moon, HelpCircle, LogOut, Shield, Infinity as InfinityIcon, GraduationCap,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { Switch } from "@/components/ui/switch";
import { Link } from "@/lib/router-compat";
import { useRouter } from "@tanstack/react-router";
import { usePlan } from "@/hooks/usePlan";
import { useAdmin } from "@/hooks/useAdmin";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { sanitizeFields, normalizePhone } from "@/lib/sanitize";
import { StorageUsageCard } from "@/components/StorageUsageCard";
import { ProfilePhotoCropModal } from "@/components/ProfilePhotoCropModal";
import { WhatsAppVerification } from "@/components/profile/WhatsAppVerification";

const ProfilePage = () => {
  useDocumentTitle("Profile");
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { plan } = usePlan();
  const { theme, toggleTheme } = useTheme();
  const { isAdmin } = useAdmin();
  const trial = useTrialStatus();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Prefetch likely-next routes from Profile so first-tap is instant.
  useEffect(() => {
    const paths = ["/billing", "/payments", "/pricing", "/kyc", "/notifications", "/settings", "/help", "/install"];
    const run = () => paths.forEach((p) => { try { void router.preloadRoute({ to: p as any }); } catch {} });
    const ric = (typeof window !== "undefined" ? (window as any).requestIdleCallback : null) as
      | ((cb: () => void, opts?: { timeout: number }) => number) | null;
    if (ric) ric(run, { timeout: 1500 }); else setTimeout(run, 200);
  }, [router]);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "", display_name: "", phone: "", city: "", address: "", bio: "", company: "",
    instagram_url: "", whatsapp_number: "",
    username: "", cta_label: "", cta_url: "",
    email: "",
  });
  const [emailSaving, setEmailSaving] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [cropFile, setCropFile] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      const p = profile as any;
      setForm({
        full_name: profile.full_name || "", display_name: p.display_name || "",
        phone: profile.phone || "", city: profile.city || "", address: p.address || "",
        bio: profile.bio || "", company: profile.company || "",
        instagram_url: profile.instagram_url || "", whatsapp_number: profile.whatsapp_number || "",
        username: p.username || "", cta_label: p.cta_label || "", cta_url: p.cta_url || "",
        email: profile.email || "",
      });
      setAvatarUrl(profile.avatar_url || null);
    }

  }, [profile]);

  // Username uniqueness check (debounced)
  useEffect(() => {
    const u = form.username.trim().toLowerCase();
    if (!u) { setUsernameStatus("idle"); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(u)) { setUsernameStatus("invalid"); return; }
    if ((profile as any)?.username === u) { setUsernameStatus("available"); return; }
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      const { data } = await (supabase as any)
        .from("profiles").select("id").eq("username", u).maybeSingle();
      setUsernameStatus(data ? "taken" : "available");
    }, 400);
    return () => clearTimeout(t);
  }, [form.username, profile]);

  const handleSave = async () => {
    if (!user) return;
    if (form.username && usernameStatus !== "available") {
      toast.error("Fix username before saving"); return;
    }
    if (form.cta_url && !/^https?:\/\/|^mailto:|^tel:|^wa\.me/i.test(form.cta_url)) {
      toast.error("CTA URL must start with https://, mailto:, tel: or wa.me"); return;
    }
    const cleanForm = sanitizeFields(form, [
      "full_name", "display_name", "city", "address", "bio", "company", "instagram_url", "cta_label",
    ]) as any;
    cleanForm.phone = normalizePhone(form.phone);
    // whatsapp_number changes only via OTP re-verification, never via this form.
    delete cleanForm.whatsapp_number;
    delete cleanForm.email;
    cleanForm.username = form.username.trim().toLowerCase() || null;
    cleanForm.cta_url = form.cta_url.trim() || null;
    cleanForm.cta_label = (cleanForm.cta_label || "").slice(0, 30) || null;
    setLoading(true);
    const { error } = await (supabase as any).from("profiles").update(cleanForm).eq("id", user.id);
    setLoading(false);
    if (error) { toast.error(error.message || "Failed to save"); return; }
    await refreshProfile();
    toast.success("Profile updated!");
  };

  const handleEmailChange = async () => {
    const newEmail = form.email.trim().toLowerCase();
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast.error("Enter a valid email"); return;
    }
    if (newEmail === (profile?.email || "").toLowerCase()) {
      toast.info("That's your current email."); return;
    }
    setEmailSaving(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailSaving(false);
    if (error) { toast.error(error.message || "Could not update email"); return; }
    toast.success("Check both inboxes — Supabase sent a confirmation link.");
  };


  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      toast.error("Use JPG, PNG or WebP"); return;
    }
    if (f.size > 5 * 1024 * 1024) { toast.error("Max 5 MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setCropFile(reader.result as string);
    reader.readAsDataURL(f);
  };

  const removePhoto = async () => {
    if (!user) return;
    if (!confirm("Remove your profile photo?")) return;
    await (supabase as any).from("profiles").update({ avatar_url: null }).eq("id", user.id);
    setAvatarUrl(null);
    await refreshProfile();
    toast.success("Photo removed");
  };

  const initials = (profile?.full_name || "U")
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const tier = plan.tier;
  const isPro = tier === "pro";
  const isBasic = tier === "basic";
  const trialDaysLeft = trial.daysRemaining ?? 0;
  const isActiveTrial =
    (tier === "trial" || trial.subscriptionStatus === "trial") &&
    !trial.isTrialExpired &&
    trialDaysLeft > 0;
  const planLabel = isPro
    ? "Pro Plan"
    : isBasic
    ? "Basic Plan"
    : isActiveTrial
    ? `Trial · ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left`
    : "Free Plan";

  const accountItems = [
    { icon: FileCheck, label: "Get Verified", path: "/kyc", desc: "KYC for payouts" },
    { icon: CreditCard, label: "Billing", path: "/billing", desc: "Subscription & invoices" },
    ...(!isPro ? [{ icon: Crown, label: "Upgrade to Pro", path: "/pricing", desc: "Unlock everything" }] : []),
    { icon: IndianRupee, label: "Payments", path: "/payments", desc: "Customer payments & history" },
  ];

  const preferenceItems = [
    { icon: Bell, label: "Notifications", path: "/notifications", desc: "Alerts & updates" },
    { icon: Settings, label: "Settings", path: "/settings", desc: "App preferences" },
  ];

  const supportItems = [
    { icon: HelpCircle, label: "Nevorai Academy", path: "/help", desc: "Tutorials, FAQs and contact support" },
    { icon: Download, label: "Install App", path: "/install", desc: "Add to home screen" },
  ];

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{children}</p>
  );

  const Row = ({ icon: Icon, label, path, desc, danger }: any) => (
    <Link to={path}
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${danger ? "bg-destructive/10" : "bg-muted"}`}>
        <Icon size={14} className={danger ? "text-destructive" : "text-muted-foreground"} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${danger ? "text-destructive" : ""}`}>{label}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
      <ChevronRight size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
    </Link>
  );

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-5">
        {/* PROFILE HEADER */}
        <div className="premium-card p-5">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-full bg-foreground border-2 border-foreground flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-heading font-bold text-background">{initials}</span>
                )}
              </div>
              <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-md hover:scale-105 transition-transform" title="Change photo">
                <Pencil size={12} />
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickPhoto} />
              </label>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-heading font-bold text-lg truncate">{profile?.full_name || "User"}</h2>
              <p className="text-sm text-muted-foreground truncate">{profile?.email}</p>
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5">
                <Crown size={11} className="text-primary" />
                <span className="text-[11px] font-semibold text-primary">{planLabel}</span>
                {isPro && <InfinityIcon size={12} className="text-primary" />}
              </div>
              {avatarUrl && (
                <button onClick={removePhoto} className="block mt-1.5 text-[11px] text-muted-foreground hover:text-destructive underline">
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* NEVORAI ACADEMY HIGHLIGHT */}
        <Link
          to="/help"
          className="group block rounded-xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card p-4 transition-all hover:border-primary/70 hover:shadow-lg"
          style={{ boxShadow: "0 6px 24px -10px color-mix(in oklab, var(--accent-saffron) 55%, transparent), 0 0 0 1px color-mix(in oklab, var(--accent-saffron) 25%, transparent)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <GraduationCap size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">Nevorai Academy</p>
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">New</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Free tutorials to master every feature. Watch and tick them off.</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground group-hover:text-foreground" />
          </div>
        </Link>
        {cropFile && user && (
          <ProfilePhotoCropModal
            open={!!cropFile}
            onClose={() => setCropFile(null)}
            imageSrc={cropFile}
            userId={user.id}
            onSaved={(url: string) => { setAvatarUrl(url); refreshProfile(); }}
          />
        )}

        {/* ACCOUNT */}
        <div className="premium-card p-2 space-y-0.5">
          <SectionLabel>Account</SectionLabel>

          {/* Edit Profile — collapsible */}
          <Collapsible open={editOpen} onOpenChange={setEditOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Pencil size={14} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Edit Profile</p>
                  <p className="text-[10px] text-muted-foreground">Name, phone, bio and socials</p>
                </div>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform ${editOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 pt-2 space-y-4 border-t border-border mt-2">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><Label className="text-xs">Full Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1 bg-muted border-border" /></div>
                  <div>
                    <Label className="text-xs">Display Name <span className="text-muted-foreground">(shown publicly)</span></Label>
                    <Input value={form.display_name} maxLength={60} placeholder={form.full_name || "Channel name"} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="mt-1 bg-muted border-border" />
                  </div>
                  <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 bg-muted border-border" /></div>
                  <div><Label className="text-xs">City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1 bg-muted border-border" /></div>
                  <div className="sm:col-span-2"><Label className="text-xs">Address</Label><Input value={form.address} maxLength={200} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1 bg-muted border-border" /></div>
                  <div><Label className="text-xs">Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="mt-1 bg-muted border-border" /></div>
                  <div className="sm:col-span-2 text-[11px] text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                    Verified badge is granted after KYC review.
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Email <span className="text-muted-foreground">(used for login)</span></Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="bg-muted border-border"
                      />
                      <Button variant="outline" size="sm" onClick={handleEmailChange} disabled={emailSaving || form.email === (profile?.email || "")}>
                        {emailSaving ? "Saving…" : "Change"}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Supabase will email a confirmation link to both addresses.</p>
                  </div>

                  <div><Label className="text-xs">Instagram URL</Label><Input value={form.instagram_url} onChange={(e) => setForm({ ...form, instagram_url: e.target.value })} className="mt-1 bg-muted border-border" /></div>
                  <div>
                    <Label className="text-xs">Username</Label>
                    <Input
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                      placeholder="yourname"
                      maxLength={20}
                      className="mt-1 bg-muted border-border"
                    />
                    {form.username && (
                      <span className={`text-[10px] ${usernameStatus === "available" ? "text-success" : usernameStatus === "taken" || usernameStatus === "invalid" ? "text-destructive" : "text-muted-foreground"}`}>
                        {usernameStatus === "checking" && "Checking…"}
                        {usernameStatus === "available" && "Available ✓"}
                        {usernameStatus === "taken" && "Taken ✗"}
                        {usernameStatus === "invalid" && "3–20 chars, a–z, 0–9, _"}
                      </span>
                    )}
                  </div>
                </div>
                <div><Label className="text-xs">Bio</Label><Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value.slice(0, 160) })} className="mt-1 bg-muted border-border" rows={2} maxLength={160} /><span className="text-[10px] text-muted-foreground">{form.bio.length}/160</span></div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">CTA Label</Label>
                    <Input value={form.cta_label} maxLength={30} placeholder="e.g., Book a Call" onChange={(e) => setForm({ ...form, cta_label: e.target.value })} className="mt-1 bg-muted border-border" />
                  </div>
                  <div>
                    <Label className="text-xs">CTA URL</Label>
                    <Input value={form.cta_url} placeholder="https://…" onChange={(e) => setForm({ ...form, cta_url: e.target.value })} className="mt-1 bg-muted border-border" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground -mt-2">Shown as a button on all your video previews.</p>
                <Button variant="hero" size="sm" onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save Profile"}</Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {accountItems.map((item) => <Row key={item.path} {...item} />)}
        </div>

        {/* Storage Usage */}
        <StorageUsageCard />

        {/* WhatsApp Notifications */}
        <WhatsAppVerification />

        {/* PREFERENCES */}
        <div className="premium-card p-2 space-y-0.5">
          <SectionLabel>Preferences</SectionLabel>
          <div className="flex items-center justify-between rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                {theme === "dark" ? <Moon size={14} className="text-muted-foreground" /> : <Sun size={14} className="text-muted-foreground" />}
              </div>
              <div>
                <p className="text-sm font-medium">{theme === "dark" ? "Dark mode" : "Light mode"}</p>
                <p className="text-[10px] text-muted-foreground">Switch your interface theme</p>
              </div>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} aria-label="Toggle dark mode" />
          </div>
          {preferenceItems.map((item) => <Row key={item.path} {...item} />)}
        </div>

        {/* SUPPORT */}
        <div className="premium-card p-2 space-y-0.5">
          <SectionLabel>Support</SectionLabel>
          {supportItems.map((item) => <Row key={item.path} {...item} />)}
        </div>

        {/* ADMIN — only for admins */}
        {isAdmin && (
          <div className="premium-card p-2 space-y-0.5">
            <SectionLabel>Admin</SectionLabel>
            <Row icon={Shield} label="Admin Panel" path="/admin" desc="Manage users, plans, and system settings" />
          </div>
        )}

        {/* LOGOUT */}
        <div className="premium-card p-2">
          <button
            onClick={async () => { await signOut(); }}
            className="flex w-full items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-destructive/10 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <LogOut size={14} className="text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">Logout</p>
              <p className="text-[10px] text-muted-foreground">Sign out of your account</p>
            </div>
          </button>
        </div>

        {/* FOOTER */}
        <p className="pt-2 pb-6 text-center text-[11px] text-muted-foreground">
          Nevorai · v1.0 · Made with <span aria-hidden>❤️</span> in India
        </p>

        {/* Floating Upgrade CTA removed — duplicate of inline "Upgrade for more storage" in StorageUsageCard */}
      </div>
    </DashboardLayout>
  );
};

export default ProfilePage;
