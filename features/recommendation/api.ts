/**
 * Recommendation search — API composition layer.
 *
 * Wraps the deterministic core (`runRecommendation`) with the things an HTTP
 * boundary needs: a validated request shape, a request id, timing, the
 * data-mode disclosure, and a TRUTHFUL response state.
 *
 * The response is a discriminated union (`SearchResponse`) — the contract never
 * assumes a successful recommendation. A gated query (unsupported category,
 * ambiguous/unknown, or no eligible option) resolves to its own state with no
 * fabricated winner. It never returns internal prompts, secrets, or raw
 * provider output — there is no provider yet.
 */

import { z } from "zod";
import { runRecommendation, type QueryOverrides } from "./recommend";
import { resolveDataMode, type DataMode } from "./data-mode";
import { isInvariantError } from "./invariant";
import { listCategories } from "./categories/definitions";
import type { CategoryResolution } from "./categories/resolve";
import { constraintOperatorSchema, MAX_RESULT_COUNT, type ParsedQuery } from "./query/schema";
import type {
  RecommendationResult,
  RecommendationDiagnostics,
  RecommendedItem,
  ConfidenceLevel,
  ExplanationClaim,
} from "./types";

// ─── Request ─────────────────────────────────────────────────────────────────

export const MAX_QUERY_LENGTH = 300;

const overrideConstraintSchema = z.object({
  attribute: z.string().min(1).max(64),
  operator: constraintOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean()]),
  label: z.string().min(1).max(160),
});

const overridePreferenceSchema = z.object({
  attribute: z.string().min(1).max(64),
  value: z.union([z.string(), z.number(), z.boolean()]),
  weight: z.number().min(0).max(1).default(0.5),
  label: z.string().min(1).max(160),
});

export const searchRequestSchema = z.object({
  query: z.string().trim().min(1, "empty_query").max(MAX_QUERY_LENGTH, "query_too_long"),
  resultCount: z.number().int().min(1).max(MAX_RESULT_COUNT).optional(),
  categoryId: z.string().trim().min(1).max(64).optional(),
  overrides: z
    .object({
      hardConstraints: z.array(overrideConstraintSchema).max(20).optional(),
      softPreferences: z.array(overridePreferenceSchema).max(20).optional(),
      negativePreferences: z.array(overridePreferenceSchema).max(20).optional(),
    })
    .optional(),
});

export type SearchRequest = z.infer<typeof searchRequestSchema>;

// ─── Response (discriminated union) ───────────────────────────────────────────

/** A ranked candidate as surfaced to the client. */
export type RankedCandidate = RecommendedItem;

/** A top-level, human-readable caveat about a result. */
export type SearchWarning = string;

/** A category the user can pick when we couldn't resolve one. */
export interface CategorySuggestion {
  id: string;
  label: string;
}

/** Fields present on every response variant. */
interface ResponseMeta {
  requestId: string;
  timingMs: number;
  /** Present only in development (Part 9). Never rendered in the production UI. */
  diagnostics?: RecommendationDiagnostics;
}

export type SearchResponse =
  | (ResponseMeta & {
      status: "success";
      dataMode: DataMode;
      seeded: boolean;
      parsedQuery: ParsedQuery;
      categoryName: string;
      bestMatch: RankedCandidate;
      /** Grounded "why this fits" claims for the winner. */
      bestMatchClaims: ExplanationClaim[];
      alternatives: RankedCandidate[];
      confidence: number;
      confidenceLevel: ConfidenceLevel;
      warnings: SearchWarning[];
    })
  | (ResponseMeta & {
      status: "unsupported-category";
      parsedQuery: ParsedQuery;
      category: CategoryResolution;
      message: string;
    })
  | (ResponseMeta & {
      status: "needs-clarification";
      parsedQuery: ParsedQuery;
      category: CategoryResolution;
      suggestions: CategorySuggestion[];
      message: string;
    })
  | (ResponseMeta & {
      status: "no-results";
      parsedQuery: ParsedQuery;
      categoryName: string;
      ineligibleCount: number;
      warnings: SearchWarning[];
      message: string;
    })
  | (ResponseMeta & {
      status: "error";
      message: string;
      code: "seeded_data_unavailable" | "internal_error";
    });

export interface SearchOptions {
  requestId?: string;
  now?: Date;
  /** Injectable for tests; defaults to process.env. */
  env?: NodeJS.ProcessEnv;
}

/** Map a response state to the HTTP status the route should send. */
export function httpStatusForResponse(response: SearchResponse): number {
  if (response.status === "error") {
    return response.code === "seeded_data_unavailable" ? 503 : 500;
  }
  return 200;
}

// ─── Messages + helpers ───────────────────────────────────────────────────────

function unsupportedMessage(resolution: CategoryResolution): string {
  const label = resolution.categoryLabel ? resolution.categoryLabel.toLowerCase() : "that";
  return `Crossing understood your request, but ${label} isn't a category this prototype covers yet. It only ranks online tools and software.`;
}

function clarificationMessage(resolution: CategoryResolution): string {
  return resolution.status === "ambiguous"
    ? "We couldn't tell which category you meant. Pick the one you're after and we'll rank it."
    : "We couldn't match that to a supported category. Choose one to search within.";
}

function noResultsMessage(result: RecommendationResult): string {
  return result.ineligible.length > 0
    ? "We found options in that category, but none cleared every requirement you set. Try relaxing a constraint."
    : "No options matched that search. Try describing it a little differently, or drop a requirement.";
}

function suggestionsFor(resolution: CategoryResolution): CategorySuggestion[] {
  const byId = new Map(listCategories().map((c) => [c.id, c.name]));
  const ids = resolution.suggestedCategoryIds.length > 0 ? resolution.suggestedCategoryIds : [...byId.keys()];
  return ids.map((id) => ({ id, label: byId.get(id) ?? id }));
}

/**
 * Whether THIS result actually used seeded/mock data. `envSeeded` is the
 * static policy gate (dev/preview always seed-capable; prod needs an explicit
 * opt-in) — but a request that hit the DB-backed entity repository is real
 * canonical data with real ingested evidence, not a fixture. Never disclose
 * "seeded" for a result the engine didn't actually mock.
 */
function resultSeeded(result: RecommendationResult, envSeeded: boolean): boolean {
  return envSeeded && result.diagnostics?.candidateSource !== "db";
}

/** Result-quality warnings (only meaningful once a supported category ranked). */
function buildWarnings(result: RecommendationResult, seeded: boolean): SearchWarning[] {
  const warnings: SearchWarning[] = [];
  if (result.confidenceLevel === "low" && result.best) {
    warnings.push("Limited evidence — treat this as a starting point, not a verdict.");
  }
  if (result.best?.freshnessWarnings.length) {
    warnings.push("Some evidence behind these results may be out of date.");
  }
  if (seeded) {
    warnings.push("Results use seeded prototype data, not live web evidence.");
  }
  return warnings;
}

/** Project the internal result into the wire contract. */
function toSearchResponse(
  result: RecommendationResult,
  meta: { requestId: string; timingMs: number; seeded: boolean; dataMode: DataMode; isDev: boolean }
): SearchResponse {
  const base: ResponseMeta = {
    requestId: meta.requestId,
    timingMs: meta.timingMs,
    ...(meta.isDev && result.diagnostics ? { diagnostics: result.diagnostics } : {}),
  };

  const status = result.resolution.status;

  if (status === "unsupported") {
    return {
      ...base,
      status: "unsupported-category",
      parsedQuery: result.query,
      category: result.resolution,
      message: unsupportedMessage(result.resolution),
    };
  }

  if (status === "ambiguous" || status === "unknown") {
    return {
      ...base,
      status: "needs-clarification",
      parsedQuery: result.query,
      category: result.resolution,
      suggestions: suggestionsFor(result.resolution),
      message: clarificationMessage(result.resolution),
    };
  }

  const seeded = resultSeeded(result, meta.seeded);

  // Supported category.
  if (!result.best) {
    return {
      ...base,
      status: "no-results",
      parsedQuery: result.query,
      categoryName: result.categoryName ?? "",
      ineligibleCount: result.ineligible.length,
      warnings: buildWarnings(result, seeded),
      message: noResultsMessage(result),
    };
  }

  return {
    ...base,
    status: "success",
    dataMode: seeded ? meta.dataMode : "live",
    seeded,
    parsedQuery: result.query,
    categoryName: result.categoryName ?? "",
    bestMatch: result.best,
    bestMatchClaims: result.explanationInput.best?.claims ?? [],
    alternatives: result.alternatives,
    confidence: result.confidence,
    confidenceLevel: result.confidenceLevel,
    warnings: buildWarnings(result, seeded),
  };
}

/**
 * Run a search request through the deterministic core and shape it for the
 * wire. Enforces the data-mode guard: in production, seeded data is refused
 * unless explicitly enabled (see data-mode.ts).
 */
export async function searchRecommendations(
  request: SearchRequest,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const requestId = options.requestId ?? randomId();
  const env = options.env ?? process.env;
  const isDev = env.NODE_ENV !== "production";
  const dataMode = resolveDataMode(env);
  const started = now();

  if (!dataMode.allowed) {
    // Seeded data blocked in production — never serve mock data as if it were live.
    return {
      requestId,
      timingMs: round(now() - started),
      status: "error",
      code: "seeded_data_unavailable",
      message: "Search is temporarily unavailable in this environment.",
    };
  }

  const overrides: QueryOverrides = {
    ...(request.categoryId ? { categoryId: request.categoryId } : {}),
    ...(request.resultCount ? { requestedResultCount: request.resultCount } : {}),
    ...(request.overrides?.hardConstraints ? { hardConstraints: request.overrides.hardConstraints } : {}),
    ...(request.overrides?.softPreferences ? { softPreferences: request.overrides.softPreferences } : {}),
    ...(request.overrides?.negativePreferences ? { negativePreferences: request.overrides.negativePreferences } : {}),
  };

  let result: RecommendationResult;
  try {
    result = await runRecommendation(request.query, {
      now: options.now,
      overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    });
  } catch (err) {
    // A tripped engine invariant means an internal guard caught a would-be bad
    // ranking. Fail loudly in development; degrade to a safe error state in
    // production rather than leaking anything unranked.
    if (isInvariantError(err) && !isDev) {
      return {
        requestId,
        timingMs: round(now() - started),
        status: "error",
        code: "internal_error",
        message: "Something went wrong ranking that search. Please try again.",
      };
    }
    throw err;
  }

  return toSearchResponse(result, {
    requestId,
    timingMs: round(now() - started),
    seeded: dataMode.disclose,
    dataMode: dataMode.mode,
    isDev,
  });
}

// ─── small helpers ───────────────────────────────────────────────────────────

function round(ms: number): number {
  return Math.round(ms * 1000) / 1000;
}

function randomId(): string {
  // crypto.randomUUID exists in Node 18+ and the edge/browser runtimes here.
  try {
    return globalThis.crypto?.randomUUID?.() ?? fallbackId();
  } catch {
    return fallbackId();
  }
}

function fallbackId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
