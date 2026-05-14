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
  Crown, ArrowRight, CreditCard, FileCheck, IndianRupee,
  Bell, Settings, Download, ChevronRight, ChevronDown, Pencil,
  Sun, Moon, HelpCircle, LogOut, Shield, Infinity as InfinityIcon,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { Switch } from "@/components/ui/switch";
import { Link } from "@/lib/router-compat";
import { usePlan } from "@/hooks/usePlan";
import { useAdmin } from "@/hooks/useAdmin";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { sanitizeFields, normalizePhone } from "@/lib/sanitize";
import { StorageUsageCard } from "@/components/StorageUsageCard";

const ProfilePage = () => {
  useDocumentTitle("Profile");
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { plan } = usePlan();
  const { theme, toggleTheme } = useTheme();
  const { isAdmin } = useAdmin();
  const trial = useTrialStatus();
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "", phone: "", city: "", bio: "", company: "",
    instagram_url: "", whatsapp_number: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "", phone: profile.phone || "", city: profile.city || "",
        bio: profile.bio || "", company: profile.company || "",
        instagram_url: profile.instagram_url || "", whatsapp_number: profile.whatsapp_number || "",
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    const cleanForm = sanitizeFields(form, [
      "full_name", "city", "bio", "company", "instagram_url",
    ]);
    cleanForm.phone = normalizePhone(form.phone);
    cleanForm.whatsapp_number = normalizePhone(form.whatsapp_number);
    setLoading(true);
    const { error } = await supabase.from("profiles").update(cleanForm).eq("id", user.id);
    setLoading(false);
    if (error) { toast.error("Failed to save"); return; }
    await refreshProfile();
    toast.success("Profile updated!");
  };

  const initials = (profile?.full_name || "U")
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const tier = plan.tier;
  const isPro = tier === "pro";
  const isBasic = tier === "basic";
  const isTrial = tier === "trial" || (trial.subscriptionStatus === "trial" && !trial.isTrialExpired);
  const planLabel = isPro
    ? "Pro Plan"
    : isBasic
    ? "Basic Plan"
    : isTrial
    ? `Trial · ${trial.trialDaysRemaining ?? 0} days left`
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
    { icon: HelpCircle, label: "Help & Support", path: "/help", desc: "Tutorials, FAQs and contact support" },
    { icon: Download, label: "Install App", path: "/install", desc: "Add to home screen" },
  ];

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{children}</p>
  );

  const Row = ({ icon: Icon, label, path, desc, danger }: any) => (
    <Link to={path}
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${danger ? "bg-destructive/10" : "bg-primary/10"}`}>
        <Icon size={14} className={danger ? "text-destructive" : "text-primary"} />
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
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 flex items-center justify-center shrink-0">
              <span className="text-xl font-heading font-bold text-primary">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-heading font-bold text-lg truncate">{profile?.full_name || "User"}</h2>
              <p className="text-sm text-muted-foreground truncate">{profile?.email}</p>
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5">
                <Crown size={11} className="text-primary" />
                <span className="text-[11px] font-semibold text-primary">{planLabel}</span>
                {isPro && <InfinityIcon size={12} className="text-primary" />}
              </div>
            </div>
          </div>
        </div>

        {/* ACCOUNT */}
        <div className="premium-card p-2 space-y-0.5">
          <SectionLabel>Account</SectionLabel>

          {/* Edit Profile — collapsible */}
          <Collapsible open={editOpen} onOpenChange={setEditOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Pencil size={14} className="text-primary" />
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
                  <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 bg-muted border-border" /></div>
                  <div><Label className="text-xs">City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1 bg-muted border-border" /></div>
                  <div><Label className="text-xs">Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="mt-1 bg-muted border-border" /></div>
                  <div><Label className="text-xs">WhatsApp</Label><Input value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} className="mt-1 bg-muted border-border" /></div>
                  <div><Label className="text-xs">Instagram URL</Label><Input value={form.instagram_url} onChange={(e) => setForm({ ...form, instagram_url: e.target.value })} className="mt-1 bg-muted border-border" /></div>
                </div>
                <div><Label className="text-xs">Bio</Label><Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value.slice(0, 160) })} className="mt-1 bg-muted border-border" rows={2} maxLength={160} /><span className="text-[10px] text-muted-foreground">{form.bio.length}/160</span></div>
                <Button variant="hero" size="sm" onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save Profile"}</Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {accountItems.map((item) => <Row key={item.path} {...item} />)}
        </div>

        {/* Storage Usage */}
        <StorageUsageCard />

        {/* PREFERENCES */}
        <div className="premium-card p-2 space-y-0.5">
          <SectionLabel>Preferences</SectionLabel>
          <div className="flex items-center justify-between rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                {theme === "dark" ? <Moon size={14} className="text-primary" /> : <Sun size={14} className="text-primary" />}
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
          [APP_NAME] by Nevorai · v1.0 · Made with <span aria-hidden>❤️</span> in India
        </p>

        {/* Upgrade CTA pinned at bottom for non-pro */}
        {!isPro && (
          <div className="fixed bottom-20 right-4 z-40 md:hidden">
            <Link to="/pricing">
              <Button variant="hero" size="sm" className="shadow-lg">
                Upgrade <ArrowRight size={14} />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ProfilePage;
