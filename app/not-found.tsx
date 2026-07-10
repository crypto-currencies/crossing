import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { SectionShell } from "@/components/layout/surface";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <AppShell>
      <SectionShell spacing="default" className="mx-auto max-w-[480px]">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] px-[20px] py-[24px]">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-[12px]">404</p>
          <p className="t-heading text-[var(--text)]">Page not found</p>
          <p className="t-caption mt-[4px] mb-[16px]">This page doesn&apos;t exist or was moved.</p>
          <div className="flex items-center gap-[8px]">
            <Button variant="primary" size="sm" asChild>
              <Link href="/">Go home</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </div>
        </div>
      </SectionShell>
    </AppShell>
  );
}
