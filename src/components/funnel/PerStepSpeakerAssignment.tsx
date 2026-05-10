import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SpeakerPhotoUpload } from "./SpeakerPhotoUpload";
import { Pencil, Plus, Copy, Check, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FlowStep {
  id?: string;
  step_order: number;
  title: string;
  step_type: string;
  is_active: boolean;
  speaker_mode_step?: string;
  speaker_name_custom?: string;
  speaker_title?: string;
  speaker_bio?: string;
  speaker_photo_url_custom?: string;
  [key: string]: any;
}

interface Props {
  steps: FlowStep[];
  setSteps: React.Dispatch<React.SetStateAction<FlowStep[]>>;
}

export const PerStepSpeakerAssignment = ({ steps, setSteps }: Props) => {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState({ name: "", title: "", bio: "", photo: "" });
  const [copyFrom, setCopyFrom] = useState<string>("__none__");

  const activeSteps = steps.filter((s) => s.is_active);

  const openEdit = (idx: number) => {
    const s = steps[idx];
    setDraft({
      name: s.speaker_name_custom || "",
      title: s.speaker_title || "",
      bio: s.speaker_bio || "",
      photo: s.speaker_photo_url_custom || "",
    });
    setEditingIdx(idx);
  };

  const cancelEdit = () => setEditingIdx(null);

  const saveEdit = () => {
    if (editingIdx === null) return;
    setSteps((prev) =>
      prev.map((s, i) =>
        i === editingIdx
          ? {
              ...s,
              speaker_mode_step: draft.name.trim() ? "custom" : "inherit",
              speaker_name_custom: draft.name.trim(),
              speaker_title: draft.title.trim(),
              speaker_bio: draft.bio.trim(),
              speaker_photo_url_custom: draft.photo,
            }
          : s
      )
    );
    setEditingIdx(null);
  };

  const hasSpeaker = (s: FlowStep) => s.speaker_mode_step === "custom" && !!s.speaker_name_custom;

  const handleCopy = () => {
    if (copyFrom === "__none__") return;
    const sourceIdx = parseInt(copyFrom);
    const source = steps[sourceIdx];
    if (!source || !hasSpeaker(source)) return;
    setSteps((prev) =>
      prev.map((s) => {
        if (!s.is_active || hasSpeaker(s)) return s;
        return {
          ...s,
          speaker_mode_step: "custom",
          speaker_name_custom: source.speaker_name_custom,
          speaker_title: source.speaker_title,
          speaker_bio: source.speaker_bio,
          speaker_photo_url_custom: source.speaker_photo_url_custom,
        };
      })
    );
    setCopyFrom("__none__");
  };

  const stepsWithSpeakers = steps
    .map((s, i) => ({ idx: i, step: s }))
    .filter(({ step }) => step.is_active && hasSpeaker(step));

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-heading font-semibold">Assign a Speaker to Each Step</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Each step can have a different speaker or presenter.</p>
      </div>

      <div className="space-y-2">
        {steps.map((step, idx) => {
          if (!step.is_active) return null;
          const isEditing = editingIdx === idx;
          const assigned = hasSpeaker(step);

          return (
            <div
              key={idx}
              className={`rounded-xl border transition-all duration-150 ${
                isEditing
                  ? "border-primary/40 bg-muted/80 border-l-[3px] border-l-primary"
                  : "border-border bg-muted/30 hover:border-border/60"
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                  Step {step.step_order + 1}
                </span>
                <span className="text-sm font-semibold text-foreground truncate flex-1">
                  {step.title || "Untitled Step"}
                </span>

                {!isEditing && !assigned && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(idx)}
                    className="text-xs border-primary/30 text-primary hover:bg-primary/10 shrink-0"
                  >
                    <Plus size={12} className="mr-1" /> Add Speaker
                  </Button>
                )}
                {!isEditing && assigned && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(idx)}
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <Pencil size={12} className="mr-1" /> Edit
                  </Button>
                )}
                {isEditing && (
                  <Button type="button" variant="ghost" size="sm" onClick={cancelEdit} className="text-xs text-muted-foreground shrink-0">
                    <X size={14} />
                  </Button>
                )}
              </div>

              {!isEditing && assigned && (
                <div className="flex items-center gap-3 px-4 pb-3 pt-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center overflow-hidden ring-1 ring-primary/20 shrink-0">
                    {step.speaker_photo_url_custom ? (
                      <img src={step.speaker_photo_url_custom} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-primary text-[10px] font-bold">
                        {step.speaker_name_custom?.charAt(0)?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{step.speaker_name_custom}</p>
                    {step.speaker_title && <p className="text-xs text-muted-foreground truncate">{step.speaker_title}</p>}
                  </div>
                </div>
              )}

              {!isEditing && !assigned && (
                <div className="px-4 pb-3 pt-0">
                  <p className="text-xs text-muted-foreground/60 italic">No speaker assigned</p>
                </div>
              )}

              {isEditing && (
                <div className="px-4 pb-4 pt-1 space-y-4">
                  <div className="h-px bg-border" />
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="shrink-0 flex justify-center sm:justify-start">
                      <SpeakerPhotoUpload value={draft.photo} onChange={(url) => setDraft((d) => ({ ...d, photo: url }))} />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Speaker Name</Label>
                        <Input
                          value={draft.name}
                          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value.slice(0, 60) }))}
                          placeholder="e.g. Adarsh Chaturvedi"
                          className="mt-1 bg-background border-border h-9 text-sm"
                          maxLength={60}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Speaker Title</Label>
                        <Input
                          value={draft.title}
                          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value.slice(0, 60) }))}
                          placeholder="e.g. Co-Founder, Diamond Leader"
                          className="mt-1 bg-background border-border h-9 text-sm"
                          maxLength={60}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">About (optional)</Label>
                        <Textarea
                          value={draft.bio}
                          onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value.slice(0, 200) }))}
                          placeholder="Brief intro shown below the video..."
                          className="mt-1 bg-background border-border text-sm"
                          rows={2}
                          maxLength={200}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" size="sm" onClick={cancelEdit}>
                      Cancel
                    </Button>
                    <Button type="button" size="sm" onClick={saveEdit} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Check size={13} className="mr-1" /> Save Speaker
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {stepsWithSpeakers.length > 0 && activeSteps.some((s) => !hasSpeaker(s)) && (
        <div className="flex items-center gap-2 pt-2 flex-wrap">
          <Copy size={13} className="text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">Copy speaker from</span>
          <Select value={copyFrom} onValueChange={setCopyFrom}>
            <SelectTrigger className="h-7 text-xs w-auto min-w-[140px] bg-muted border-border">
              <SelectValue placeholder="Select step..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select step...</SelectItem>
              {stepsWithSpeakers.map(({ idx, step }) => (
                <SelectItem key={idx} value={String(idx)}>
                  Step {step.step_order + 1} — {step.speaker_name_custom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={handleCopy} disabled={copyFrom === "__none__"}>
            Apply to unassigned
          </Button>
        </div>
      )}
    </div>
  );
};
