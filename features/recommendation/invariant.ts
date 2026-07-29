/**
 * Engine invariants — defense-in-depth for the recommendation pipeline.
 *
 * These guard conditions that the category-resolution gate should already make
 * unreachable (e.g. scoring a candidate from a different category than the one
 * we resolved). They exist so a future regression fails *loudly in development*
 * instead of silently recommending unrelated results — which is exactly the
 * class of bug this pass was created to eliminate.
 *
 * Behavior:
 *   - Always throws `RecommendationInvariantError` when the condition is false.
 *   - In development the error propagates (a 500 / visible crash) so the bug is
 *     caught immediately.
 *   - The API layer (api.ts) catches it and, in production, converts it into a
 *     safe typed "no result" response rather than leaking a broken ranking.
 */

export class RecommendationInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecommendationInvariantError";
  }
}

export function invariant(condition: unknown, message: string): asserts condition {
  if (condition) return;
  const full = `[recommendation] invariant violated: ${message}`;
  // Always surface it in logs; the API decides how to degrade in production.
  if (typeof console !== "undefined") console.error(full);
  throw new RecommendationInvariantError(full);
}

export function isInvariantError(err: unknown): err is RecommendationInvariantError {
  return err instanceof RecommendationInvariantError;
}
