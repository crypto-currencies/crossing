import type { ReactNode } from "react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Card } from "@/components/ui/card";
import { PageTransition } from "@/components/motion";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const LEGAL_PAGES = [
  { label: "Terms", href: ROUTES.legal.terms },
  { label: "Privacy", href: ROUTES.legal.privacy },
  { label: "Policies", href: ROUTES.legal.policies },
  { label: "DMCA", href: ROUTES.legal.dmca },
  { label: "Cookies", href: ROUTES.site.cookies },
  { label: "Promotion disclosure", href: ROUTES.site.promotionDisclosure },
];

interface LegalLayoutProps {
  title: string;
  updated: string;
  active: string;
  children: ReactNode;
}

export function LegalLayout({ title, updated, active, children }: LegalLayoutProps) {
  return (
    <PageTransition>
      <Container size="lg" className="pb-24">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr]">
          <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {LEGAL_PAGES.map((page) => (
              <Card key={page.label} shape="row" className={cn(page.href === active && "bg-navy-600/40")}>
                <Link href={page.href} className="t-body-sm block w-full whitespace-nowrap text-[var(--text-primary)]">
                  {page.label}
                </Link>
              </Card>
            ))}
          </nav>

          <div>
            <h1 className="t-display-md">{title}</h1>
            <p className="t-caption mt-2">Last updated {updated}</p>
            <div className="t-body mt-8 flex flex-col gap-5 text-[var(--text-secondary)] [&_h2]:t-heading [&_h2]:mt-4 [&_h2]:text-[var(--text-primary)]">
              {children}
            </div>
          </div>
        </div>
      </Container>
    </PageTransition>
  );
}
