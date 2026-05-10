// Full PrivacySettings — visibility toggle, access code, lead-capture field switches.
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Globe, Lock, Eye, EyeOff, Users } from "lucide-react";
import { useState } from "react";

interface PrivacySettingsProps {
  visibility: string;
  accessCode: string;
  requiredFields: { email: boolean; city: boolean; state: boolean; whatsapp: boolean };
  onVisibilityChange: (v: string) => void;
  onAccessCodeChange: (code: string) => void;
  onRequiredFieldsChange: (fields: { email: boolean; city: boolean; state: boolean; whatsapp: boolean }) => void;
}

export const PrivacySettings = ({ visibility, accessCode, requiredFields, onVisibilityChange, onAccessCodeChange, onRequiredFieldsChange }: PrivacySettingsProps) => {
  const [showCode, setShowCode] = useState(false);
  const isPrivate = visibility === "private";
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-heading font-semibold">Privacy Settings</h2>
      <p className="text-sm text-muted-foreground">Control who can access this funnel.</p>
      <div className="p-4 bg-muted/50 rounded-xl">
        <Label className="font-semibold mb-3 block">Funnel Visibility</Label>
        <div className="flex gap-2 p-1 bg-muted rounded-lg">
          <button onClick={() => onVisibilityChange("public")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-md transition-all ${!isPrivate ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><Globe size={14} /> Public</button>
          <button onClick={() => onVisibilityChange("private")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-md transition-all ${isPrivate ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><Lock size={14} /> Private</button>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className={`w-2 h-2 rounded-full ${isPrivate ? "bg-amber-500" : "bg-emerald-500"}`} />
          <p className="text-xs text-muted-foreground">{isPrivate ? "Viewers must enter an access code to unlock this funnel" : "Anyone with the link can view this funnel"}</p>
        </div>
      </div>
      {isPrivate && (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
          <div className="p-4 bg-muted/50 rounded-xl space-y-3">
            <Label className="font-semibold flex items-center gap-2"><Lock size={14} /> Access Code</Label>
            <p className="text-xs text-muted-foreground">Share this code with people you want to give access to</p>
            <div className="relative">
              <Input type={showCode ? "text" : "password"} value={accessCode} onChange={(e) => onAccessCodeChange(e.target.value.toUpperCase())} placeholder="e.g. VIP1500, TEAM2024" className="bg-muted border-border pr-10 uppercase tracking-wider font-mono" />
              <button type="button" onClick={() => setShowCode(!showCode)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showCode ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </div>
          <div className="p-4 bg-muted/50 rounded-xl space-y-3">
            <Label className="font-semibold flex items-center gap-2"><Users size={14} /> Information to collect from viewers</Label>
            <p className="text-xs text-muted-foreground">Name and Phone are always required</p>
            <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
              <div className="flex items-center justify-between p-3.5 bg-muted/30"><span className="text-sm font-medium">Full Name</span><div className="flex items-center gap-2"><span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">Always On</span><Switch checked disabled /></div></div>
              <div className="flex items-center justify-between p-3.5 bg-muted/30"><span className="text-sm font-medium">Phone Number</span><div className="flex items-center gap-2"><span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">Always On</span><Switch checked disabled /></div></div>
              {([{ key: "email" as const, label: "Email Address" }, { key: "city" as const, label: "City" }, { key: "state" as const, label: "State" }, { key: "whatsapp" as const, label: "WhatsApp Number" }]).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between p-3.5"><span className="text-sm font-medium">{label}</span><Switch checked={requiredFields[key]} onCheckedChange={(v) => onRequiredFieldsChange({ ...requiredFields, [key]: v })} /></div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground italic">Password field is always included so viewers can re-access the funnel later</p>
          </div>
        </div>
      )}
    </div>
  );
};
