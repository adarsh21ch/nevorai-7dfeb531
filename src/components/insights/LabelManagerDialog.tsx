import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { useTeamLabels, useCreateLabel, useDeleteLabel, useAssignMemberLabel, type TeamMatrixMember } from "@/lib/teamTracking";
import { toast } from "sonner";

export function LabelManagerDialog({
  open, onOpenChange, members,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  members: TeamMatrixMember[];
}) {
  const { data: labels = [] } = useTeamLabels();
  const create = useCreateLabel();
  const del = useDeleteLabel();
  const assign = useAssignMemberLabel();
  const [newName, setNewName] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Labels</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="text-xs font-medium mb-2 text-muted-foreground">Your labels</div>
            <div className="flex flex-wrap gap-1.5">
              {labels.map((l) => (
                <div key={l.id} className="flex items-center gap-1 text-xs border border-border rounded-full pl-2.5 pr-1 py-0.5">
                  <span>{l.name}</span>
                  <button
                    className="p-0.5 hover:text-destructive"
                    onClick={async () => {
                      try { await del.mutateAsync(l.id); toast.success("Label deleted"); }
                      catch (e: any) { toast.error(e?.message ?? "Failed"); }
                    }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              {labels.length === 0 && <p className="text-xs text-muted-foreground">No labels yet.</p>}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="New label (e.g. AS, Supervisor)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                className="gap-1"
                disabled={!newName.trim() || create.isPending}
                onClick={async () => {
                  try {
                    await create.mutateAsync(newName.trim());
                    setNewName("");
                  } catch (e: any) { toast.error(e?.message ?? "Failed"); }
                }}
              >
                <Plus size={12} /> Add
              </Button>
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <div className="text-xs font-medium mb-2 text-muted-foreground">Assign to members</div>
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-border">
                  <span className="text-sm truncate">{m.name}{m.is_you ? " (You)" : ""}</span>
                  <select
                    className="text-xs border border-border rounded px-2 py-1 bg-background"
                    value={m.label_id ?? ""}
                    onChange={async (e) => {
                      const v = e.target.value || null;
                      try { await assign.mutateAsync({ memberId: m.id, labelId: v }); }
                      catch (err: any) { toast.error(err?.message ?? "Failed"); }
                    }}
                  >
                    <option value="">— none —</option>
                    {labels.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
