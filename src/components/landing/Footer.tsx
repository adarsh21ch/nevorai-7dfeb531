import { brand } from "@/config/brand";
import { Logo } from "./Logo";
import { Link } from "@/lib/router-compat";

const links = {
  Product: [
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
    { label: "FAQ", href: "/faq" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Refund Policy", href: "/refund-policy" },
  ],
};

export const Footer = () => {
  return (
    <footer className="border-t border-border-subtle/10 py-12 sm:py-16">
      <div className="container-app">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 mb-10 sm:mb-12">
          <div>
            <Logo variant="full" size="sm" />
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              Nevorai Flow helps you control follow-up through video — so prospects actually watch, understand, and convert.
            </p>
          </div>
          {Object.entries(links).map(([title, items]) => (
            <div key={title}>
              <h4 className="text-sm font-heading font-semibold mb-4">{title}</h4>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.label}>
                    {item.href.startsWith("/") ? (
                      <Link to={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {item.label}
                      </Link>
                    ) : (
                      <a href={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {item.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border-subtle/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">{brand.footer.copyright}</p>
          <p className="text-xs text-muted-foreground">{brand.footer.madeIn}</p>
        </div>
      </div>
    </footer>
  );
};
