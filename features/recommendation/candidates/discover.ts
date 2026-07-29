/**
 * Candidate discovery (Phase 1: over the mock corpus).
 *
 * Deterministic and read-only. Candidate retrieval REQUIRES a resolved,
 * supported category id — there is deliberately no "no category → scan/return
 * everything" path. Cross-category search is not part of this MVP, and the
 * category-resolution gate (categories/resolve.ts) guarantees this is only ever
 * called with a supported category. The invariant here is defense-in-depth: if
 * a future change reaches this without a category, it fails loudly rather than
 * silently ranking the entire database.
 *
 * This is the seam where Postgres FTS (`websearch_to_tsquery`) plugs in later
 * to rank *within* the resolved category (docs/recommendation-engine-plan.md
 * §8, Phase 3) without changing callers.
 */

import type { Entity } from "../entities/types";
import { invariant } from "../invariant";

export function discoverCandidates(categoryId: string, corpus: Entity[]): Entity[] {
  invariant(
    typeof categoryId === "string" && categoryId.length > 0,
    "discoverCandidates requires a resolved category id (cross-category search is disabled in the MVP)"
  );
  return corpus.filter((e) => e.categoryId === categoryId);
}
