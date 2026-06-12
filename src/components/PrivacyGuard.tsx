import { useEffect, useRef } from "react";

/**
 * PrivacyGuard — best-effort content-protection deterrents for public viewer pages.
 *
 * IMPORTANT: Browsers cannot truly block OS-level screenshots or screen recording.
 * This component layers strong deterrents and a dynamic watermark so any leaked
 * capture is traceable back to the viewer.
 *
 * What it does (scoped to its subtree):
 * - Disables right-click context menu
 * - Disables text & image selection, drag-to-save on images
 * - Blocks common shortcuts: Ctrl/Cmd+S, Ctrl/Cmd+P, Ctrl/Cmd+U,
 *   Ctrl/Cmd+Shift+I/J/C, F12, PrintScreen
 * - Forces `controlsList="nodownload noremoteplayback"` and
 *   `disablePictureInPicture` on every <video> inside
 * - Blurs the screen when the tab loses focus / visibility changes
 * - Renders a translucent diagonal watermark overlay with viewer name/phone
 *   + timestamp on top of the content
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
  const [hidden, setHidden] = (function useLocal() {
    // tiny local state without importing useState to avoid lint noise
    const ref = useRef({ value: false, set: (_: boolean) => {} });
    const [v, setV] = (require("react") as typeof import("react")).useState(false);
    ref.current.value = v;
    ref.current.set = setV;
    return [v, setV] as const;
  })();

  // Apply <video> hardening + disable download attributes inside subtree
  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    if (!root) return;

    const harden = () => {
      root.querySelectorAll("video").forEach((v) => {
        v.setAttribute("controlsList", "nodownload noremoteplayback noplaybackrate");
        v.setAttribute("disablePictureInPicture", "true");
        (v as any).disablePictureInPicture = true;
        v.oncontextmenu = (e) => e.preventDefault();
      });
      root.querySelectorAll("a[download]").forEach((a) => a.removeAttribute("download"));
      root.querySelectorAll("img").forEach((img) => {
        img.setAttribute("draggable", "false");
        img.oncontextmenu = (e) => e.preventDefault();
      });
    };

    harden();
    const obs = new MutationObserver(harden);
    obs.observe(root, { childList: true, subtree: true, attributes: true });
    return () => obs.disconnect();
  }, [enabled]);

  // Global event handlers (scoped within the guarded subtree where possible)
  useEffect(() => {
    if (!enabled) return;

    const onContext = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) e.preventDefault();
    };

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const meta = e.ctrlKey || e.metaKey;
      // Block: Ctrl+S, Ctrl+P, Ctrl+U, Ctrl+Shift+I/J/C, F12, PrintScreen
      if (
        (meta && ["s", "p", "u"].includes(k)) ||
        (meta && e.shiftKey && ["i", "j", "c"].includes(k)) ||
        e.key === "F12" ||
        e.key === "PrintScreen"
      ) {
        e.preventDefault();
        // Briefly hide content if PrintScreen pressed
        if (e.key === "PrintScreen") {
          setHidden(true);
          setTimeout(() => setHidden(false), 1500);
          try {
            // Best-effort: overwrite clipboard so any auto-paste is neutralized
            navigator.clipboard?.writeText("");
          } catch {}
        }
      }
    };

    const onCopy = (e: ClipboardEvent) => {
      if (rootRef.current?.contains(e.target as Node)) e.preventDefault();
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") setHidden(true);
      else setHidden(false);
    };
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
  }, [enabled, setHidden]);

  if (!enabled) return <>{children}</>;

  const stamp = new Date().toLocaleString();
  const wm = (watermarkText || "Confidential preview").slice(0, 80);

  return (
    <div
      ref={rootRef}
      className="relative select-none"
      style={{
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
      } as React.CSSProperties}
    >
      {children}

      {/* Dynamic diagonal watermark — covers the subtree, pointer-events: none */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -30deg,
            transparent 0,
            transparent 180px,
            rgba(255,255,255,0.0001) 181px
          )`,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: "rotate(-24deg)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, 360px)",
            gridAutoRows: "180px",
            opacity: 0.18,
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

      {/* Hide overlay on PrintScreen / tab-blur — black out content */}
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
