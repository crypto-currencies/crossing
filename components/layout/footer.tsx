import Link from "next/link";
import { LogoMark } from "@/components/ui/logo";

// ─── Link column definitions ───────────────────────────────────────────────────

const ACCOUNT_LINKS = [
  { label: "Sign In",          href: "/login"      },
  { label: "Create Account",   href: "/register"   },
  { label: "Dashboard",        href: "/dashboard"  },
  { label: "Settings",         href: "/settings"   },
];

const LEGAL_LINKS = [
  { label: "Terms of Service",      href: "/terms"     },
  { label: "Privacy Policy",        href: "/privacy"   },
  { label: "Content Policy",        href: "/policies"  },
  { label: "DMCA & Copyright",      href: "/dmca"      },
];

const SUPPORT_LINKS = [
  { label: "Account Support",  href: "/support"      },
];

const YEAR = new Date().getFullYear();

// ─── Public footer (unauthenticated / marketing pages) ────────────────────────

export function Footer() {
  return (
    <footer
      className="mt-auto"
      style={{
        position: "relative",
        zIndex: 8,
        background: "var(--bg-soft)",
        borderTop: "1px solid var(--border)",
      }}
      aria-label="Site footer"
    >
      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div
        className="mx-auto px-8 pt-14 pb-10"
        style={{ maxWidth: "var(--page-max)" }}
      >
        <div className="grid gap-x-10 gap-y-14" style={{ gridTemplateColumns: "1.5fr 1fr 1fr 1fr" }}>

          {/* ── Brand column ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">
            <Link
              href="/"
              className="flex items-center gap-3 w-fit"
              aria-label="crossing.dev home"
            >
              <LogoMark size={30} />
              <span className="font-bold tracking-tight text-white" style={{ fontSize: "22px" }}>
                crossing<span style={{ color: "var(--accent-text)" }}>.dev</span>
              </span>
            </Link>

            <p style={{ fontSize: "14px", color: "var(--text-soft)", maxWidth: "220px", lineHeight: "1.7" }}>
              Find the products, services, tools, and communities worth your time.
            </p>

            <div style={{ height: "1px", background: "var(--border)", maxWidth: "220px" }} />

            <div style={{ fontSize: "13px", color: "var(--text-soft)", lineHeight: "1.6" }}>
              <p className="text-white font-semibold">&copy; {YEAR} crossing.dev</p>
              <p style={{ marginTop: "2px" }}>All rights reserved.</p>
            </div>
          </div>

          <FooterCol heading="Account"  links={ACCOUNT_LINKS}  />
          <FooterCol heading="Legal"    links={LEGAL_LINKS}    />
          <FooterCol heading="Support"  links={SUPPORT_LINKS}  />
        </div>
      </div>

      {/* ── Bottom bar ─────────────────────────────────────────────────────── */}
      <div style={{ borderTop: "1px solid var(--border)" }}>
        <div
          className="mx-auto flex flex-col gap-3 px-8 py-5 sm:flex-row sm:items-center sm:justify-between"
          style={{ maxWidth: "var(--page-max)" }}
        >
          <p style={{ fontSize: "12.5px", color: "var(--text-soft)" }}>
            By using crossing.dev you agree to our{" "}
            <Link href="/terms" className="footer-bar-link">Terms of Service</Link>
            {" "}and{" "}
            <Link href="/privacy" className="footer-bar-link">Privacy Policy</Link>.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/terms"     className="footer-bottom-link">Terms</Link>
            <Link href="/privacy"   className="footer-bottom-link">Privacy</Link>
            <Link href="/policies"  className="footer-bottom-link">Content Policy</Link>
            <Link href="/dmca"      className="footer-bottom-link">DMCA</Link>
            <Link href="/support"    className="footer-bottom-link">Support</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Compact app footer (authenticated / dashboard pages) ─────────────────────

export function AppFooter() {
  return (
    <footer
      className="mt-auto"
      style={{
        position: "relative",
        zIndex: 8,
        borderTop: "1px solid var(--border)",
        background: "var(--bg-soft)",
      }}
      aria-label="App footer"
    >
      <div
        className="mx-auto flex flex-col gap-2 px-6 py-[14px] sm:flex-row sm:items-center sm:justify-between"
        style={{ maxWidth: "var(--page-max)" }}
      >
        <div className="flex items-center gap-[9px]">
          <LogoMark size={17} />
          <span style={{ fontSize: "12.5px", color: "var(--text-soft)", fontWeight: 500 }}>
            &copy; {YEAR} crossing.dev — All rights reserved
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-[5px]">
          <Link href="/terms"     className="footer-bottom-link">Terms</Link>
          <Link href="/privacy"   className="footer-bottom-link">Privacy</Link>
          <Link href="/policies"  className="footer-bottom-link">Content Policy</Link>
          <Link href="/dmca"      className="footer-bottom-link">DMCA</Link>
          <Link href="/support"    className="footer-bottom-link">Support</Link>
        </div>
      </div>
    </footer>
  );
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

function FooterCol({
  heading,
  links,
}: {
  heading: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Category heading — not a link */}
      <div>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#ffffff", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          {heading}
        </p>
        <div style={{ marginTop: "9px", height: "2px", width: "24px", borderRadius: "2px", background: "linear-gradient(90deg, var(--accent) 0%, transparent 100%)" }} />
      </div>

      <ul className="flex flex-col gap-[10px]">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="footer-col-link">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
