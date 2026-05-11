import { useOwnerBranding } from "@/hooks/useOwnerBranding";

interface BrandingWatermarkProps {
  ownerId?: string | null;
  /** Visual variant. "floating" pins bottom-right, "inline" renders in flow. */
  variant?: "floating" | "inline";
  /** Optional theme hint for contrast on light vs dark backgrounds. */
  theme?: "auto" | "light" | "dark";
}

/**
 * Small "Powered by nFlow" badge shown on public pages owned by Free-tier users.
 * Hidden automatically when the owner is on a paid plan that disables branding.
 */
export const BrandingWatermark = ({
  ownerId,
  variant = "floating",
  theme = "auto",
}: BrandingWatermarkProps) => {
  const { data } = useOwnerBranding(ownerId);
  if (!data?.show) return null;

  const base =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium tracking-wide backdrop-blur-md border shadow-sm transition-opacity hover:opacity-100";

  const palette =
    theme === "light"
      ? "bg-white/85 text-slate-800 border-slate-200"
      : theme === "dark"
      ? "bg-black/55 text-white/90 border-white/15"
      : "bg-background/80 text-foreground border-border";

  const wrapper =
    variant === "floating"
      ? "fixed bottom-4 right-4 z-40 opacity-90"
      : "mx-auto my-6 flex justify-center";

  return (
    <div className={wrapper}>
      <a
        href="https://nflow.app/?ref=watermark"
        target="_blank"
        rel="noopener noreferrer"
        className={`${base} ${palette}`}
        aria-label="Powered by nFlow"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Powered by <span className="font-semibold">nFlow</span>
      </a>
    </div>
  );
};

export default BrandingWatermark;
