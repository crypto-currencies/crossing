/**
 * Category-definition system.
 *
 * Every category owns its searchable/filterable/preference attributes, its
 * default ranking weights, which evidence sources it trusts, and how quickly
 * evidence goes stale. Category logic is data here, not `if (category === …)`
 * branches scattered through the engine.
 *
 * To add a category, see docs/recommendation-adding-a-category.md.
 */

import type { EvidenceSourceType } from "../evidence/types";
import type { RankingWeights } from "../ranking/config";

/** An attribute a category understands. `kind` decides how the engine uses it. */
export interface CategoryAttribute {
  key: string;
  label: string;
  /** value shape — drives comparison + normalization in ranking/score.ts. */
  type: "number" | "boolean" | "enum" | "string";
  /** enum members, when type === "enum". */
  options?: string[];
  /** Whether a hard constraint may be applied to this attribute. */
  hardFilterable: boolean;
  /** Whether a soft/negative preference may target this attribute. */
  preferenceable: boolean;
  /** Whether free-text query relevance considers this attribute. */
  searchable: boolean;
}

export interface CategoryDefinition {
  id: string;
  name: string;
  /** Lowercased phrases that map a query to this category (see ./detect.ts). */
  aliases: string[];
  attributes: CategoryAttribute[];
  /** Category-specific ranking weight profile. */
  weights: RankingWeights;
  /** Evidence source types considered credible for this category. */
  supportedSources: EvidenceSourceType[];
  /** Evidence older than this many days is penalized as stale (ranking/score.ts). */
  stalenessThresholdDays: number;
  /** Typical rating on this category's 0..1 normalized scale — Bayesian prior. */
  categoryAverageRating: number;
}

// ─── Shared attribute builders ───────────────────────────────────────────────
// Most software categories share a spine of attributes; compose rather than
// repeat so a new category stays a few lines.

const priceMonthly: CategoryAttribute = {
  key: "priceMonthly",
  label: "Monthly price (USD)",
  type: "number",
  hardFilterable: true,
  preferenceable: true,
  searchable: false,
};

const hasFreePlan: CategoryAttribute = {
  key: "hasFreePlan",
  label: "Has a free plan",
  type: "boolean",
  hardFilterable: true,
  preferenceable: true,
  searchable: false,
};

const openSource: CategoryAttribute = {
  key: "openSource",
  label: "Open source",
  type: "boolean",
  hardFilterable: true,
  preferenceable: true,
  searchable: true,
};

const selfHostable: CategoryAttribute = {
  key: "selfHostable",
  label: "Self-hostable",
  type: "boolean",
  hardFilterable: true,
  preferenceable: true,
  searchable: true,
};

const platforms: CategoryAttribute = {
  key: "platforms",
  label: "Platforms",
  type: "enum",
  options: ["web", "mac", "windows", "linux", "ios", "android", "cli", "api"],
  hardFilterable: true,
  preferenceable: true,
  searchable: true,
};

const targetUser: CategoryAttribute = {
  key: "targetUser",
  label: "Best for",
  type: "enum",
  options: ["individual", "small_team", "startup", "enterprise"],
  hardFilterable: true,
  preferenceable: true,
  searchable: true,
};

/** Default weight profile — categories tweak from here rather than defining fresh. */
const BASE_WEIGHTS: RankingWeights = {
  constraintFit: 0.2,
  queryRelevance: 0.18,
  semanticRelevance: 0.05,
  generalQuality: 0.22,
  reviewConfidence: 0.12,
  topicSentiment: 0.08,
  sourceDiversity: 0.06,
  freshness: 0.06,
  riskPenalty: 0.03,
};

const CATEGORY_LIST: CategoryDefinition[] = [
  {
    id: "developer-tools",
    name: "Developer tools",
    aliases: ["dev tool", "developer tool", "coding tool", "ide", "code editor", "devtools"],
    attributes: [priceMonthly, hasFreePlan, openSource, selfHostable, platforms, targetUser],
    weights: { ...BASE_WEIGHTS, queryRelevance: 0.2, generalQuality: 0.24, freshness: 0.08 },
    supportedSources: ["official", "documentation", "github", "reddit"],
    stalenessThresholdDays: 90,
    categoryAverageRating: 0.82,
  },
  {
    id: "ai-tools",
    name: "AI tools",
    aliases: ["ai tool", "llm tool", "ai assistant", "genai", "ai app"],
    attributes: [priceMonthly, hasFreePlan, platforms, targetUser],
    // AI moves fast — freshness matters more, incumbency less.
    weights: { ...BASE_WEIGHTS, freshness: 0.12, generalQuality: 0.18, reviewConfidence: 0.1 },
    supportedSources: ["official", "documentation", "reddit", "app_store"],
    stalenessThresholdDays: 45,
    categoryAverageRating: 0.78,
  },
  {
    id: "productivity-tools",
    name: "Productivity tools",
    aliases: ["productivity", "project management", "task manager", "note app", "pm tool"],
    attributes: [priceMonthly, hasFreePlan, platforms, targetUser],
    weights: { ...BASE_WEIGHTS, constraintFit: 0.22, topicSentiment: 0.1 },
    supportedSources: ["official", "trustpilot", "reddit", "app_store"],
    stalenessThresholdDays: 120,
    categoryAverageRating: 0.8,
  },
  {
    id: "design-tools",
    name: "Design tools",
    aliases: ["design tool", "ui tool", "prototyping", "graphics tool", "vector editor"],
    attributes: [priceMonthly, hasFreePlan, platforms, targetUser],
    weights: { ...BASE_WEIGHTS, generalQuality: 0.24, queryRelevance: 0.2 },
    supportedSources: ["official", "reddit", "app_store"],
    stalenessThresholdDays: 120,
    categoryAverageRating: 0.83,
  },
  {
    id: "hosting-platforms",
    name: "Hosting platforms",
    aliases: ["hosting", "host", "deploy", "paas", "cloud host", "web host"],
    attributes: [priceMonthly, hasFreePlan, selfHostable, platforms, targetUser],
    // Reliability/quality dominates; a cheap host that falls over is worthless.
    weights: { ...BASE_WEIGHTS, generalQuality: 0.26, riskPenalty: 0.06, reviewConfidence: 0.14 },
    supportedSources: ["official", "documentation", "trustpilot", "reddit"],
    stalenessThresholdDays: 90,
    categoryAverageRating: 0.79,
  },
  {
    id: "email-platforms",
    name: "Email platforms",
    aliases: ["email platform", "email marketing", "newsletter tool", "esp", "transactional email"],
    attributes: [priceMonthly, hasFreePlan, platforms, targetUser],
    weights: { ...BASE_WEIGHTS, constraintFit: 0.22, generalQuality: 0.22 },
    supportedSources: ["official", "trustpilot", "reddit"],
    stalenessThresholdDays: 120,
    categoryAverageRating: 0.77,
  },
  {
    id: "analytics-tools",
    name: "Analytics tools",
    aliases: ["analytics", "product analytics", "web analytics", "tracking tool", "metrics tool"],
    attributes: [priceMonthly, hasFreePlan, openSource, selfHostable, platforms, targetUser],
    weights: { ...BASE_WEIGHTS, queryRelevance: 0.2, reviewConfidence: 0.14 },
    supportedSources: ["official", "documentation", "github", "reddit"],
    stalenessThresholdDays: 90,
    categoryAverageRating: 0.8,
  },
];

const BY_ID = new Map(CATEGORY_LIST.map((c) => [c.id, c]));

export function listCategories(): CategoryDefinition[] {
  return CATEGORY_LIST;
}

export function getCategory(id: string): CategoryDefinition | undefined {
  return BY_ID.get(id);
}

export function getCategoryAttribute(
  categoryId: string,
  attributeKey: string
): CategoryAttribute | undefined {
  return BY_ID.get(categoryId)?.attributes.find((a) => a.key === attributeKey);
}

/**
 * Resolve a raw query string to a category id via alias/name matching.
 * Deterministic and dependency-free — the AI parser can override this later,
 * but the engine must never *require* the LLM just to name a category.
 * Returns null when nothing matches confidently.
 */
export function detectCategory(rawQuery: string): { categoryId: string | null; confidence: number } {
  const q = ` ${rawQuery.toLowerCase()} `;
  let best: { categoryId: string; score: number } | null = null;

  for (const category of CATEGORY_LIST) {
    const needles = [category.name.toLowerCase(), ...category.aliases];
    for (const needle of needles) {
      if (q.includes(` ${needle} `) || q.includes(`${needle}s `) || q.includes(` ${needle}`)) {
        // Longer alias = more specific match = higher score.
        const score = needle.length;
        if (!best || score > best.score) best = { categoryId: category.id, score };
      }
    }
  }

  if (!best) return { categoryId: null, confidence: 0 };
  // Confidence scales with match specificity, capped so a keyword hit never
  // claims certainty the way an LLM interpretation might.
  return { categoryId: best.categoryId, confidence: Math.min(0.5 + best.score / 40, 0.9) };
}
