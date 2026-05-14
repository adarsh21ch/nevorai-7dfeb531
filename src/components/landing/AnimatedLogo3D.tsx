import logoImg from "@/assets/nevorai-mark.png";

/**
 * Hero centerpiece: floating 3D nFlow by Nevorai mark with pulsing glow + 6 orbiting dots.
 */
export const AnimatedLogo3D = () => {
  return (
    <div className="relative mx-auto" style={{ width: 200, height: 200, perspective: 800 }}>
      {/* Glow halo */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(0,200,150,0.35) 0%, rgba(0,102,255,0.18) 40%, transparent 70%)",
          filter: "blur(20px)",
          animation: "logoGlowPulse 3s ease-in-out infinite",
        }}
      />
      {/* Logo */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ animation: "float3d 6s ease-in-out infinite", transformStyle: "preserve-3d" }}
      >
        <img
          src={logoImg}
          alt="nFlow by Nevorai"
          className="w-[120px] h-[120px] object-contain"
          style={{ filter: "drop-shadow(0 0 28px rgba(0,200,150,0.55))" }}
        />
      </div>

      {/* Orbiting dots */}
      {[
        { delay: 0, dur: 4, radius: 90, color: "#00C896" },
        { delay: -1, dur: 4, radius: 90, color: "#0066FF" },
        { delay: -2.6, dur: 4, radius: 90, color: "#00C896" },
        { delay: -0.5, dur: 7, radius: 105, color: "#0066FF" },
        { delay: -3.5, dur: 7, radius: 105, color: "#00C896" },
        { delay: -5.2, dur: 7, radius: 105, color: "#0066FF" },
      ].map((o, i) => (
        <div
          key={i}
          className="absolute top-1/2 left-1/2"
          style={{
            width: 6,
            height: 6,
            marginLeft: -3,
            marginTop: -3,
            animation: `orbit-${o.radius} ${o.dur}s linear infinite`,
            animationDelay: `${o.delay}s`,
          }}
        >
          <span
            className="block w-1.5 h-1.5 rounded-full"
            style={{
              background: o.color,
              boxShadow: `0 0 10px ${o.color}`,
            }}
          />
        </div>
      ))}

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
        @keyframes orbit-90 {
          from { transform: rotate(0deg) translateX(90px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(90px) rotate(-360deg); }
        }
        @keyframes orbit-105 {
          from { transform: rotate(0deg) translateX(105px) rotate(0deg); }
          to   { transform: rotate(-360deg) translateX(105px) rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="float3d"], [style*="orbit-"], [style*="logoGlowPulse"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};
