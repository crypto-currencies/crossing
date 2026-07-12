import Link from "next/link";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionShell } from "@/components/layout/surface";
import { PageTransition } from "@/components/motion/page-transition";

interface SignInGateProps {
  title: string;
  description: string;
  returnTo: string;
}

/**
 * Full-page auth gate for routes that are real, working pages but require
 * an account (Saved, Submit, Submissions) — never a hard redirect. The
 * route itself always resolves; this is what renders in place of the real
 * content when there's no session, with a path back via ?redirect=.
 */
export function SignInGate({ title, description, returnTo }: SignInGateProps) {
  return (
    <PageTransition>
      <div className="page-stack">
        <SectionShell spacing="tight">
          <PageHeader title={title} description={description} />
        </SectionShell>
        <SectionShell spacing="default">
          <div className="flex flex-col items-center gap-[16px] rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--panel)] px-[24px] py-[56px] text-center">
            <div className="flex size-[44px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel-2)]">
              <LogIn className="size-[18px] text-[var(--muted)]" aria-hidden />
            </div>
            <div className="stack-xs max-w-[360px]">
              <p className="t-label text-[var(--text)]">Sign in required</p>
              <p className="t-body-sm text-[var(--text-soft)]">{description}</p>
            </div>
            <Button variant="primary" size="md" asChild className="mt-[6px]">
              <Link href={`/login?redirect=${encodeURIComponent(returnTo)}`}>Log in</Link>
            </Button>
          </div>
        </SectionShell>
      </div>
    </PageTransition>
  );
}
