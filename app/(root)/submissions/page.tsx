import type { Metadata } from "next";
import Link from "next/link";
import { Clock, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { relativeTime } from "@/lib/utils";
import { DB_AVAILABLE } from "@/lib/db";
import { getServerUser } from "@/lib/server/auth";
import { listUserSubmissions } from "@/features/submissions/data";
import { mapSubmission } from "@/features/submissions/dto";
import { SignInGate } from "@/components/product/sign-in-gate";
import { PageTransition } from "@/components/motion/page-transition";
import { PageHeader, SectionShell } from "@/components/layout/surface";
import { CategoryIcon } from "@/components/listings/category-icon";
import { EmptyState } from "@/components/product/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Submission, SubmissionStatus } from "@/types";

export const metadata: Metadata = { title: "My submissions — Crossing.dev" };

const PAGE_SIZE = 20;

const STATUS_META: Record<SubmissionStatus, { label: string; icon: typeof Clock; className: string }> = {
  PENDING: { label: "Pending review", icon: Clock, className: "text-[var(--text-soft)] border-[var(--border)] bg-[var(--panel-2)]" },
  APPROVED: { label: "Approved", icon: CheckCircle2, className: "text-[var(--success)] border-[rgba(34,197,94,0.24)] bg-[rgba(34,197,94,0.08)]" },
  REJECTED: { label: "Not approved", icon: XCircle, className: "text-[var(--danger)] border-[rgba(239,68,68,0.24)] bg-[rgba(239,68,68,0.08)]" },
};

interface SubmissionsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function SubmissionsPage({ searchParams }: SubmissionsPageProps) {
  if (!DB_AVAILABLE) {
    return (
      <SignInGate
        title="My submissions"
        description="Submission history isn't available right now — the database is temporarily unreachable."
        returnTo="/submissions"
      />
    );
  }

  const user = await getServerUser();
  if (!user) {
    return (
      <SignInGate title="My submissions" description="Sign in to see the listings you've submitted." returnTo="/submissions" />
    );
  }

  const { page: rawPage } = await searchParams;
  const pageNum = Math.max(1, Number(rawPage) || 1);
  const page = { page: pageNum, pageSize: PAGE_SIZE, skip: (pageNum - 1) * PAGE_SIZE, take: PAGE_SIZE };

  const result = await listUserSubmissions(user.id, page);
  const items = result.items.map(mapSubmission);
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <PageTransition>
      <div className="page-stack">
        <SectionShell spacing="tight">
          <PageHeader
            title="My submissions"
            description="Everything you've submitted, and where it stands."
            action={
              <Button variant="primary" size="md" asChild>
                <Link href="/submit">Submit a listing</Link>
              </Button>
            }
          />
        </SectionShell>

        <SectionShell spacing="default" className="pb-[80px]">
          {items.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No submissions yet"
              description="Found something worth discovering? Submit it and track its review here."
              action={{ label: "Submit a listing", href: "/submit" }}
            />
          ) : (
            <>
              <div className="stack-sm">
                {items.map((s) => (
                  <SubmissionRow key={s.id} submission={s} />
                ))}
              </div>

              {totalPages > 1 && (
                <nav className="mt-[24px] flex items-center justify-center gap-[8px]" aria-label="Pagination">
                  <Link
                    href={`/submissions?page=${pageNum - 1}`}
                    aria-disabled={pageNum <= 1}
                    className={cn(
                      "flex items-center gap-[4px] rounded-[var(--radius-md)] border border-[var(--border)] px-[12px] py-[7px] text-[12.5px] text-[var(--text-soft)] hover:border-[var(--border-strong)]",
                      pageNum <= 1 && "pointer-events-none opacity-30"
                    )}
                  >
                    <ChevronLeft className="size-[13px]" />
                    Previous
                  </Link>
                  <span className="text-[12px] text-[var(--muted)]">Page {pageNum} of {totalPages}</span>
                  <Link
                    href={`/submissions?page=${pageNum + 1}`}
                    aria-disabled={pageNum >= totalPages}
                    className={cn(
                      "flex items-center gap-[4px] rounded-[var(--radius-md)] border border-[var(--border)] px-[12px] py-[7px] text-[12.5px] text-[var(--text-soft)] hover:border-[var(--border-strong)]",
                      pageNum >= totalPages && "pointer-events-none opacity-30"
                    )}
                  >
                    Next
                    <ChevronRight className="size-[13px]" />
                  </Link>
                </nav>
              )}
            </>
          )}
        </SectionShell>
      </div>
    </PageTransition>
  );
}

function SubmissionRow({ submission }: { submission: Submission }) {
  const meta = STATUS_META[submission.status];
  const Icon = meta.icon;

  return (
    <div className="card flex flex-col gap-[10px] bg-[var(--panel)] border-[var(--border)] p-[18px] sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-[8px]">
          {submission.status === "APPROVED" && submission.listingSlug ? (
            <Link href={`/listing/${submission.listingSlug}`} className="text-[14px] font-semibold text-[var(--text)] hover:underline">
              {submission.name}
            </Link>
          ) : (
            <span className="text-[14px] font-semibold text-[var(--text)]">{submission.name}</span>
          )}
          <span
            className={cn(
              "flex items-center gap-[4px] rounded-full border px-[8px] py-[2px] text-[10.5px] font-medium",
              meta.className
            )}
          >
            <Icon className="size-[10px]" />
            {meta.label}
          </span>
        </div>
        <p className="mt-[3px] text-[12.5px] text-[var(--text-soft)]">{submission.tagline}</p>
        <div className="mt-[8px] flex items-center gap-[6px] text-[11px] text-[var(--muted)]">
          <CategoryIcon name={submission.category.icon} className="size-[10px]" />
          {submission.category.name}
          <span aria-hidden>·</span>
          Submitted {relativeTime(submission.createdAt)}
        </div>
        {submission.status === "REJECTED" && submission.moderatorNote && (
          <p className="mt-[10px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-2)] px-[10px] py-[8px] text-[12px] text-[var(--text-soft)]">
            <span className="font-medium text-[var(--text)]">Moderator note: </span>
            {submission.moderatorNote}
          </p>
        )}
      </div>
    </div>
  );
}
