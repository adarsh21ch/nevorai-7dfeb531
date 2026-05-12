import logoImg from "@/assets/nevorai-mark.png";

interface LogoProps {
  size?: "sm" | "default" | "lg";
  showByline?: boolean;
}

export const Logo = ({ size = "default", showByline = false }: LogoProps) => {
  const sizes = {
    sm: { img: "w-8 h-8", text: "text-[16px]", byline: "text-[9px]" },
    default: { img: "w-10 h-10", text: "text-[20px]", byline: "text-[10px]" },
    lg: { img: "w-14 h-14", text: "text-[26px]", byline: "text-[11px]" },
  };
  const s = sizes[size];

  return (
    <div className="flex items-center gap-2">
      <img src={logoImg} alt="Nevorai Flow" className={`${s.img} object-contain`} />
      <div className="flex flex-col" style={{ lineHeight: 1 }}>
        <div className={`flex items-baseline ${s.text}`} style={{ lineHeight: 1 }}>
          <span style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 800, color: "hsl(var(--foreground))", letterSpacing: "-0.03em" }}>Flow</span>
        </div>
        {showByline && (
          <span className={`${s.byline} mt-1`} style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 500, color: "hsl(var(--muted-foreground))", letterSpacing: "0.02em" }}>
            by Nevorai
          </span>
        )}
      </div>
    </div>
  );
};
