import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useSaveColumnConfig } from "@/lib/teamTracking";
import { toast } from "sonner";

export function ColumnConfigDialog({
  open, onOpenChange, funnels, currentOrder,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  funnels: { id: string; name: string }[];
  currentOrder: string[];
}) {
  const [order, setOrder] = useState<string[]>([]);
  const save = useSaveColumnConfig();

  useEffect(() => {
    if (!open) return;
    const known = new Set(funnels.map((f) => f.id));
    const ordered = currentOrder.filter((id) => known.has(id));
    const rest = funnels.map((f) => f.id).filter((id) => !ordered.includes(id));
    setOrder([...ordered, ...rest]);
  }, [open, funnels, currentOrder]);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...order];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setOrder(next);
  };

  const nameOf = (id: string) => funnels.find((f) => f.id === id)?.name ?? id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Funnel columns</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto py-1">
          {order.map((id, i) => (
            <div key={id} className="flex items-center justify-between gap-2 px-3 py-2 rounded border border-border bg-card">
              <span className="text-sm truncate">{nameOf(id)}</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp size={14} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(i, 1)} disabled={i === order.length - 1}>
                  <ArrowDown size={14} />
                </Button>
              </div>
            </div>
          ))}
          {order.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No funnels yet.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={async () => {
              try { await save.mutateAsync(order); toast.success("Column order saved"); onOpenChange(false); }
              catch (e: any) { toast.error(e?.message ?? "Failed to save"); }
            }}
            disabled={save.isPending}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
