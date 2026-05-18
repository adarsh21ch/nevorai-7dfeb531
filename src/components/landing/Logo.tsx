import { LogoMark } from "./LogoMark";

interface LogoProps {
  size?: "sm" | "default" | "lg";
  showByline?: boolean;
  variant?: "short" | "full";
  /**
   * Logo color behavior:
   * - "auto" (default): follows theme via currentColor + --logo-color
   * - "light": force white mark (use on dark backgrounds)
   * - "dark": force black mark (use on light backgrounds)
   */
  tone?: "auto" | "light" | "dark";
}

export const Logo = ({ size = "default", showByline = false, tone = "auto" }: LogoProps) => {
  const sizes = {
    sm: { img: "h-7 w-7", text: "text-[17px]", byline: "text-[9px]", gap: "gap-2" },
    default: { img: "h-8 w-8", text: "text-[22px]", byline: "text-[10px]", gap: "gap-2.5" },
    lg: { img: "h-12 w-12", text: "text-[28px]", byline: "text-[11px]", gap: "gap-3" },
  };
  const s = sizes[size];

  const forcedColor =
    tone === "light" ? "#ffffff" : tone === "dark" ? "#0A0A0A" : undefined;
  const textColor = forcedColor ?? "var(--logo-color, currentColor)";
  const bylineColor =
    tone === "light"
      ? "rgba(255,255,255,0.7)"
      : tone === "dark"
      ? "rgba(0,0,0,0.6)"
      : "var(--text-secondary)";

  return (
    <div className={`flex items-center ${s.gap}`} style={{ color: forcedColor ?? "var(--logo-color)" }}>
      <LogoMark className={`${s.img} shrink-0`} />
      <div className="flex flex-col justify-center" style={{ lineHeight: 1 }}>
        <span
          className={s.text}
          style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            letterSpacing: "-0.025em",
            fontWeight: 700,
            lineHeight: 1,
            color: textColor,
          }}
        >
          Nevorai
        </span>
        {showByline && (
          <span
            className={`${s.byline} mt-1.5`}
            style={{
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontWeight: 500,
              color: bylineColor,
              letterSpacing: "0.02em",
            }}
          >
            Share videos that get watched.
          </span>
        )}
      </div>
    </div>
  );
};
