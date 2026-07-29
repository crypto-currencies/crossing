/**
 * Query parsing.
 *
 * A `QueryParser` turns a raw natural-language string into a validated
 * `ParsedQuery`. Two things are guaranteed for every implementation:
 *   1. Output is validated against parsedQuerySchema before it's returned.
 *   2. The parser produces *interpretation only* — it never selects, scores,
 *      or orders results. That is the deterministic ranker's job (ranking/score.ts).
 *
 * Phase 1 ships ONE implementation: `deterministicParser` (rules-based, no
 * network, no AI). No AI provider is added in this phase — the repository has
 * no AI SDK installed, and per the project constraints a provider is not added
 * without an explicit, documented decision. When an AI parser is introduced
 * later it implements this same interface behind a flag, with the deterministic
 * parser remaining the test/dev/fallback path. See
 * docs/recommendation-engine-plan.md §7 (cost/hallucination risks).
 */

import { detectCategory, getCategory } from "../categories/definitions";
import {
  DEFAULT_RESULT_COUNT,
  MAX_RESULT_COUNT,
  parsedQuerySchema,
  type Budget,
  type ParsedQuery,
  type QueryConstraint,
  type QueryIntent,
  type QueryPreference,
} from "./schema";

export interface QueryParser {
  readonly name: string;
  parse(rawQuery: string): Promise<ParsedQuery>;
}

// ─── Deterministic rules-based parser ────────────────────────────────────────

const PRICE_RE = /(?:under|below|less than|max|<=?)\s*\$?\s*(\d+(?:\.\d+)?)/i;
const FREE_RE = /\bfree\b/i;
const OPEN_SOURCE_RE = /\bopen[-\s]?source\b/i;
const SELF_HOST_RE = /\bself[-\s]?host(?:able|ed|ing)?\b/i;
const COMPARISON_RE = /\b(vs|versus|compare|comparison|difference between)\b/i;
const DISCOVERY_RE = /\b(browse|explore|discover|what(?:'s| is) out there|options for)\b/i;

const AUDIENCE_TERMS: Record<string, string> = {
  startup: "startup",
  startups: "startup",
  enterprise: "enterprise",
  team: "small_team",
  teams: "small_team",
  "small team": "small_team",
  solo: "individual",
  individual: "individual",
  freelancer: "individual",
  personal: "individual",
};

const PLATFORM_TERMS = ["web", "mac", "macos", "windows", "linux", "ios", "android", "cli", "api"];

function detectIntent(q: string): QueryIntent {
  if (COMPARISON_RE.test(q)) return "comparison";
  if (DISCOVERY_RE.test(q)) return "discovery";
  return "recommendation";
}

function extractBudget(q: string): Budget | undefined {
  const m = q.match(PRICE_RE);
  if (!m) return undefined;
  const max = Number(m[1]);
  if (!Number.isFinite(max)) return undefined;
  return { max, currency: "USD", billingPeriod: "month" };
}

function extractConstraints(q: string, categoryId: string | null): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];
  const canFilter = (attr: string) =>
    !categoryId || getCategory(categoryId)?.attributes.some((a) => a.key === attr && a.hardFilterable);

  if (OPEN_SOURCE_RE.test(q) && canFilter("openSource")) {
    constraints.push({ attribute: "openSource", operator: "eq", value: true, label: "Open source" });
  }
  if (SELF_HOST_RE.test(q) && canFilter("selfHostable")) {
    constraints.push({ attribute: "selfHostable", operator: "eq", value: true, label: "Self-hostable" });
  }
  // "free" as a hard requirement only when phrased as a need ("must be free", "free plan").
  if (/\b(must be free|need.*free|free plan|has.*free)\b/i.test(q) && canFilter("hasFreePlan")) {
    constraints.push({ attribute: "hasFreePlan", operator: "eq", value: true, label: "Has a free plan" });
  }
  for (const p of PLATFORM_TERMS) {
    if (new RegExp(`\\b${p}\\b`, "i").test(q) && canFilter("platforms")) {
      const value = p === "macos" ? "mac" : p;
      constraints.push({ attribute: "platforms", operator: "includes", value, label: `Runs on ${value}` });
    }
  }
  return constraints;
}

function extractSoftPreferences(q: string): QueryPreference[] {
  const prefs: QueryPreference[] = [];
  const add = (attribute: string, value: string, label: string, weight = 0.5) =>
    prefs.push({ attribute, value, weight, label });

  if (FREE_RE.test(q) && !/\b(must be free|need.*free|free plan)\b/i.test(q)) {
    add("hasFreePlan", "true", "Prefers a free option", 0.6);
  }
  if (/\bfast|quick|performance|snappy\b/i.test(q)) add("performance", "fast", "Prefers speed/performance", 0.6);
  if (/\bsimple|minimal|clean|easy\b/i.test(q)) add("simplicity", "simple", "Prefers simplicity", 0.5);
  if (/\bcheap|affordable|budget\b/i.test(q)) add("priceMonthly", "low", "Prefers lower price", 0.5);
  if (/\breliable|stable|uptime\b/i.test(q)) add("reliability", "reliable", "Prefers reliability", 0.6);
  return prefs;
}

function extractNegativePreferences(q: string): QueryPreference[] {
  const prefs: QueryPreference[] = [];
  // "no <x>", "without <x>", "not <x>", "avoid <x>"
  const negRe = /\b(?:no|without|not|avoid|hate)\s+([a-z][a-z0-9+#-]{1,30})/gi;
  let m: RegExpExecArray | null;
  while ((m = negRe.exec(q)) !== null) {
    const term = m[1].toLowerCase();
    if (term === "free") continue; // "not free" is a positive price signal, skip as a topic
    prefs.push({ attribute: term, value: term, weight: 0.6, label: `Avoid: ${term}` });
  }
  return prefs;
}

function extractAudience(q: string): string[] | undefined {
  const found = new Set<string>();
  for (const [term, canonical] of Object.entries(AUDIENCE_TERMS)) {
    if (new RegExp(`\\b${term}\\b`, "i").test(q)) found.add(canonical);
  }
  return found.size > 0 ? Array.from(found) : undefined;
}

function extractResultCount(q: string): number {
  const m = q.match(/\btop\s+(\d{1,2})\b/i) ?? q.match(/\b(\d{1,2})\s+(?:options|results|tools|picks)\b/i);
  if (!m) return DEFAULT_RESULT_COUNT;
  const n = Number(m[1]);
  return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 1), MAX_RESULT_COUNT) : DEFAULT_RESULT_COUNT;
}

/**
 * Deterministic parser — pure, dependency-free, fully testable. Confidence is
 * derived from how much structure it actually extracted, and anything it
 * couldn't resolve (e.g. an unknown category) is recorded in `ambiguities`
 * rather than silently guessed.
 */
export const deterministicParser: QueryParser = {
  name: "deterministic",
  async parse(rawQuery: string): Promise<ParsedQuery> {
    const q = rawQuery.trim();
    const { categoryId, confidence: catConfidence } = detectCategory(q);
    const audience = extractAudience(q);

    const ambiguities: string[] = [];
    if (!categoryId) ambiguities.push("Could not confidently determine a category from the query.");

    const parsed: ParsedQuery = {
      rawQuery: q,
      categoryId,
      intent: detectIntent(q),
      hardConstraints: extractConstraints(q, categoryId),
      softPreferences: extractSoftPreferences(q),
      negativePreferences: extractNegativePreferences(q),
      budget: extractBudget(q),
      intendedAudience: audience,
      requestedResultCount: extractResultCount(q),
      // Blend category confidence with a small bump for extracted structure,
      // capped below 1 — a rules parser should never claim certainty.
      confidence: Math.min(0.35 + catConfidence * 0.5, 0.9),
      ambiguities,
    };

    // Always validate before returning — this is the contract every parser honors.
    return parsedQuerySchema.parse(parsed);
  },
};

/**
 * Safe wrapper: if a parser throws or produces an invalid shape, fall back to a
 * minimal valid ParsedQuery (raw passthrough, low confidence) so the pipeline
 * degrades instead of 500-ing. Category detection is still attempted.
 */
export async function parseQuerySafe(parser: QueryParser, rawQuery: string): Promise<ParsedQuery> {
  try {
    return await parser.parse(rawQuery);
  } catch {
    const { categoryId } = detectCategory(rawQuery);
    return parsedQuerySchema.parse({
      rawQuery: rawQuery.trim().slice(0, 400) || "(empty)",
      categoryId,
      intent: "recommendation" as QueryIntent,
      hardConstraints: [],
      softPreferences: [],
      negativePreferences: [],
      requestedResultCount: DEFAULT_RESULT_COUNT,
      confidence: 0.1,
      ambiguities: ["Parser failed; using a minimal interpretation."],
    });
  }
}
