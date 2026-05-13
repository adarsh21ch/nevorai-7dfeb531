import { useState, useCallback, createContext, useContext, ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** When set, user must type this exact phrase to enable confirm. */
  typeToConfirm?: string;
};

type Internal = ConfirmOptions & {
  resolve: (ok: boolean) => void;
};

const Ctx = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Internal | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setTyped("");
    return new Promise<boolean>((resolve) => setState({ ...opts, resolve }));
  }, []);

  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
    setBusy(false);
  };

  const matches = !state?.typeToConfirm || typed.trim() === state.typeToConfirm;

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <AlertDialog open={!!state} onOpenChange={(o) => { if (!o && state) close(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state?.title}</AlertDialogTitle>
            {state?.description && (
              <AlertDialogDescription>{state.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          {state?.typeToConfirm && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Type <span className="font-mono font-semibold text-foreground">{state.typeToConfirm}</span> to confirm.
              </p>
              <Input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={state.typeToConfirm}
                className="bg-muted border-border"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{state?.cancelLabel || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              disabled={!matches || busy}
              onClick={(e) => { e.preventDefault(); setBusy(true); close(true); }}
              className={state?.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {busy ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              {state?.confirmLabel || "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  );
}

/** Hook returning a `confirm(opts)` function that resolves to true/false. */
export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmDialogProvider");
  return ctx;
}
