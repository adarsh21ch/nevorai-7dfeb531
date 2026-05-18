import logoDark from "@/assets/nevorai-mark.png";
import logoLight from "@/assets/nevorai-mark-light.png";

interface LogoProps {
  size?: "sm" | "default" | "lg";
  showByline?: boolean;
  variant?: "short" | "full";
  /**
   * Logo color behavior:
   * - "auto" (default): black on light theme, white on dark theme (uses .dark class)
   * - "light": force white mark (use on dark backgrounds)
   * - "dark": force black mark (use on light backgrounds)
   */
  tone?: "auto" | "light" | "dark";
}

export const Logo = ({ size = "default", showByline = false, variant = "short", tone = "auto" }: LogoProps) => {
  // Mark height roughly matches the cap+ascender height of the wordmark so
  // the dot and the text top sit on the same optical line.
  const sizes = {
    sm: { img: "h-7 w-7", text: "text-[17px]", byline: "text-[9px]", gap: "gap-1.5" },
    default: { img: "h-9 w-9 object-contain shrink-0 pt-0 mt-[8px]", text: "text-[22px]", byline: "text-[10px]", gap: "gap-2" },
    lg: { img: "h-12 w-12", text: "text-[28px]", byline: "text-[11px]", gap: "gap-2.5" },
  };
  const s = sizes[size];

  const textColor =
    tone === "light" ? "#ffffff" : tone === "dark" ? "#0b0b0b" : "hsl(var(--foreground))";
  const bylineColor =
    tone === "light" ? "rgba(255,255,255,0.7)" : tone === "dark" ? "rgba(0,0,0,0.6)" : "hsl(var(--muted-foreground))";

  const imgCls = s.img;

  const renderMark = () => {
    if (tone === "light") {
      return <img src={logoLight} alt="Nevorai" className={imgCls} />;
    }
    if (tone === "dark") {
      return <img src={logoDark} alt="Nevorai" className={imgCls} />;
    }
    return (
      <>
        <img src={logoDark} alt="Nevorai" className={`${imgCls} block dark:hidden`} />
        <img src={logoLight} alt="" aria-hidden="true" className={`${imgCls} hidden dark:block`} />
      </>
    );
  };

  return (
    <div className={`flex items-center ${s.gap}`}>
      {renderMark()}
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
