/**
 * Zod schemas for the parsed, structured interpretation of a natural-language
 * query. This is the ONLY thing the AI-backed parser is allowed to produce
 * (see ./parser.ts) — it never selects or orders results.
 *
 * Zod 4 is already a project dependency and is the codebase's convention for
 * complex input shapes (see features/submissions/validation.ts).
 */

import { z } from "zod";

/** How the constraint value is compared against a candidate attribute. */
export const constraintOperatorSchema = z.enum([
  "eq",
  "neq",
  "lte",
  "gte",
  "includes",
  "excludes",
  "exists",
]);
export type ConstraintOperator = z.infer<typeof constraintOperatorSchema>;

/**
 * A HARD constraint — a candidate that fails it is ineligible, not merely
 * ranked lower. `attribute` is a category attribute key (see categories/definitions.ts).
 */
export const queryConstraintSchema = z.object({
  attribute: z.string().min(1).max(64),
  operator: constraintOperatorSchema,
  /** string | number | boolean — normalized comparison happens in ranking/score.ts. */
  value: z.union([z.string(), z.number(), z.boolean()]),
  /** Human-readable restatement, surfaced in "matched constraints". */
  label: z.string().min(1).max(160),
});
export type QueryConstraint = z.infer<typeof queryConstraintSchema>;

/**
 * A SOFT preference (positive) or NEGATIVE preference. Never excludes a
 * candidate; only nudges the score. `weight` is a 0..1 importance hint.
 */
export const queryPreferenceSchema = z.object({
  attribute: z.string().min(1).max(64),
  /** Free-text value the preference is expressed against ("fast", "minimal", "open source"). */
  value: z.union([z.string(), z.number(), z.boolean()]),
  weight: z.number().min(0).max(1).default(0.5),
  label: z.string().min(1).max(160),
});
export type QueryPreference = z.infer<typeof queryPreferenceSchema>;

export const budgetSchema = z.object({
  min: z.number().nonnegative().optional(),
  max: z.number().nonnegative().optional(),
  currency: z.string().length(3).default("USD").optional(),
  billingPeriod: z.enum(["month", "year", "one_time"]).optional(),
});
export type Budget = z.infer<typeof budgetSchema>;

export const queryIntentSchema = z.enum(["recommendation", "comparison", "discovery"]);
export type QueryIntent = z.infer<typeof queryIntentSchema>;

export const DEFAULT_RESULT_COUNT = 3;
export const MAX_RESULT_COUNT = 10;

/**
 * The full structured interpretation of a user query. Produced by a parser
 * (deterministic mock, or AI-backed later), validated by this schema before
 * anything downstream trusts it.
 */
export const parsedQuerySchema = z.object({
  rawQuery: z.string().min(1).max(400),
  categoryId: z.string().min(1).max(64).nullable(),
  intent: queryIntentSchema,
  hardConstraints: z.array(queryConstraintSchema).max(20),
  softPreferences: z.array(queryPreferenceSchema).max(20),
  negativePreferences: z.array(queryPreferenceSchema).max(20),
  budget: budgetSchema.optional(),
  /** Reserved for future location-aware categories; unused in the software MVP. */
  location: z.string().max(160).optional(),
  intendedAudience: z.array(z.string().min(1).max(80)).max(10).optional(),
  requestedResultCount: z.number().int().min(1).max(MAX_RESULT_COUNT).default(DEFAULT_RESULT_COUNT),
  /** 0..1 — the parser's own confidence in this interpretation. */
  confidence: z.number().min(0).max(1),
  /** Things the parser was unsure about; surfaced to the user, never silently guessed. */
  ambiguities: z.array(z.string().min(1).max(200)).max(10),
});
export type ParsedQuery = z.infer<typeof parsedQuerySchema>;

/** Parse + validate an untrusted parsed-query object. Throws ZodError on failure. */
export function validateParsedQuery(input: unknown): ParsedQuery {
  return parsedQuerySchema.parse(input);
}
