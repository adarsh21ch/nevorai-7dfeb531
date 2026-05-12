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
  User, Crown, ArrowRight, Lock, Check, CreditCard, FileCheck,
  Bell, Settings, Download, ChevronRight, ChevronDown, Pencil,
  Sun, Moon, HelpCircle, LogOut, FileText, Radio,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { Switch } from "@/components/ui/switch";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/lib/router-compat";
import { usePlan } from "@/hooks/usePlan";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { sanitizeFields, normalizePhone } from "@/lib/sanitize";

const ProfilePage = () => {
  useDocumentTitle("Profile");
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { plan } = usePlan();
  const { theme, toggleTheme } = useTheme();
  const { isFree, config, counts, tier, canUseMultilevel } = usePlanLimits();
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
    // Strip any HTML/JS injection from text fields before persisting.
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

  const usageBar = (label: string, current: number, max: number) => {
    const pct = max === -1 ? 0 : Math.min((current / max) * 100, 100);
    const isHigh = max !== -1 && pct >= 90;
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className={`font-medium ${isHigh ? "text-destructive" : ""}`}>
            {current} / {max === -1 ? "∞" : max} used
          </span>
        </div>
        {max !== -1 && (
          <Progress value={pct} className={`h-2 ${isHigh ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`} />
        )}
      </div>
    );
  };

  const tierBadge = isFree
    ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold uppercase tracking-wider">Free</span>
    : tier === "basic"
    ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-400/30 font-semibold uppercase tracking-wider">Basic</span>
    : <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success font-semibold uppercase tracking-wider">Pro</span>;

  const initials = (profile?.full_name || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DashboardLayout>
      <div className="max-w-6xl space-y-5">
        {/* Hero badge card — name, email, plan, avatar */}
        <div className="premium-card p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 flex items-center justify-center shrink-0">
              <span className="text-lg font-heading font-bold text-primary">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-heading font-bold text-lg truncate">{profile?.full_name || "User"}</h2>
                {tierBadge}
              </div>
              <p className="text-sm text-muted-foreground truncate">{profile?.email}</p>
              {profile?.city && <p className="text-xs text-muted-foreground mt-0.5">{profile.city}{profile.company ? ` · ${profile.company}` : ""}</p>}
            </div>
          </div>
        </div>

        {/* Plan & Usage */}
        <div className="premium-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="stat-icon">
                <Crown size={16} className="text-primary" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-sm">{tier === "basic" ? "Basic" : tier === "trial" ? "Free Trial" : tier.charAt(0).toUpperCase() + tier.slice(1)} Plan</h3>
                {!isFree && plan.billingType && (
                  <p className="text-[11px] text-muted-foreground capitalize">
                    {plan.billingType} · {plan.expiresAt ? `Renews ${format(new Date(plan.expiresAt), "d MMM yyyy")}` : "Active"}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {(isFree || plan.isExpired || plan.isExpiringSoon || tier === "basic") && (
                <Link to="/pricing">
                  <Button size="sm" variant="hero" className="h-8 text-xs gap-1">
                    {plan.isExpired ? "Renew" : isFree ? "Upgrade" : "Upgrade"} <ArrowRight size={12} />
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {!isFree && (
            <div className="space-y-2.5 pt-3 border-t border-border">
              {usageBar("Funnels", counts.funnels, config.max_funnels)}
              {usageBar("Landing Pages", counts.landing_pages, config.max_landing_pages)}
              {usageBar("Live Sessions", counts.live_sessions, config.max_live_sessions)}
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Multi-level Funnels</span>
                {canUseMultilevel ? (
                  <span className="flex items-center gap-1 text-success"><Check size={12} /> Enabled</span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground"><Lock size={12} /> Locked</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Edit Profile — Collapsible */}
        <Collapsible open={editOpen} onOpenChange={setEditOpen}>
          <div className="premium-card overflow-hidden">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="stat-icon">
                    <Pencil size={14} className="text-primary" />
                  </div>
                  <span className="text-sm font-heading font-semibold">Edit Profile</span>
                </div>
                <ChevronDown size={16} className={`text-muted-foreground transition-transform ${editOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
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
          </div>
        </Collapsible>

        {/* Appearance */}
        <div className="premium-card p-4">
          <p className="px-1 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Appearance</p>
          <div className="flex items-center justify-between rounded-lg px-2 py-2">
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
        </div>

        {/* Account Quick Links */}
        <div className="premium-card p-2 space-y-0.5">
          <p className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Account</p>
          {[
            { icon: FileText, label: "Landing Pages", path: "/landing-pages", desc: "Create pages for your videos" },
            { icon: Radio, label: "Live Sessions", path: "/live", desc: "Go live with your prospects" },
            { icon: CreditCard, label: "Billing", path: "/billing", desc: "Subscription & payments" },
            { icon: FileCheck, label: "Get Verified", path: "/kyc", desc: "KYC for payouts" },
            { icon: Bell, label: "Notifications", path: "/notifications", desc: "Alerts & updates" },
            { icon: HelpCircle, label: "Help & Support", path: "/help", desc: "Tutorials, FAQs and contact support" },
            { icon: Settings, label: "Settings", path: "/settings", desc: "App preferences" },
            { icon: Download, label: "Install App", path: "/install", desc: "Add to home screen" },
          ].map((item) => (
            <Link key={item.path} to={item.path}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <item.icon size={14} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
              <ChevronRight size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
          ))}
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
      </div>
    </DashboardLayout>
  );
};

export default ProfilePage;
