/**
 * Stages 1–2: `parse` and `resolve`.
 *
 * Both reuse the existing, well-tested modules rather than reimplementing them
 * (docs/live-search-architecture.md §2.4). What is NEW here is the availability
 * check in `resolve`: the audit found the category gate validates category
 * VOCABULARY but not whether any candidate exists in that category, so a query
 * like "best email platform" resolves confidently and then dead-ends in
 * `no-results` (§1.5). The resolve stage now reports availability so the
 * orchestrator can answer honestly.
 */

import { getCategory } from "@/features/recommendation/categories/definitions";
import { resolveCategory, type CategoryResolution } from "@/features/recommendation/categories/resolve";
import { deterministicParser, parseQuerySafe, type QueryParser } from "@/features/recommendation/query/parser";
import { parsedQuerySchema, type ParsedQuery } from "@/features/recommendation/query/schema";
import {
  MAX_RANKED_RESULTS,
  TARGET_RESULT_COUNT,
  issue,
  nowMs,
  pureResult,
  type SearchContext,
  type SearchRequestInput,
  type Stage,
  type StageIssue,
  type StageResult,
} from "../contracts";

// ─── Stage 1: parse ──────────────────────────────────────────────────────────

export interface ParseOutput {
  parsed: ParsedQuery;
  /** How many results this request should aim to return. */
  targetCount: number;
}

/**
 * Interpret the raw request into a validated `ParsedQuery`.
 *
 * The parser is injectable so an AI-backed parser can replace the deterministic
 * one behind a flag — but it stays INTERPRETATION ONLY. Its output is validated
 * against `parsedQuerySchema`, and `parseQuerySafe` degrades to a minimal valid
 * query rather than throwing, so a parser failure can never 500 the request.
 */
export class ParseStage implements Stage<SearchRequestInput, ParseOutput> {
  readonly name = "parse" as const;

  constructor(private readonly parser: QueryParser = deterministicParser) {}

  async run(input: SearchRequestInput, ctx: SearchContext): Promise<StageResult<ParseOutput>> {
    const started = nowMs();
    const issues: StageIssue[] = [];

    let parsed = await parseQuerySafe(this.parser, input.query);

    if (parsed.confidence < 0.4) {
      issues.push(
        issue("parse", "low_confidence", `Parser confidence ${parsed.confidence.toFixed(2)} — interpretation may be incomplete.`)
      );
    }
    for (const ambiguity of parsed.ambiguities) {
      issues.push(issue("parse", "partial_data", ambiguity));
    }

    // A user-pinned category overrides the parser's guess.
    if (input.categoryId) {
      parsed = parsedQuerySchema.parse({ ...parsed, categoryId: input.categoryId });
    }

    // The ranked-list target. Unlike the old DEFAULT_RESULT_COUNT=3, the default
    // here is a full list; an explicit request still wins, capped for sanity.
    const requested = input.resultCount ?? TARGET_RESULT_COUNT;
    const targetCount = Math.min(Math.max(requested, 1), MAX_RANKED_RESULTS);

    void ctx;
    return pureResult(this.name, { parsed, targetCount }, started, { in: 1, out: 1 }, issues);
  }
}

// ─── Stage 2: resolve ────────────────────────────────────────────────────────

/** Reports how many candidates a category can actually offer. */
export interface CategoryAvailability {
  /** Entities the catalog holds for this category, before any filtering. */
  knownCandidates: number;
  /** True when the category has enough entities to attempt a useful ranking. */
  viable: boolean;
}

export interface ResolveOutput {
  resolution: CategoryResolution;
  /** Non-null exactly when `resolution.status === "supported"`. */
  categoryId: string | null;
  categoryName: string | null;
  /** Null when the category did not resolve, or when no availability probe ran. */
  availability: CategoryAvailability | null;
}

/** Probes how many candidates a category holds, without retrieving them. */
export type AvailabilityProbe = (categoryId: string) => Promise<number>;

export class ResolveStage implements Stage<ParseOutput, ResolveOutput> {
  readonly name = "resolve" as const;

  constructor(private readonly probe?: AvailabilityProbe) {}

  async run(input: ParseOutput, ctx: SearchContext): Promise<StageResult<ResolveOutput>> {
    const started = nowMs();
    const issues: StageIssue[] = [];

    const resolution = resolveCategory(input.parsed.rawQuery, input.parsed.categoryId);

    if (resolution.status !== "supported") {
      return pureResult(
        this.name,
        { resolution, categoryId: null, categoryName: null, availability: null },
        started,
        { in: 1, out: 0 },
        issues
      );
    }

    const categoryId = resolution.categoryId!;
    const category = getCategory(categoryId);
    const categoryName = category?.name ?? categoryId;

    // Availability: the fix for §1.5. Resolving a category we cannot populate is
    // a dead end, and the user deserves to be told that up front rather than
    // after an empty ranking.
    let availability: CategoryAvailability | null = null;
    if (this.probe) {
      try {
        const knownCandidates = await this.probe(categoryId);
        availability = { knownCandidates, viable: knownCandidates > 0 };
        if (knownCandidates === 0) {
          issues.push(
            issue(
              "resolve",
              "partial_data",
              `Category "${categoryName}" is recognized but the catalog holds no entities for it yet.`,
              categoryId
            )
          );
        }
      } catch {
        issues.push(issue("resolve", "source_unavailable", "Could not probe category availability.", categoryId));
      }
    }

    void ctx;
    return pureResult(
      this.name,
      { resolution, categoryId, categoryName, availability },
      started,
      { in: 1, out: 1 },
      issues
    );
  }
}
