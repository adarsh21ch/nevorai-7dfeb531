import { Link, useLocation, useNavigate } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

export const Navbar = () => {
  const [open, setOpen] = useState(false);
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
          <a href="/#pricing" onClick={(e) => handleSectionClick(e, "#pricing")} className="text-sm text-white/80 hover:text-white transition-colors cursor-pointer">Pricing</a>
          <a href="/#faq" onClick={(e) => handleSectionClick(e, "#faq")} className="text-sm text-white/80 hover:text-white transition-colors cursor-pointer">FAQ</a>
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 min-h-11">Log in</Button>
          </Link>
          <Link to="/auth?tab=signup">
            <Button size="sm" className="text-white border-0 bg-gradient-brand min-h-11">Start Free</Button>
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
