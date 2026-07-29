/**
 * Lightweight result feedback.
 *
 * Phase 2 deliberately does NOT persist feedback to the database — that needs a
 * new Prisma model + migration, which belongs with the recommendation
 * persistence phase (docs/recommendation-engine-plan.md §8, Phase 2/4). Until
 * then feedback is validated and structured-logged only, so we capture signal
 * without standing up storage that isn't ready to be clean/safe yet. The route
 * shape is stable, so wiring a durable writer later is additive.
 */

import { z } from "zod";

export const feedbackKindSchema = z.enum([
  "helpful",
  "not_helpful",
  "wrong_category",
  "missed_option",
]);
export type FeedbackKind = z.infer<typeof feedbackKindSchema>;

export const feedbackRequestSchema = z.object({
  /** The requestId of the search this feedback is about. */
  requestId: z.string().min(1).max(80),
  kind: feedbackKindSchema,
  /** Optional entity the feedback targets (e.g. "this winner was wrong"). */
  entityId: z.string().max(80).optional(),
  /** Optional free-text detail, length-capped. */
  note: z.string().max(500).optional(),
});
export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;
