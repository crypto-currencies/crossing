import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Container } from "@/components/layout/container";

const FOOTER_GROUPS = [
  {
    label: "Product",
    links: [
      { label: "Discover", href: "/discover" },
      { label: "Browse", href: "/browse" },
      { label: "Saved", href: "/saved" },
      { label: "Search", href: "/search" },
    ],
  },
  {
    label: "Business",
    links: [
      { label: "For Business", href: "/business" },
      { label: "Business access", href: "/login?intent=business" },
      { label: "Submit a listing", href: "/submit" },
      { label: "Promotion disclosure", href: "/promotion-disclosure" },
    ],
  },
  {
    label: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "How it works", href: "/how-it-works" },
      { label: "How recommendations work", href: "/ranking-methodology" },
      { label: "Journal", href: "/journal" },
      { label: "Contribute", href: "/contribute" },
      { label: "Attributions", href: "/attributions" },
    ],
  },
  {
    label: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Cookies", href: "/cookies" },
      { label: "Policies", href: "/policies" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="site-footer">
      <Container size="xl">
        <div className="site-footer-grid">
          <div className="site-footer-brand">
            <Logo />
            <p>What’s worth your time?</p>
            <span>Recommendations with the reason, evidence, and tradeoff kept in view.</span>
          </div>
          {FOOTER_GROUPS.map((group) => (
            <nav key={group.label} aria-label={`${group.label} links`}>
              <p>{group.label}</p>
              {group.links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
            </nav>
          ))}
        </div>
        <div className="site-footer-bottom">
          <span>&copy; {new Date().getFullYear()} Crossing</span>
          <span>Coverage and source limits are shown where they matter.</span>
        </div>
      </Container>
    </footer>
  );
}
