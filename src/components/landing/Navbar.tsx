import { Link, useLocation, useNavigate } from "@/lib/router-compat";
import { Logo } from "./Logo";
import { Menu, X, ChevronDown, Home, Shield, Network, GraduationCap, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";

const useCases = [
  { Icon: Home, title: "Real Estate", tag: "Property tours that close", to: "/use-cases/real-estate" },
  { Icon: Shield, title: "Insurance Agents", tag: "Policy explainers that qualify leads", to: "/use-cases/insurance-agents" },
  { Icon: Network, title: "Network Marketing", tag: "Plan videos that convert", to: "/use-cases/network-marketing" },
  { Icon: GraduationCap, title: "Online Coaches", tag: "Course previews that sell", to: "/use-cases/coaches" },
];

export const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [useCasesOpen, setUseCasesOpen] = useState(false);
  const [mobileUseCasesOpen, setMobileUseCasesOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isHome = location.pathname === "/";

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1);
      const t = setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
      return () => clearTimeout(t);
    }
  }, [location.pathname, location.hash]);

  const handleSectionClick = (e: React.MouseEvent, hash: string) => {
    e.preventDefault();
    setOpen(false);
    const id = hash.replace("#", "");
    if (isHome) {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", `/#${id}`);
      }
    } else {
      navigate(`/#${id}`);
    }
  };

  const linkCls = "text-sm transition-colors cursor-pointer";
  const linkStyle: React.CSSProperties = { color: "var(--text-secondary)" };
  const linkHover: React.CSSProperties = {};

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl"
      style={{
        background: "color-mix(in oklab, var(--bg-base) 80%, transparent)",
        borderBottom: "1px solid var(--border-subtle-c)",
      }}
    >
      <div className="container-app flex items-center justify-between h-16">
        <Link to="/" aria-label="Nevorai home">
          <Logo />
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <a
            href="/#features"
            onClick={(e) => handleSectionClick(e, "#features")}
            className={linkCls}
            style={linkStyle}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            Features
          </a>

          <div
            className="relative"
            onMouseEnter={() => setUseCasesOpen(true)}
            onMouseLeave={() => setUseCasesOpen(false)}
          >
            <button
              type="button"
              className="flex items-center gap-1 text-sm cursor-pointer transition-colors"
              style={linkStyle}
              onClick={() => setUseCasesOpen((v) => !v)}
              aria-expanded={useCasesOpen}
            >
              Use Cases
              <ChevronDown size={14} className={`transition-transform ${useCasesOpen ? "rotate-180" : ""}`} />
            </button>
            {useCasesOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 w-[320px]">
                <div
                  className="rounded-xl backdrop-blur-xl p-2"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-subtle-c)",
                    boxShadow: "0 12px 32px -8px rgba(0,0,0,0.15)",
                  }}
                >
                  {useCases.map(({ Icon, title, tag, to }) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setUseCasesOpen(false)}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors group"
                      style={{ color: "var(--text-primary)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-glass)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div
                        className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: "var(--bg-glass)", border: "1px solid var(--border-subtle-c)" }}
                      >
                        <Icon className="h-4 w-4" style={{ color: "var(--text-primary)" }} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</div>
                        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{tag}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <a
            href="/#pricing"
            onClick={(e) => handleSectionClick(e, "#pricing")}
            className={linkCls}
            style={linkStyle}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            Pricing
          </a>
          <a
            href="/#faq"
            onClick={(e) => handleSectionClick(e, "#faq")}
            className={linkCls}
            style={linkStyle}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            FAQ
          </a>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="theme-toggle-btn"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <Link to="/auth">
            <button
              className="text-sm px-3 py-2 rounded-lg transition-colors min-h-10"
              style={{ color: "var(--text-primary)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-glass)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              Log in
            </button>
          </Link>
          <Link to="/auth?tab=signup">
            <button className="btn-saffron-premium btn-sm">Start Free</button>
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="theme-toggle-btn"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            className="p-2 min-h-11 min-w-11 flex items-center justify-center"
            style={{ color: "var(--text-primary)" }}
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <div
          className="md:hidden p-4 flex flex-col gap-3"
          style={{
            borderTop: "1px solid var(--border-subtle-c)",
            background: "var(--bg-base)",
          }}
        >
          <a
            href="/#features"
            onClick={(e) => handleSectionClick(e, "#features")}
            className="text-sm py-3 cursor-pointer min-h-11"
            style={{ color: "var(--text-primary)" }}
          >
            Features
          </a>

          <button
            type="button"
            className="flex items-center justify-between text-sm py-3 min-h-11"
            style={{ color: "var(--text-primary)" }}
            onClick={() => setMobileUseCasesOpen((v) => !v)}
            aria-expanded={mobileUseCasesOpen}
          >
            <span>Use Cases</span>
            <ChevronDown size={16} className={`transition-transform ${mobileUseCasesOpen ? "rotate-180" : ""}`} />
          </button>
          {mobileUseCasesOpen && (
            <div className="flex flex-col gap-1 pl-2 -mt-2 mb-1" style={{ borderLeft: "1px solid var(--border-subtle-c)" }}>
              {useCases.map(({ Icon, title, tag, to }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-lg min-h-11"
                  style={{ color: "var(--text-primary)" }}
                >
                  <div
                    className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "var(--bg-glass)", border: "1px solid var(--border-subtle-c)" }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{title}</div>
                    <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{tag}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <a
            href="/#pricing"
            onClick={(e) => handleSectionClick(e, "#pricing")}
            className="text-sm py-3 min-h-11"
            style={{ color: "var(--text-primary)" }}
          >
            Pricing
          </a>
          <a
            href="/#faq"
            onClick={(e) => handleSectionClick(e, "#faq")}
            className="text-sm py-3 min-h-11"
            style={{ color: "var(--text-primary)" }}
          >
            FAQ
          </a>
          <Link to="/auth" onClick={() => setOpen(false)}>
            <button
              className="w-full min-h-11 rounded-lg py-2 px-4"
              style={{
                background: "var(--bg-glass)",
                border: "1px solid var(--border-strong-c)",
                color: "var(--text-primary)",
              }}
            >
              Log in
            </button>
          </Link>
          <Link to="/auth?tab=signup" onClick={() => setOpen(false)}>
            <button className="btn-saffron-premium w-full min-h-11">Start Free</button>
          </Link>
        </div>
      )}
    </nav>
  );
};
