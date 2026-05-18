import { LogoMark } from "./LogoMark";

/**
 * Hero centerpiece: floating monochromatic n+dot mark with subtle halo glow.
 * Color follows --logo-color (black in light, white in dark).
 */
export const AnimatedLogo3D = () => {
  return (
    <div className="relative mx-auto" style={{ width: 200, height: 200, perspective: 800 }}>
      {/* Soft monochrome halo — color set via CSS halo var in .hero-logo-halo */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(var(--halo-color), 0.18) 0%, rgba(var(--halo-color), 0.08) 40%, transparent 70%)",
          filter: "blur(20px)",
          animation: "logoGlowPulse 3s ease-in-out infinite",
        }}
      />
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          animation: "float3d 6s ease-in-out infinite",
          transformStyle: "preserve-3d",
          color: "var(--logo-color)",
        }}
      >
        <LogoMark className="w-[120px] h-[120px]" />
      </div>

      <style>{`
        @keyframes float3d {
          0%   { transform: translateY(0) rotateY(0) rotateX(0); }
          25%  { transform: translateY(-12px) rotateY(8deg) rotateX(3deg); }
          50%  { transform: translateY(-6px) rotateY(0) rotateX(0); }
          75%  { transform: translateY(-14px) rotateY(-8deg) rotateX(-3deg); }
          100% { transform: translateY(0) rotateY(0) rotateX(0); }
        }
        @keyframes logoGlowPulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="float3d"], [style*="logoGlowPulse"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};
