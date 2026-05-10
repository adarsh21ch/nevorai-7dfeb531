import { Link, useLocation, useNavigate } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { Menu, X, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";

export const Navbar = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";
  const { theme, toggleTheme } = useTheme();

  // Smooth-scroll to hash after navigation (and on initial load)
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1);
      // Wait a tick for DOM to render
      const t = setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
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
        // Update URL hash without jump
        window.history.replaceState(null, "", `/#${id}`);
      }
    } else {
      navigate(`/#${id}`);
    }
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b"
      style={{
        background: "rgba(6, 12, 26, 0.85)",
        WebkitBackdropFilter: "blur(20px)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      <div className="container flex items-center justify-between h-16">
        <Link to="/">
          <Logo showByline />
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <a href="/#features" onClick={(e) => handleSectionClick(e, "#features")} className="text-sm text-white/80 hover:text-white transition-colors cursor-pointer">Features</a>
          <a href="/#pricing" onClick={(e) => handleSectionClick(e, "#pricing")} className="text-sm text-white/80 hover:text-white transition-colors cursor-pointer">Pricing</a>
          <a href="/#faq" onClick={(e) => handleSectionClick(e, "#faq")} className="text-sm text-white/80 hover:text-white transition-colors cursor-pointer">FAQ</a>
          <button onClick={toggleTheme} className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">Log in</Button>
          </Link>
          <Link to="/auth?tab=signup">
            <Button size="sm" className="text-white border-0" style={{ background: "linear-gradient(135deg, #00C896, #0066FF)" }}>Start Free</Button>
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <button onClick={toggleTheme} className="text-white/80 hover:text-white p-2 rounded-lg">
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="text-white" onClick={() => setOpen(!open)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t p-4 flex flex-col gap-3" style={{ background: "rgba(6,12,26,0.95)", borderColor: "rgba(255,255,255,0.06)" }}>
          <a href="/#features" onClick={(e) => handleSectionClick(e, "#features")} className="text-sm text-white/80 py-2 cursor-pointer">Features</a>
          <a href="/#pricing" onClick={(e) => handleSectionClick(e, "#pricing")} className="text-sm text-white/80 py-2 cursor-pointer">Pricing</a>
          <a href="/#faq" onClick={(e) => handleSectionClick(e, "#faq")} className="text-sm text-white/80 py-2 cursor-pointer">FAQ</a>
          <Link to="/auth" onClick={() => setOpen(false)}>
            <Button variant="outline" className="w-full bg-transparent border-white/20 text-white hover:bg-white/10">Log in</Button>
          </Link>
          <Link to="/auth?tab=signup" onClick={() => setOpen(false)}>
            <Button className="w-full text-white border-0" style={{ background: "linear-gradient(135deg, #00C896, #0066FF)" }}>Start Free</Button>
          </Link>
        </div>
      )}
    </nav>
  );
};
