import type { Prisma, SubmissionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type { PageParams } from "@/lib/server/pagination";
import { normalizeUrlKey } from "@/lib/server/url-normalize";
import { createListingFromSubmission } from "@/features/listings/data";
import type { SubmissionCreateInput, SubmissionApproveOverrides } from "./validation";

// ─── Shared shapes ──────────────────────────────────────────────────────────

export const userSubmissionInclude = {
  category: { select: { id: true, name: true, slug: true, icon: true } },
  listing: { select: { slug: true } },
} satisfies Prisma.SubmissionInclude;

export type UserSubmissionRow = Prisma.SubmissionGetPayload<{ include: typeof userSubmissionInclude }>;

export const adminSubmissionInclude = {
  category: { select: { id: true, name: true, slug: true, icon: true } },
  submittedBy: { select: { id: true, name: true, email: true } },
  reviewedBy: { select: { id: true, name: true } },
  listing: { select: { slug: true } },
} satisfies Prisma.SubmissionInclude;

export type AdminSubmissionRow = Prisma.SubmissionGetPayload<{ include: typeof adminSubmissionInclude }>;

export type CreateSubmissionResult =
  | { ok: true; submission: Awaited<ReturnType<typeof db.submission.create>> }
  | { ok: false; error: "invalid_category" | "duplicate_pending" | "duplicate_listing" };

/**
 * Creates a PENDING submission. Rejects up front (no row written) if:
 *   - the category doesn't exist or is inactive
 *   - this user already has a PENDING submission for the same normalized URL
 *   - a PUBLISHED listing already exists for the same normalized URL
 * Doesn't block resubmission after a REJECTED submission — a moderator note
 * on the earlier attempt should tell the user what to fix and resubmitting
 * is the expected next step.
 */
export async function createSubmission(
  userId: string,
  input: SubmissionCreateInput
): Promise<CreateSubmissionResult> {
  const category = await db.category.findUnique({ where: { id: input.categoryId } });
  if (!category || !category.isActive) {
    return { ok: false, error: "invalid_category" };
  }

  const websiteUrlKey = normalizeUrlKey(input.websiteUrl);

  const [existingPending, existingListing] = await Promise.all([
    db.submission.findFirst({
      where: { submittedById: userId, websiteUrlKey, status: "PENDING" },
      select: { id: true },
    }),
    db.listing.findUnique({ where: { websiteUrlKey }, select: { id: true } }),
  ]);
  if (existingPending) return { ok: false, error: "duplicate_pending" };
  if (existingListing) return { ok: false, error: "duplicate_listing" };

  const submission = await db.submission.create({
    data: {
      name: input.name,
      websiteUrl: input.websiteUrl,
      websiteUrlKey,
      tagline: input.tagline,
      description: input.description,
      categoryId: input.categoryId,
      submittedById: userId,
    },
  });

  return { ok: true, submission };
}

export async function listUserSubmissions(userId: string, page: PageParams) {
  const where = { submittedById: userId };
  const [items, total] = await Promise.all([
    db.submission.findMany({
      where,
      include: userSubmissionInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.take,
    }),
    db.submission.count({ where }),
  ]);
  return { items, page: page.page, pageSize: page.pageSize, total };
}

export async function listPendingSubmissionsForAdmins(page: PageParams) {
  return listSubmissionsForAdmins("PENDING", page);
}

/**
 * Admin-facing submission queue, filterable by status so the moderation UI
 * can show "previous review history" (already-approved/rejected submissions)
 * as well as the live pending queue — not just PENDING.
 */
export async function listSubmissionsForAdmins(status: SubmissionStatus, page: PageParams) {
  const where = { status };
  const [items, total] = await Promise.all([
    db.submission.findMany({
      where,
      include: adminSubmissionInclude,
      // Pending queue is FIFO (oldest first); reviewed history reads newest-first.
      orderBy:
        status === "PENDING"
          ? [{ createdAt: "asc" }, { id: "asc" }]
          : [{ reviewedAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.take,
    }),
    db.submission.count({ where }),
  ]);
  return { items, page: page.page, pageSize: page.pageSize, total };
}

export type ApproveSubmissionResult =
  | { ok: true; listingSlug: string }
  | { ok: false; error: "not_found" | "not_pending" };

/**
 * Approve a submission, optionally correcting obvious formatting issues
 * (typos, stray whitespace, a mistyped URL) before it becomes public.
 * Overrides are already validated (see submissionApproveOverridesSchema) by
 * the time they reach here — this only decides which value wins.
 * `websiteUrl` overrides are re-normalized so the duplicate-URL guarantee
 * still holds against the edited value, not the original.
 */
export async function approveSubmission(
  submissionId: string,
  adminId: string,
  overrides?: SubmissionApproveOverrides
): Promise<ApproveSubmissionResult> {
  const submission = await db.submission.findUnique({ where: { id: submissionId } });
  if (!submission) return { ok: false, error: "not_found" };
  if (submission.status !== "PENDING") return { ok: false, error: "not_pending" };

  const finalWebsiteUrl = overrides?.websiteUrl?.trim() || submission.websiteUrl;
  const finalWebsiteUrlKey =
    overrides?.websiteUrl?.trim() ? normalizeUrlKey(finalWebsiteUrl) : submission.websiteUrlKey;

  const listing = await db.$transaction(async (tx) => {
    const created = await createListingFromSubmission(tx, {
      name: overrides?.name?.trim() || submission.name,
      tagline: overrides?.tagline?.trim() || submission.tagline,
      description: overrides?.description?.trim() || submission.description,
      websiteUrl: finalWebsiteUrl,
      websiteUrlKey: finalWebsiteUrlKey,
      categoryId: submission.categoryId,
      submittedById: submission.submittedById,
      approvedById: adminId,
    });

    await tx.submission.update({
      where: { id: submissionId },
      data: {
        status: "APPROVED",
        reviewedById: adminId,
        reviewedAt: new Date(),
        listingId: created.id,
      },
    });

    await tx.notification.create({
      data: {
        userId: submission.submittedById,
        type: "submission_approved",
        title: "Your submission was approved",
        body: `"${created.name}" is now live on Crossing.dev.`,
        href: `/listing/${created.slug}`,
        entityId: created.id,
        entityType: "listing",
      },
    });

    return created;
  });

  return { ok: true, listingSlug: listing.slug };
}

export type RejectSubmissionResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "not_pending" };

export async function rejectSubmission(
  submissionId: string,
  adminId: string,
  moderatorNote?: string
): Promise<RejectSubmissionResult> {
  const submission = await db.submission.findUnique({ where: { id: submissionId } });
  if (!submission) return { ok: false, error: "not_found" };
  if (submission.status !== "PENDING") return { ok: false, error: "not_pending" };

  await db.$transaction([
    db.submission.update({
      where: { id: submissionId },
      data: {
        status: "REJECTED",
        reviewedById: adminId,
        reviewedAt: new Date(),
        moderatorNote: moderatorNote ?? null,
      },
    }),
    db.notification.create({
      data: {
        userId: submission.submittedById,
        type: "submission_rejected",
        title: "Your submission wasn't approved",
        body: moderatorNote?.trim()
          ? `"${submission.name}": ${moderatorNote.trim()}`
          : `"${submission.name}" wasn't approved for listing.`,
        entityId: submissionId,
        entityType: "submission",
      },
    }),
  ]);

  return { ok: true };
}
