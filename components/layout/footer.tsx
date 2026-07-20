import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Container } from "@/components/layout/container";
import { ROUTES } from "@/lib/routes";

const FOOTER_LINKS = [
  { label: "Discover", href: "/discover" },
  { label: "Browse", href: "/browse" },
  { label: "About", href: ROUTES.site.about },
  { label: "Business", href: ROUTES.site.business },
  { label: "Journal", href: ROUTES.site.journal },
  { label: "Privacy", href: ROUTES.legal.privacy },
  { label: "Terms", href: ROUTES.legal.terms },
] as const;

export function Footer() {
  return (
    <footer className="site-footer">
      <Container size="xl">
        <div className="site-footer-main">
          <Logo />
          <nav className="site-footer-links" aria-label="Footer navigation">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>{link.label}</Link>
            ))}
          </nav>
        </div>
        <div className="site-footer-bottom">
          <span>&copy; {new Date().getFullYear()} Crossing</span>
          <span>Find what holds up.</span>
        </div>
      </Container>
    </footer>
  );
}
