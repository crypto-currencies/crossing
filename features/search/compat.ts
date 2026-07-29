/**
 * Legacy-contract projection.
 *
 * `/api/recommend` now runs the live orchestrator, but the search UI still
 * consumes the older `{ bestMatch, alternatives }` shape and presentation is
 * owned by another track. This module renders a `RankedSearchResponse` into
 * that shape so the pipeline can be swapped underneath the UI without
 * redesigning it.
 *
 * This is a PROJECTION, not a second pipeline. `bestMatch` is literally
 * `results[0]` and `alternatives` is `results.slice(1)` — the ranked list is the
 * source of truth, and nothing here re-ranks, re-scores, or invents a field.
 *
 * Where the new contract carries information the old one has no room for
 * (evidence coverage, per-result evidence strength), it is folded into
 * `warnings` and `tradeoffs` rather than dropped — a caller on the old contract
 * still learns that reviews were missing.
 *
 * Retire this file once the UI consumes `RankedSearchResponse` directly.
 */

import type { SearchResponse } from "@/features/recommendation/api";
import type {
  ConfidenceLevel,
  EvidenceRef,
  ExplanationClaim,
  RecommendedItem,
} from "@/features/recommendation/types";
import type { ScoreBreakdown } from "@/features/recommendation/ranking/score";
import { listCategories } from "@/features/recommendation/categories/definitions";
import type { CategoryResolution } from "@/features/recommendation/categories/resolve";
import type { RankedResult, RankedSearchResponse } from "./response";

/**
 * An empty breakdown for the rare case a result carries none (production
 * responses omit `scoreBreakdown`). Every component is 0 and every list empty —
 * the "How this was ranked" panel then renders honestly empty rather than
 * showing numbers we did not compute.
 */
function emptyBreakdown(entityId: string): ScoreBreakdown {
  const zero = {
    constraintFit: 0, queryRelevance: 0, semanticRelevance: 0, generalQuality: 0,
    reviewConfidence: 0, topicSentiment: 0, sourceDiversity: 0, freshness: 0, riskPenalty: 0,
  };
  return {
    entityId,
    eligible: true,
    ineligibleReasons: [],
    hardConstraints: [],
    softPreferences: [],
    negativePreferences: [],
    components: zero,
    weights: zero,
    positiveScore: 0,
    penalty: 0,
    total: 0,
    warnings: [],
  };
}

/** Project one ranked result into the legacy item shape. */
function toRecommendedItem(result: RankedResult, categoryId: string): RecommendedItem {
  const breakdown = result.scoreBreakdown ?? emptyBreakdown(result.entityId);

  const evidenceRefs: EvidenceRef[] = result.sourceSummaries.map((s) => ({
    sourceType: s.label,
    sourceUrl: s.url,
    retrievedAt: s.retrievedAt,
    // Only an independent source may carry a rating, and the summary is the
    // only place one exists — an official source stays null by construction.
    rating: s.kind === "independent" ? (result.reviewSummary?.rating ?? null) : null,
    ratingScale: s.kind === "independent" && result.reviewSummary?.rating != null ? 5 : null,
    reviewCount: s.kind === "independent" ? (result.reviewSummary?.reviewCount ?? 0) : 0,
  }));

  return {
    entityId: result.entityId,
    name: result.name,
    // The legacy card renders `https://${domain}`, so hand it a bare host.
    domain: bareHost(result.url),
    categoryId,
    score: breakdownScore(result),
    breakdown,
    matchedConstraints: breakdown.hardConstraints.filter((h) => h.passed && !h.unknown).map((h) => h.label),
    unmetPreferences: breakdown.softPreferences.filter((p) => !p.satisfied).map((p) => p.label),
    tradeoffs: result.tradeoffs,
    evidenceRefs,
    freshnessWarnings:
      result.freshness.ageDays != null && result.freshness.ageDays > 120
        ? [result.freshness.label]
        : [],
  };
}

/**
 * The legacy UI renders `fitPercent(item.score)`. The new pipeline's total lives
 * on the breakdown when present; otherwise derive a display value from evidence
 * strength so the card shows something truthful rather than 0%.
 */
function breakdownScore(result: RankedResult): number {
  if (result.scoreBreakdown) return result.scoreBreakdown.total;
  switch (result.evidenceStrength) {
    case "strong":
      return 0.85;
    case "moderate":
      return 0.6;
    default:
      return 0.35;
  }
}

function bareHost(url?: string): string {
  if (!url) return "";
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/^www\./, "").split("/")[0];
  }
}

/**
 * Grounded claims for the winner. Built only from facts the result already
 * carries — verified attributes, an independent rating, a price we confirmed.
 * Nothing here is generated prose.
 */
function claimsFor(result: RankedResult): ExplanationClaim[] {
  const claims: ExplanationClaim[] = [];

  for (const attr of result.keyAttributes.filter((a) => a.verified).slice(0, 3)) {
    claims.push({
      kind: "attribute",
      text: `${attr.label}: ${attr.value}`,
      ...(attr.sourceUrl ? { evidenceUrl: attr.sourceUrl } : {}),
    });
  }

  if (result.reviewSummary?.rating != null) {
    const source = result.sourceSummaries.find((s) => s.kind === "independent");
    claims.push({
      kind: "rating",
      text: `${result.reviewSummary.rating}/5 across ${result.reviewSummary.reviewCount} independent reviews`,
      ...(source ? { evidenceUrl: source.url } : {}),
    });
  }

  if (result.priceSummary?.verified) {
    claims.push({ kind: "attribute", text: result.priceSummary.display });
  }

  return claims;
}

/**
 * Confidence level from EVIDENCE, not from a model or a winner margin.
 *
 * The old contract's `confidenceLevel` came from `overallConfidence()`, which
 * blended parser confidence with the #1-vs-#2 score gap — a concept the audit
 * found meaningless on a ranked list (§1.6). Here it reflects how strongly the
 * top results are evidenced, which is what the label should always have meant.
 */
function confidenceFrom(results: RankedResult[]): { level: ConfidenceLevel; value: number } {
  if (results.length === 0) return { level: "low", value: 0 };
  const top = results.slice(0, 3);
  const strong = top.filter((r) => r.evidenceStrength === "strong").length;
  const moderate = top.filter((r) => r.evidenceStrength === "moderate").length;

  if (strong >= 2) return { level: "high", value: 0.8 };
  if (strong >= 1 || moderate >= 2) return { level: "medium", value: 0.55 };
  return { level: "low", value: 0.3 };
}

/** Synthesize the resolution object the legacy gate states carry. */
function resolutionFor(status: "unsupported" | "needs-clarification", label?: string): CategoryResolution {
  return {
    domain: status === "unsupported" ? "product" : "software",
    categoryId: null,
    ...(label ? { categoryLabel: label } : {}),
    status: status === "unsupported" ? "unsupported" : "ambiguous",
    confidence: status === "unsupported" ? 0.7 : 0.4,
    suggestedCategoryIds: [],
    requiresLocation: false,
  };
}

function categoryIdFor(categoryName: string): string {
  return listCategories().find((c) => c.name === categoryName)?.id ?? "";
}

// ─── Projection ──────────────────────────────────────────────────────────────

export function toLegacyResponse(response: RankedSearchResponse): SearchResponse {
  const base = {
    requestId: response.requestId,
    timingMs: response.timingMs,
  };

  switch (response.status) {
    case "success": {
      const categoryId = categoryIdFor(response.results[0]?.category ?? "");
      const items = response.results.map((r) => toRecommendedItem(r, categoryId));
      const confidence = confidenceFrom(response.results);

      // Coverage gaps have no home in the old contract, so they ride along as
      // warnings rather than being silently dropped.
      const warnings = [...response.warnings, ...response.evidenceCoverage.gaps];

      return {
        ...base,
        status: "success",
        // The live pipeline never serves seeded data (Part 13).
        dataMode: "live",
        seeded: false,
        parsedQuery: response.query,
        categoryName: response.results[0]?.category ?? "",
        bestMatch: items[0],
        bestMatchClaims: claimsFor(response.results[0]),
        alternatives: items.slice(1),
        confidence: confidence.value,
        confidenceLevel: confidence.level,
        warnings,
      };
    }

    case "no-results":
      return {
        ...base,
        status: "no-results",
        parsedQuery: response.query,
        categoryName: "",
        ineligibleCount: response.excluded.length,
        warnings: response.warnings,
        message: response.message,
      };

    case "unsupported":
      return {
        ...base,
        status: "unsupported-category",
        parsedQuery: response.query,
        category: resolutionFor("unsupported"),
        message: response.message,
      };

    case "needs-clarification":
      return {
        ...base,
        status: "needs-clarification",
        parsedQuery: response.query,
        category: resolutionFor("needs-clarification"),
        suggestions: response.options,
        message: response.message,
      };

    case "error":
    default:
      return {
        ...base,
        status: "error",
        // The legacy union has no `search_unavailable`; map it onto the code the
        // old client already renders as a temporary outage.
        code: response.code === "internal_error" ? "internal_error" : "seeded_data_unavailable",
        message: response.message,
      };
  }
}
