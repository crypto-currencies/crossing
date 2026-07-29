/**
 * Pure view-model helpers for the search UI.
 *
 * Kept here (not in components/) so the state logic is unit-testable under the
 * repo's `features/**` test glob without a DOM. The React components in
 * components/search/ are thin renderers over these functions.
 */

import type { RecommendedItem, EvidenceRef } from "./types";
import type { ConfidenceLevel } from "./types";
import type { SearchResponse } from "./api";
import type { ParsedQuery } from "./query/schema";
import { listCategories } from "./categories/definitions";

/** The distinct screens the search experience can be in. */
export type SearchViewState =
  | "idle"
  | "loading"
  | "error"
  | "no-results"
  | "unsupported"
  | "needs-category"
  | "results";

/**
 * Derive which screen to show from the request status + response. Pure: the
 * component calls this and renders the matching branch. The screen is a direct
 * projection of the response's discriminated `status` — an unsupported or
 * ambiguous query never renders a results screen implying we searched software.
 */
export function deriveViewState(
  status: "idle" | "loading" | "error" | "done",
  response: SearchResponse | null
): SearchViewState {
  if (status === "idle") return "idle";
  if (status === "loading") return "loading";
  if (status === "error") return "error";
  if (!response) return "error";

  switch (response.status) {
    case "success":
      return "results";
    case "unsupported-category":
      return "unsupported";
    case "needs-clarification":
      return "needs-category";
    case "no-results":
      return "no-results";
    case "error":
    default:
      return "error";
  }
}

// ─── Query interpretation (for the "Understood as / Priorities" summary) ─────

const AUDIENCE_LABELS: Record<string, string> = {
  individual: "Solo",
  small_team: "Small team",
  startup: "Startup",
  enterprise: "Enterprise",
};

const KEYWORD_STOP = new Set([
  "a", "an", "the", "for", "to", "of", "with", "and", "or", "best", "good", "cheap",
  "find", "me", "my", "under", "near", "that", "is", "in", "on", "some", "something",
  "please", "need", "want", "looking", "get", "give",
]);

/** Short, human priority chips derived from the parsed query. Never fabricated. */
export function prioritiesFor(query: ParsedQuery): string[] {
  const chips: string[] = [];
  if (query.budget?.max != null) chips.push(`Under $${query.budget.max}/mo`);
  for (const a of query.intendedAudience ?? []) chips.push(AUDIENCE_LABELS[a] ?? a);
  for (const p of query.softPreferences) chips.push(p.label.replace(/^Prefers\s+/i, ""));
  for (const c of query.hardConstraints) chips.push(c.label);
  // De-dupe while preserving order.
  return [...new Set(chips)].slice(0, 6);
}

/** The salient words from the raw query — literally the user's own words. */
export function queryKeywords(raw: string): string[] {
  const words = raw
    .toLowerCase()
    .replace(/[^a-z0-9$ ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !KEYWORD_STOP.has(w));
  return [...new Set(words)].slice(0, 6);
}

/** {id,label} for every supported category — used to offer a category picker. */
export interface CategoryOption {
  id: string;
  label: string;
}

export const SUPPORTED_CATEGORY_OPTIONS: CategoryOption[] = listCategories().map((c) => ({
  id: c.id,
  label: c.name,
}));

export function categoryLabel(id: string): string {
  return SUPPORTED_CATEGORY_OPTIONS.find((c) => c.id === id)?.label ?? id;
}

// ─── Confidence labelling (never fake precision) ─────────────────────────────

export interface ConfidenceDisplay {
  level: ConfidenceLevel;
  label: string;
  blurb: string;
}

export function confidenceDisplay(level: ConfidenceLevel): ConfidenceDisplay {
  switch (level) {
    case "high":
      return { level, label: "High confidence", blurb: "Multiple sources agree and the top pick is clear." };
    case "medium":
      return { level, label: "Moderate confidence", blurb: "A reasonable pick, but the margin is narrow." };
    case "low":
    default:
      return { level: "low", label: "Limited evidence", blurb: "Not much to go on yet — treat this as a starting point." };
  }
}

// ─── Evidence summary ────────────────────────────────────────────────────────

export interface EvidenceSummary {
  /** Distinct source count (e.g. official, github, reddit). */
  sourceCount: number;
  /** Total reviews across rated sources. */
  totalReviews: number;
  /** Age in days of the freshest piece of evidence, or null if none. */
  freshestAgeDays: number | null;
  /** Age in days of the oldest piece of evidence, or null if none. */
  oldestAgeDays: number | null;
  /** True when no source carried a rating. */
  missingRatings: boolean;
  freshnessLabel: string;
}

export function summarizeEvidence(refs: EvidenceRef[], now: Date = new Date()): EvidenceSummary {
  const sources = new Set(refs.map((r) => r.sourceType));
  const totalReviews = refs.reduce((s, r) => s + (r.reviewCount || 0), 0);
  const ages = refs
    .map((r) => new Date(r.retrievedAt).getTime())
    .filter((t) => Number.isFinite(t))
    .map((t) => Math.max(0, (now.getTime() - t) / 86_400_000));

  const freshest = ages.length ? Math.min(...ages) : null;
  const oldest = ages.length ? Math.max(...ages) : null;
  const missingRatings = refs.every((r) => r.rating == null);

  return {
    sourceCount: sources.size,
    totalReviews,
    freshestAgeDays: freshest,
    oldestAgeDays: oldest,
    missingRatings,
    freshnessLabel: freshnessLabel(freshest),
  };
}

export function freshnessLabel(freshestAgeDays: number | null): string {
  if (freshestAgeDays == null) return "No dated evidence";
  if (freshestAgeDays < 14) return "Updated recently";
  if (freshestAgeDays < 45) return "Updated this quarter";
  if (freshestAgeDays < 120) return "A few months old";
  return "Possibly outdated";
}

// ─── Score breakdown for the "How this was ranked" panel ─────────────────────

export interface ScoreRow {
  key: string;
  label: string;
  /** 0..1 component score. */
  value: number;
  /** 0..1 category weight for this component. */
  weight: number;
  /** value × weight — the actual contribution, for honest sorting. */
  contribution: number;
  /** True for the risk row, which is a penalty rather than a positive. */
  isPenalty: boolean;
}

const COMPONENT_LABELS: Record<string, string> = {
  constraintFit: "Fits your preferences",
  queryRelevance: "Matches your search",
  semanticRelevance: "Semantic match",
  generalQuality: "Overall quality",
  reviewConfidence: "Review volume",
  topicSentiment: "What reviews emphasize",
  sourceDiversity: "Source diversity",
  freshness: "Evidence freshness",
  riskPenalty: "Risk",
};

/** Turn a score breakdown into sorted, labeled rows for display. */
export function scoreRows(item: RecommendedItem): ScoreRow[] {
  const { components, weights } = item.breakdown;
  const rows: ScoreRow[] = (Object.keys(COMPONENT_LABELS) as (keyof typeof components)[]).map((key) => {
    const isPenalty = key === "riskPenalty";
    const value = components[key];
    const weight = weights[key as keyof typeof weights];
    return {
      key,
      label: COMPONENT_LABELS[key],
      value,
      weight,
      contribution: isPenalty ? -weight * value : weight * value,
      isPenalty,
    };
  });
  // Positive contributors first (largest first), penalty last.
  return rows.sort((a, b) => {
    if (a.isPenalty !== b.isPenalty) return a.isPenalty ? 1 : -1;
    return b.contribution - a.contribution;
  });
}

/** Render a 0..1 score as an integer 0–100 "fit" figure (never fake decimals). */
export function fitPercent(score: number): number {
  return Math.round(Math.min(Math.max(score, 0), 1) * 100);
}

export const EXAMPLE_QUERIES = [
  "best cheap analytics tool for a small SaaS",
  "simple project management software for five developers",
  "best email platform under $30 per month",
  "lightweight design tool that is not bloated",
  "open source self-hosted analytics",
] as const;
