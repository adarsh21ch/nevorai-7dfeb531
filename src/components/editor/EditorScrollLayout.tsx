import { useEffect, useRef, useState, ReactNode } from "react";
import { Check, Lock as LockIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type EditorSection = {
  id: string;
  label: string;
  num?: string | number;
  icon: LucideIcon;
  complete?: boolean;
  locked?: boolean;
};

interface Props {
  sections: EditorSection[];
  children: ReactNode;
  /** Optional right column (e.g. live preview). Hidden on <xl screens. */
  rightPane?: ReactNode;
  /** Sticky header content (title + Save button + status). Always visible. */
  header?: ReactNode;
}

/**
 * Scrollable single-page editor layout.
 * - Desktop (lg+): sticky left sidebar with scroll-spy section list.
 * - Mobile: sticky horizontal chip strip below the header.
 * - Active section detection via IntersectionObserver.
 */
export function EditorScrollLayout({ sections, children, rightPane, header }: Props) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");
  const containerRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Auto-scroll active chip into horizontal center on mobile chip strip.
  useEffect(() => {
    const el = chipRefs.current[active];
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    } catch {}
  }, [active]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;

    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.intersectionRatio);
          else visible.delete(e.target.id);
        }
        // Pick the highest-ratio visible section; otherwise topmost above viewport.
        if (visible.size > 0) {
          let best = "";
          let bestRatio = -1;
          for (const [id, r] of visible) {
            if (r > bestRatio) {
              bestRatio = r;
              best = id;
            }
          }
          if (best) setActive(best);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActive(id);
    }
  };

  return (
    <div className="flex gap-6 min-h-[calc(100vh-8rem)]" ref={containerRef}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col gap-1 w-52 shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
        {sections.map((s, i) => {
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => jumpTo(s.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all border-l-[3px] ${
                isActive
                  ? "bg-primary/10 border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <s.icon size={15} className={isActive ? "text-primary" : ""} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold tracking-[0.05em] text-muted-foreground/50">
                  {s.num ?? i + 1}
                </p>
                <p className="text-[13px] font-semibold leading-tight flex items-center gap-1.5">
                  {s.label}
                  {s.locked && <LockIcon size={10} className="text-amber-500 shrink-0" />}
                </p>
              </div>
              {s.complete && <Check size={14} className="ml-auto text-emerald-500" />}
            </button>
          );
        })}
      </aside>

      <div className="flex-1 flex gap-6 min-w-0">
        <div className="flex-1 max-w-2xl min-w-0">
          {header}

          {/* Mobile sticky chip strip */}
          <div className="lg:hidden sticky top-[52px] z-20 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 bg-background/95 backdrop-blur border-b border-border mb-3">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {sections.map((s, i) => {
                const isActive = active === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => jumpTo(s.id)}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    <s.icon size={12} />
                    <span>
                      {s.num ?? i + 1} {s.label}
                    </span>
                    {s.locked && <LockIcon size={10} className="text-amber-500" />}
                    {s.complete && !isActive && <Check size={10} className="text-emerald-500" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">{children}</div>
        </div>

        {rightPane && (
          <div className="hidden xl:block w-[300px] shrink-0 sticky top-20 self-start h-[calc(100vh-10rem)]">
            {rightPane}
          </div>
        )}
      </div>
    </div>
  );
}

/** Wraps a section block with a stable scroll target id. */
export function EditorSectionBlock({
  id,
  children,
  className = "",
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-24 glass-card p-4 sm:p-6 space-y-4 ${className}`}>
      {children}
    </section>
  );
}
