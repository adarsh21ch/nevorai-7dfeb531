import { cn } from "@/lib/utils";

/** Pulsing saffron dot used to indicate live activity. */
export function LivePulseDot({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      {label ? <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">{label}</span> : null}
    </span>
  );
}
