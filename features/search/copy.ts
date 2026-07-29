/**
 * User-facing copy.
 *
 * Every public string the search response carries is generated here, and this
 * module never imports a score, a confidence number, or a pipeline concept into
 * its output vocabulary.
 *
 * The rule: CONFIDENCE DESCRIBES THE EVIDENCE, NOT THE MODEL. "Limited
 * independent review data" tells a user something actionable about the world.
 * "Moderate confidence" tells them something about our internals, which is not
 * their problem.
 *
 * `BANNED_PUBLIC_TERMS` is asserted against in the test suite, so a regression
 * that leaks engineering language into a response fails CI.
 */

import type { ClassifiedEvidence } from "./evidence/classes";

/** Vocabulary that must never appear in a public response field. */
export const BANNED_PUBLIC_TERMS = [
  "parsed intent",
  "parsed query",
  "model confidence",
  "candidate corpus",
  "category resolution",
  "semantic score",
  "semantic fit",
  "semantic relevance",
  "understood as",
  "moderate confidence",
  "high confidence",
  "low confidence",
  "the model interpreted",
  "seeded",
  "fixture",
  "corpus",
] as const;

// ─── Titles ──────────────────────────────────────────────────────────────────

const AUDIENCE_PHRASE: Record<string, string> = {
  individual: "solo users",
  small_team: "small teams",
  startup: "startups",
  enterprise: "enterprise teams",
};

/**
 * The headline. Describes what was searched in the user's own terms —
 * "Top analytics tools for small SaaS teams", never "Category resolution:
 * analytics-tools".
 */
export function resultTitle(input: {
  categoryName: string;
  audience?: string[];
  budgetMax?: number | null;
}): string {
  const base = `Top ${input.categoryName.toLowerCase()}`;
  const audience = input.audience?.map((a) => AUDIENCE_PHRASE[a]).filter(Boolean)[0];
  const parts = [base];
  if (audience) parts.push(`for ${audience}`);
  if (input.budgetMax != null) parts.push(`under $${input.budgetMax}/mo`);
  return parts.join(" ");
}

/** One-line framing of what the list represents and how solid it is. */
export function resultSummary(input: {
  shown: number;
  evaluated: number;
  withIndependentReviews: number;
}): string {
  const { shown, evaluated, withIndependentReviews } = input;
  const lead = `${shown} option${shown === 1 ? "" : "s"} ranked from ${evaluated} we looked at`;
  if (withIndependentReviews === 0) {
    return `${lead}. Ranked on published product facts — no independent review data was available.`;
  }
  if (withIndependentReviews < shown) {
    return `${lead}. ${withIndependentReviews} of them have independent review data.`;
  }
  return `${lead}, all with independent review data.`;
}

// ─── Per-result copy ─────────────────────────────────────────────────────────

/**
 * Why this option is here, in plain language. Built from what the evidence
 * actually supports — matched requirements first, then a reputation statement
 * only when independent data backs it.
 */
export function shortReason(input: {
  rank: number;
  matchedConstraints: string[];
  evidence: ClassifiedEvidence;
}): string {
  const { rank, matchedConstraints, evidence } = input;

  if (rank === 1 && matchedConstraints.length > 0) {
    return `Best overall fit — meets ${joinList(matchedConstraints.slice(0, 2))}.`;
  }
  if (matchedConstraints.length > 0) {
    return `Meets ${joinList(matchedConstraints.slice(0, 2))}.`;
  }
  if (evidence.reputation.commonPraise.length > 0) {
    return `Reviewers consistently praise ${joinList(evidence.reputation.commonPraise.slice(0, 2))}.`;
  }
  if (evidence.official.pricing.hasFreePlan) {
    return "Offers a free plan.";
  }
  return "Matches the category you searched.";
}

/** "Best for …", only when the evidence actually says so. */
export function bestFor(evidence: ClassifiedEvidence): string | undefined {
  const praise = evidence.reputation.commonPraise;
  if (praise.length > 0) return `Teams that prioritize ${joinList(praise.slice(0, 2))}`;
  if (evidence.official.pricing.hasFreePlan && evidence.official.pricing.monthly === 0) {
    return "Getting started without a budget";
  }
  if (evidence.official.platforms.includes("api")) return "Teams that need API access";
  return undefined;
}

// ─── Evidence-descriptive confidence (never model-descriptive) ───────────────

export type EvidenceStrength = "strong" | "moderate" | "limited";

/**
 * Strength of the EVIDENCE behind a result. Derived only from what sources
 * exist and how fresh they are — never from a score or a parser confidence.
 */
export function evidenceStrength(evidence: ClassifiedEvidence): EvidenceStrength {
  const { reputation, editorial, official } = evidence;
  const independentSources = reputation.sourceDiversity;
  const hasRating = reputation.aggregateRating !== null;
  const hasFacts = official.sourceUrls.length > 0;

  if (hasRating && independentSources >= 2 && reputation.reviewCount >= 50) return "strong";
  if (hasRating || independentSources >= 1 || editorial.articles.length > 0) return "moderate";
  void hasFacts;
  return "limited";
}

/** Plain-language label for an evidence strength. Never says "confidence". */
export function evidenceStrengthLabel(strength: EvidenceStrength): string {
  switch (strength) {
    case "strong":
      return "Backed by multiple independent sources";
    case "moderate":
      return "Some independent evidence available";
    case "limited":
    default:
      return "Limited independent review data";
  }
}

// ─── Gaps and warnings ───────────────────────────────────────────────────────

/** Per-result honest statements about what could not be established. */
export function evidenceGaps(evidence: ClassifiedEvidence): string[] {
  const gaps: string[] = [];
  if (evidence.official.pricing.monthly === null && evidence.official.pricing.hasFreePlan === null) {
    gaps.push("Pricing could not be verified");
  }
  if (!evidence.hasIndependent) {
    gaps.push("No independent reviews found — details come from the vendor's own site");
  } else if (!evidence.hasIndependentRating) {
    gaps.push("No aggregate rating available from independent sources");
  }
  if (evidence.reputation.recencyDays != null && evidence.reputation.recencyDays > 365) {
    gaps.push("Independent review data is over a year old");
  }
  return gaps;
}

/** Whole-result-set warnings. */
export function coverageWarnings(input: {
  shown: number;
  target: number;
  withIndependentReviews: number;
  providerDegraded: boolean;
}): string[] {
  const warnings: string[] = [];
  if (input.withIndependentReviews === 0) {
    warnings.push("Ranked on published product facts only — no independent review data was available.");
  }
  if (input.shown < input.target) {
    warnings.push(
      `Only ${input.shown} option${input.shown === 1 ? "" : "s"} had enough evidence to rank — this isn't a complete picture of the market.`
    );
  }
  if (input.providerDegraded) {
    warnings.push("Some sources didn't respond, so this list may be missing options.");
  }
  return warnings;
}

// ─── Freshness ───────────────────────────────────────────────────────────────

export interface FreshnessSummary {
  /** Age in days of the freshest evidence, or null when nothing is dated. */
  ageDays: number | null;
  label: string;
}

export function freshnessSummary(ageDays: number | null): FreshnessSummary {
  if (ageDays == null) return { ageDays: null, label: "No dated information" };
  if (ageDays < 14) return { ageDays, label: "Checked in the last two weeks" };
  if (ageDays < 45) return { ageDays, label: "Checked in the last month or so" };
  if (ageDays < 120) return { ageDays, label: "A few months old" };
  return { ageDays, label: "Possibly out of date" };
}

// ─── State messages ──────────────────────────────────────────────────────────

export function unsupportedMessage(label?: string): string {
  const what = label ? label.toLowerCase() : "that";
  return `Crossing doesn't cover ${what} yet — it currently ranks online tools and software.`;
}

export function clarificationMessage(ambiguous: boolean): string {
  return ambiguous
    ? "That could mean a few different things. Pick what you're after and we'll rank it."
    : "Tell us which kind of tool you're after and we'll rank the options.";
}

export function emptyCategoryMessage(categoryName: string): string {
  return `We don't have any ${categoryName.toLowerCase()} to rank yet.`;
}

export function noResultsMessage(excludedCount: number): string {
  return excludedCount > 0
    ? "We found options in that category, but none met every requirement. Try relaxing one."
    : "Nothing matched that search. Try describing it differently, or drop a requirement.";
}

export function unavailableMessage(): string {
  return "Search is temporarily unavailable. Please try again shortly.";
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function joinList(items: string[]): string {
  const clean = items.map((s) => s.toLowerCase().trim()).filter(Boolean);
  if (clean.length === 0) return "your requirements";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}
