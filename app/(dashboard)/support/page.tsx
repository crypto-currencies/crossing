import type { Metadata } from "next";
import { PageTransition } from "@/components/motion/page-transition";
import { PageHeader, SectionShell } from "@/components/layout/surface";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Support — Crossing.dev" };

export default function SupportPage() {
  return (
    <PageTransition>
      <div className="page-stack">
        <SectionShell spacing="tight">
          <PageHeader title="Support" description="Need help with your account?" />
        </SectionShell>
        <SectionShell spacing="default">
          <Card variant="default" padding="xl" className="max-w-[560px]">
            <p className="t-body-sm text-[var(--text-soft)]">
              Email us at{" "}
              <a href="mailto:support@crossing.dev" className="underline underline-offset-2 hover:text-[var(--text)]">
                support@crossing.dev
              </a>{" "}
              and we&apos;ll get back to you.
            </p>
          </Card>
        </SectionShell>
      </div>
    </PageTransition>
  );
}
