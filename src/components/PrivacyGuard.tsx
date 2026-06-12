import { useEffect, useRef, useState } from "react";

/**
 * PrivacyGuard — best-effort content-protection deterrents for public viewer pages.
 *
 * IMPORTANT: Browsers cannot truly block OS-level screenshots or screen recording.
 * This component layers strong deterrents and a dynamic watermark so any leaked
 * capture is traceable back to the viewer.
 */
export const PrivacyGuard = ({
  children,
  watermarkText,
  enabled = true,
}: {
  children: React.ReactNode;
  watermarkText?: string | null;
  enabled?: boolean;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);

  // Harden <video> + <img> in the subtree (no download, no PiP, no drag)
  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    if (!root) return;

    const harden = () => {
      root.querySelectorAll("video").forEach((v) => {
        v.setAttribute("controlsList", "nodownload noremoteplayback noplaybackrate");
        v.setAttribute("disablePictureInPicture", "true");
        (v as any).disablePictureInPicture = true;
        v.oncontextmenu = (e) => { e.preventDefault(); return false; };
      });
      root.querySelectorAll("a[download]").forEach((a) => a.removeAttribute("download"));
      root.querySelectorAll("img").forEach((img) => {
        img.setAttribute("draggable", "false");
        img.oncontextmenu = (e) => { e.preventDefault(); return false; };
      });
    };

    harden();
    const obs = new MutationObserver(harden);
    obs.observe(root, { childList: true, subtree: true, attributes: true });
    return () => obs.disconnect();
  }, [enabled]);

  // Global keyboard / clipboard / visibility handlers
  useEffect(() => {
    if (!enabled) return;

    const inGuard = (t: EventTarget | null) =>
      rootRef.current?.contains(t as Node);

    const onContext = (e: MouseEvent) => { if (inGuard(e.target)) e.preventDefault(); };

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const meta = e.ctrlKey || e.metaKey;
      if (
        (meta && ["s", "p", "u"].includes(k)) ||
        (meta && e.shiftKey && ["i", "j", "c"].includes(k)) ||
        e.key === "F12"
      ) {
        e.preventDefault();
      }
      if (e.key === "PrintScreen") {
        setHidden(true);
        setTimeout(() => setHidden(false), 1500);
        try { navigator.clipboard?.writeText(""); } catch {}
      }
    };

    const onCopy = (e: ClipboardEvent) => { if (inGuard(e.target)) e.preventDefault(); };
    const onVisibility = () => setHidden(document.visibilityState !== "visible");
    const onBlur = () => setHidden(true);
    const onFocus = () => setHidden(false);

    document.addEventListener("contextmenu", onContext);
    document.addEventListener("keydown", onKey);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCopy);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCopy);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled]);

  if (!enabled) return <>{children}</>;

  const stamp = new Date().toLocaleString();
  const wm = (watermarkText || "Confidential preview").slice(0, 80);

  return (
    <div
      ref={rootRef}
      className="relative"
      style={{
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
      } as React.CSSProperties}
    >
      {children}

      {/* Dynamic diagonal watermark overlay — pointer-events: none */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
      >
        <div
          className="absolute inset-0"
          style={{
            transform: "rotate(-24deg)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, 360px)",
            gridAutoRows: "180px",
            opacity: 0.16,
            color: "rgba(120,120,120,0.9)",
            fontSize: "13px",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {Array.from({ length: 80 }).map((_, i) => (
            <div key={i} className="flex items-center justify-center">
              <span style={{ textShadow: "0 0 6px rgba(255,255,255,0.6)" }}>
                {wm} · {stamp}
              </span>
            </div>
          ))}
        </div>
      </div>

      {hidden && (
        <div
          aria-hidden
          className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center text-center px-6"
        >
          <div className="text-white max-w-md">
            <p className="text-lg font-semibold mb-2">Content paused</p>
            <p className="text-sm opacity-80">
              Return to this tab to resume. Screenshots and recordings are tracked.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivacyGuard;
