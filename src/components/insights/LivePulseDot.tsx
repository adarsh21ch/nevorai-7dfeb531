import { cn } from "@/lib/utils";

/** Pulsing red dot used to indicate live activity. */
export function LivePulseDot({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
      </span>
      {label ? <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-500">{label}</span> : null}
    </span>
  );
}
