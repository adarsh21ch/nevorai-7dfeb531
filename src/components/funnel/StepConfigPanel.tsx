// Stub-compatible StepConfigPanel matching the new editor's API.
// Full feature port happens in a later pass.
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export interface FlowStep {
  id?: string;
  step_order: number;
  title: string;
  description: string;
  step_type: string;
  video_asset_id: string | null;
  is_active: boolean;
  unlock_rule_type: string;
  unlock_rule_value: string;
  cta_text: string;
  cta_url: string;
  booking_url: string;
  unlock_condition?: string;
  unlock_percentage?: number;
  time_delay_enabled?: boolean;
  time_delay_minutes?: number;
  timer_cta_enabled?: boolean;
  timer_cta_text?: string;
  timer_cta_url?: string;
  timer_cta_style?: string;
  video_topics_step_enabled?: boolean;
  video_topics_step?: any;
  access_code_enabled?: boolean;
  access_code_plain?: string;
  access_code_hash?: string | null;
  access_code_message?: string;
  _access_code_raw?: string;
  speaker_mode_step?: string;
  speaker_name_custom?: string;
  speaker_title?: string;
  speaker_bio?: string;
  speaker_photo_url_custom?: string;
}

interface StepConfigPanelProps {
  open: boolean;
  onClose: () => void;
  step: FlowStep | null;
  stepIndex: number;
  totalSteps: number;
  onUpdate: (key: keyof FlowStep, value: any) => void;
  onOpenVideoPicker: () => void;
  speakerScope?: string;
  videoTopicsScope?: string;
  userProfile?: any;
}

export const StepConfigPanel = ({ open, onClose, step, stepIndex, onUpdate, onOpenVideoPicker }: StepConfigPanelProps) => {
  if (!step) return null;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Step {stepIndex + 1} settings</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input value={step.title} onChange={(e) => onUpdate("title", e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Input value={step.description} onChange={(e) => onUpdate("description", e.target.value)} className="mt-1.5" />
          </div>
          {step.step_type === "video" && (
            <Button variant="outline" size="sm" onClick={onOpenVideoPicker} className="w-full">
              {step.video_asset_id ? "Change Video" : "Select Video"}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">Full step configuration UI will be ported in a later pass.</p>
          <Button onClick={onClose} className="w-full">Done</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
