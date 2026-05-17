import { Link, useLocation, useNavigate } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { Menu, X, ChevronDown, Home, Shield, Network, GraduationCap } from "lucide-react";
import { useState, useEffect } from "react";

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

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b border-white/[0.06] bg-hero-bg/85 supports-[backdrop-filter]:bg-hero-bg/70">
      <div className="container-app flex items-center justify-between h-16">
        <Link to="/">
          <Logo variant="full" />
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <a href="/#features" onClick={(e) => handleSectionClick(e, "#features")} className="text-sm text-white/80 hover:text-white transition-colors cursor-pointer">Features</a>

          {/* Use Cases dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setUseCasesOpen(true)}
            onMouseLeave={() => setUseCasesOpen(false)}
          >
            <button
              type="button"
              className="flex items-center gap-1 text-sm text-white/80 hover:text-white transition-colors cursor-pointer"
              onClick={() => setUseCasesOpen((v) => !v)}
              aria-expanded={useCasesOpen}
            >
              Use Cases
              <ChevronDown size={14} className={`transition-transform ${useCasesOpen ? "rotate-180" : ""}`} />
            </button>
            {useCasesOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 w-[320px]">
                <div className="rounded-xl border border-white/10 bg-hero-bg/95 backdrop-blur-xl shadow-elegant p-2">
                  {useCases.map(({ Icon, title, tag, to }) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setUseCasesOpen(false)}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.06] transition-colors group"
                    >
                      <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-brand">
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white group-hover:text-brand-emerald transition-colors">{title}</div>
                        <div className="text-xs text-white/60">{tag}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <a href="/#pricing" onClick={(e) => handleSectionClick(e, "#pricing")} className="text-sm text-white/80 hover:text-white transition-colors cursor-pointer">Pricing</a>
          <a href="/#faq" onClick={(e) => handleSectionClick(e, "#faq")} className="text-sm text-white/80 hover:text-white transition-colors cursor-pointer">FAQ</a>
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 min-h-11">Log in</Button>
          </Link>
          <Link to="/auth?tab=signup">
            <button className="btn-saffron-premium btn-sm">Start Free</button>
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <button className="text-white p-2 min-h-11 min-w-11 flex items-center justify-center" onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/[0.06] p-4 flex flex-col gap-3 bg-hero-bg/95">
          <a href="/#features" onClick={(e) => handleSectionClick(e, "#features")} className="text-sm text-white/80 py-3 cursor-pointer min-h-11">Features</a>

          {/* Mobile Use Cases accordion */}
          <button
            type="button"
            className="flex items-center justify-between text-sm text-white/80 py-3 min-h-11"
            onClick={() => setMobileUseCasesOpen((v) => !v)}
            aria-expanded={mobileUseCasesOpen}
          >
            <span>Use Cases</span>
            <ChevronDown size={16} className={`transition-transform ${mobileUseCasesOpen ? "rotate-180" : ""}`} />
          </button>
          {mobileUseCasesOpen && (
            <div className="flex flex-col gap-1 pl-2 -mt-2 mb-1 border-l border-white/10">
              {useCases.map(({ Icon, title, tag, to }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.06] min-h-11"
                >
                  <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-brand">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{title}</div>
                    <div className="text-xs text-white/60">{tag}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <a href="/#pricing" onClick={(e) => handleSectionClick(e, "#pricing")} className="text-sm text-white/80 py-3 cursor-pointer min-h-11">Pricing</a>
          <a href="/#faq" onClick={(e) => handleSectionClick(e, "#faq")} className="text-sm text-white/80 py-3 cursor-pointer min-h-11">FAQ</a>
          <Link to="/auth" onClick={() => setOpen(false)}>
            <Button variant="outline" className="w-full bg-transparent border-white/20 text-white hover:bg-white/10 min-h-11">Log in</Button>
          </Link>
          <Link to="/auth?tab=signup" onClick={() => setOpen(false)}>
            <Button className="w-full text-white border-0 bg-gradient-brand min-h-11">Start Free</Button>
          </Link>
        </div>
      )}
    </nav>
  );
};
