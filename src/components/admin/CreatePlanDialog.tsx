import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { adminWrite } from "@/lib/adminWrite";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

const PLAN_KEY_RE = /^[a-z][a-z0-9_]*$/;

interface Props {
  existingPlanNames: string[];
  nextDisplayOrder: number;
  onCreated?: (planName: string) => void;
}

export const CreatePlanDialog = ({ existingPlanNames, nextDisplayOrder, onCreated }: Props) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    plan_name: "",
    display_name: "",
    description: "",
    plan_badge_text: "",
    display_order: String(nextDisplayOrder),
    monthly_price: "",
    yearly_price: "",
    daily_views: "",
  });

  const reset = () => setForm({
    plan_name: "", display_name: "", description: "", plan_badge_text: "",
    display_order: String(nextDisplayOrder),
    monthly_price: "", yearly_price: "", daily_views: "",
  });

  const submit = async () => {
    const planName = form.plan_name.trim().toLowerCase();
    if (!PLAN_KEY_RE.test(planName)) {
      toast.error("Plan key must be lowercase letters/digits/underscores, starting with a letter.");
      return;
    }
    if (existingPlanNames.includes(planName)) {
      toast.error(`Plan "${planName}" already exists.`);
      return;
    }
    const dailyViews = parseInt(form.daily_views) || 0;
    const monthly = parseInt(form.monthly_price) || 0;
    const yearly = parseInt(form.yearly_price) || 0;
    const displayOrder = parseInt(form.display_order) || nextDisplayOrder;

    if (!form.display_name.trim()) {
      toast.error("Display name is required.");
      return;
    }
    if (dailyViews <= 0 || monthly <= 0 || yearly <= 0) {
      toast.error("Daily views, monthly price and yearly price are required and must be > 0.");
      return;
    }

    setSaving(true);
    try {
      // 1) plan_config row with sensible defaults — admin tunes after creation.
      const configRow: Record<string, any> = {
        plan_name: planName,
        display_name: form.display_name.trim(),
        description: form.description.trim() || null,
        plan_badge_text: form.plan_badge_text.trim() || null,
        display_order: displayOrder,
        is_enabled: true,
        view_limit_mode: "daily",
        daily_view_limit: dailyViews,
        monthly_views: dailyViews * 30,
        monthly_price: monthly,
        yearly_price: yearly,
        yearly_validity_days: 365,
        extra_views_unit_size: 1000,
        extra_views_price_per_unit: 49,
        max_funnels: 5,
        max_landing_pages: 5,
        max_live_sessions: 0,
        max_leads: -1,
        max_leads_export: -1,
        max_team_members: 0,
        max_custom_form_fields: 5,
        max_storage_mb: 1024,
        feature_funnel_creation: true,
        feature_video_upload: true,
        feature_video_sharing: true,
        feature_youtube_import: true,
        feature_lead_capture: true,
        feature_landing_pages: true,
        feature_analytics: true,
        feature_skip_control: false,
        feature_speaker_profile: false,
        feature_video_topics: false,
        feature_contact_form: true,
        feature_privacy_settings: false,
        feature_custom_form_fields: false,
        feature_landing_page_email: false,
        feature_go_live: false,
        feature_whatsapp_automation: false,
        feature_smart_reminders: false,
        feature_advanced_analytics: false,
        feature_prospect_analytics: false,
        feature_insights: false,
        multilevel_funnel_enabled: false,
        feature_team_analytics: false,
        feature_custom_branding: false,
        feature_show_branding: true,
        feature_priority_support: false,
      };

      const { error: cfgErr } = await adminWrite(() =>
        (supabase.from("plan_config") as any).insert(configRow).select(),
      );
      if (cfgErr) throw cfgErr;

      // 2) Base view tier
      const { error: tierErr } = await adminWrite(() =>
        (supabase.from("plan_view_tiers" as any) as any).insert({
          plan_name: planName,
          daily_views: dailyViews,
          monthly_price: monthly,
          yearly_price: yearly,
          is_active: true,
          is_base: true,
          is_popular: false,
          display_order: 1,
        }).select(),
      );
      if (tierErr) throw tierErr;

      toast.success(`Plan "${planName}" created. Tune limits & features below.`);
      ["plans", "admin-plan-configs", "plan-configs", "plan-pricing", "plan-view-tiers", "plan-view-tiers-public"]
        .forEach(k => qc.invalidateQueries({ queryKey: [k] }));
      reset();
      setOpen(false);
      onCreated?.(planName);
    } catch (e: any) {
      toast.error(e?.message || "Failed to create plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={() => { reset(); setOpen(true); }}>
        <Plus size={14} /> New Plan
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create a new plan</DialogTitle>
            <DialogDescription>
              Adds a row to <code>plan_config</code> + base tier in <code>plan_view_tiers</code>.
              All feature toggles default to a Basic-like baseline — tune them after creation.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-1">
              <Label className="text-xs">Plan key *</Label>
              <Input
                value={form.plan_name}
                placeholder="starter"
                autoFocus
                onChange={(e) => setForm(f => ({ ...f, plan_name: e.target.value.toLowerCase() }))}
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">lowercase, a-z 0-9 _</p>
            </div>
            <div className="col-span-1">
              <Label className="text-xs">Display name *</Label>
              <Input
                value={form.display_name}
                placeholder="Starter"
                onChange={(e) => setForm(f => ({ ...f, display_name: e.target.value }))}
              />
            </div>

            <div className="col-span-1">
              <Label className="text-xs">Badge text</Label>
              <Input
                value={form.plan_badge_text}
                placeholder="For Beginners"
                onChange={(e) => setForm(f => ({ ...f, plan_badge_text: e.target.value }))}
              />
            </div>
            <div className="col-span-1">
              <Label className="text-xs">Display order</Label>
              <Input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm(f => ({ ...f, display_order: e.target.value }))}
              />
            </div>

            <div className="col-span-2">
              <Label className="text-xs">Description / subtitle</Label>
              <Textarea
                rows={2}
                value={form.description}
                placeholder="Short tagline shown on the pricing page"
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="col-span-2 grid grid-cols-3 gap-3 mt-1">
              <div>
                <Label className="text-xs">Daily views *</Label>
                <Input
                  type="number"
                  value={form.daily_views}
                  placeholder="40"
                  onChange={(e) => setForm(f => ({ ...f, daily_views: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Monthly ₹ *</Label>
                <Input
                  type="number"
                  value={form.monthly_price}
                  placeholder="299"
                  onChange={(e) => setForm(f => ({ ...f, monthly_price: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Yearly ₹ *</Label>
                <Input
                  type="number"
                  value={form.yearly_price}
                  placeholder="2990"
                  onChange={(e) => setForm(f => ({ ...f, yearly_price: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin mr-1.5" />}
              Create plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
