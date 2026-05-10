import { useEffect, useRef } from "react";

/**
 * Animated background: flowing particles + faint S-curves.
 * Pure presentational — no interactivity.
 */
export const FlowParticles = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const COUNT = 110;
    type P = { x: number; y: number; vx: number; r: number; o: number; trail: boolean };
    const particles: P[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: 0.3 + Math.random() * 0.9,
      r: 1.5 + Math.random() * 1.8,
      o: 0.4 + Math.random() * 0.4,
      trail: Math.random() > 0.7,
    }));

    const colorAt = (x: number) => {
      const t = Math.max(0, Math.min(1, x / Math.max(1, w)));
      // green (0,200,150) -> blue (0,102,255)
      const r = 0;
      const g = Math.round(200 + (102 - 200) * t);
      const b = Math.round(150 + (255 - 150) * t);
      return `rgba(${r},${g},${b},`;
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        if (p.x > w + 10) {
          p.x = -10;
          p.y = Math.random() * h;
        }
        const c = colorAt(p.x);
        if (p.trail) {
          ctx.shadowColor = c + "0.6)";
          ctx.shadowBlur = 6;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fillStyle = c + p.o + ")";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 600">
        <defs>
          <linearGradient id="flowLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#00C896" />
            <stop offset="100%" stopColor="#0066FF" />
          </linearGradient>
        </defs>
        {[120, 260, 400, 520].map((y, i) => (
          <path
            key={i}
            d={`M -50 ${y} C 250 ${y - 60}, 500 ${y + 80}, 1050 ${y - 30}`}
            stroke="url(#flowLine)"
            strokeWidth={1.5}
            fill="none"
            opacity={0.08}
            strokeDasharray="6 14"
            style={{
              animation: `flowDash ${8 + i * 1.5}s linear infinite`,
              animationDelay: `${i * 0.5}s`,
            }}
          />
        ))}
      </svg>
      <style>{`
        @keyframes flowDash { to { stroke-dashoffset: -400; } }
      `}</style>
    </div>
  );
};
