/**
 * Submission input shape is complex enough (many required fields, several
 * with distinct length/format rules) to warrant Zod rather than the
 * hand-rolled `typeof body.field === "string"` checks used elsewhere in the
 * codebase — see docs/architecture.md's validation-conventions section.
 * Scoped to this domain only; other routes keep the existing convention.
 */

import { z } from "zod";
import { isValidHttpUrl } from "@/lib/server/url-normalize";

export const submissionCreateSchema = z.object({
  name: z.string().trim().min(2, "too_short").max(80, "too_long"),
  websiteUrl: z
    .string()
    .trim()
    .min(1, "required")
    .max(2048, "too_long")
    .refine(isValidHttpUrl, "invalid_url"),
  tagline: z.string().trim().min(4, "too_short").max(140, "too_long"),
  description: z.string().trim().min(20, "too_short").max(2000, "too_long"),
  categoryId: z.string().trim().min(1, "required").max(64, "too_long"),
});

export type SubmissionCreateInput = z.infer<typeof submissionCreateSchema>;

export const submissionRejectSchema = z.object({
  moderatorNote: z.string().trim().max(1000, "too_long").optional(),
});

export type SubmissionRejectInput = z.infer<typeof submissionRejectSchema>;

// Same field rules as submissionCreateSchema, but every field is optional —
// an admin approving a submission only sends the fields they corrected.
export const submissionApproveOverridesSchema = z.object({
  name: z.string().trim().min(2, "too_short").max(80, "too_long").optional(),
  websiteUrl: z
    .string()
    .trim()
    .min(1, "required")
    .max(2048, "too_long")
    .refine(isValidHttpUrl, "invalid_url")
    .optional(),
  tagline: z.string().trim().min(4, "too_short").max(140, "too_long").optional(),
  description: z.string().trim().min(20, "too_short").max(2000, "too_long").optional(),
});

export type SubmissionApproveOverrides = z.infer<typeof submissionApproveOverridesSchema>;
