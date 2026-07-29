import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/layout/container";
import { PageHero } from "@/components/marketing/page-hero";

export interface PlaceholderAction {
  label: string;
  href: string;
}

/**
 * Intentional empty state for a route that exists in navigation but has no
 * implemented product surface yet.
 *
 * This replaces `return null` pages, which rendered as a completely blank screen
 * with no way to navigate onward. Every placeholder states plainly that the
 * feature isn't available yet and offers at least one real destination — we
 * never imply functionality that doesn't exist.
 */
export function PagePlaceholder({
  eyebrow,
  title,
  subtitle,
  status = "Not available yet",
  body,
  actions = [{ label: "Back to home", href: "/" }],
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  status?: string;
  body?: string;
  actions?: PlaceholderAction[];
  children?: ReactNode;
}) {
  return (
    <div>
      <PageHero eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <Container size="content" className="pb-24">
        <div className="page-placeholder">
          <p className="page-placeholder-status">{status}</p>
          {body && <p className="page-placeholder-body">{body}</p>}
          {children}
          <div className="page-placeholder-actions">
            {actions.map((a) => (
              <Link key={a.href} href={a.href}>
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}
