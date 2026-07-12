/** Maps Prisma submission rows -> client-facing DTOs (types/index.ts). */

import type { UserSubmissionRow, AdminSubmissionRow } from "./data";
import type { Submission, AdminSubmission } from "@/types";

export function mapSubmission(row: UserSubmissionRow): Submission {
  return {
    id: row.id,
    name: row.name,
    websiteUrl: row.websiteUrl,
    tagline: row.tagline,
    description: row.description,
    status: row.status,
    moderatorNote: row.moderatorNote,
    category: row.category,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    listingSlug: row.listing?.slug ?? null,
  };
}

export function mapAdminSubmission(row: AdminSubmissionRow): AdminSubmission {
  return {
    ...mapSubmission(row),
    submittedBy: row.submittedBy,
    reviewedBy: row.reviewedBy,
  };
}
