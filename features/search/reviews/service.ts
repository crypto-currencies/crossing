/**
 * Review service — runs adapters, combines sources, and builds the public
 * attribution contract.
 *
 * This is the boundary between "independent review data" and the rest of the
 * search pipeline. Two invariants it maintains:
 *
 *   1. A typed unavailable state is never rendered as "no reviews". "We could
 *      not check Trustpilot" and "Trustpilot has no reviews for this" are
 *      different facts, and `ReputationResult.availability` keeps them distinct.
 *
 *   2. Attribution requirements travel WITH the data. The frontend receives
 *      what each provider mandates — logo key, backlink, legal text, retrieved
 *      date — so a presentation change cannot silently drop a required element.
 */

import type { Entity } from "@/features/recommendation/entities/types";
import type { Evidence } from "@/features/recommendation/evidence/types";
import type { SearchContext } from "../contracts";
import { assertIndependentProvider, canInfluenceRanking } from "./types";
import type {
  Attribution,
  ProviderAvailability,
  ReviewAggregate,
  ReviewEntityMatch,
  ReviewProviderId,
  ReviewSourceAdapter,
} from "./types";
import { combineReputation, type MultiSourceReputation } from "./normalize";

// ─── Public attribution contract (Part 10) ───────────────────────────────────

/**
 * Everything the frontend must render for one provider. Returned per source so
 * a UI showing three ratings shows three attributions.
 */
export interface AttributionBlock {
  provider: ReviewProviderId;
  providerName: string;
  /** Bundled-asset key. Never a hotlinked provider URL. */
  providerLogoKey: string | null;
  sourceUrl: string;
  /** Display rating on the provider's own scale, e.g. 4.3 of 5. */
  rating: number | null;
  ratingScale: number | null;
  reviewCount: number;
  retrievedAt: string;
  requiredText: string | null;
  requiresBacklink: boolean;
  requiresNewTab: boolean;
}

function toAttributionBlock(aggregate: ReviewAggregate): AttributionBlock {
  const a: Attribution = aggregate.attribution;
  return {
    provider: aggregate.provider,
    providerName: a.providerName,
    providerLogoKey: a.providerLogoKey,
    sourceUrl: a.sourceUrl,
    rating: aggregate.rating,
    ratingScale: aggregate.ratingScale,
    reviewCount: aggregate.reviewCount,
    retrievedAt: a.retrievedAt,
    requiredText: a.requiredText,
    requiresBacklink: a.requiresBacklink,
    requiresNewTab: a.requiresNewTab,
  };
}

// ─── Result ──────────────────────────────────────────────────────────────────

export interface ProviderOutcome {
  provider: ReviewProviderId;
  availability: ProviderAvailability;
  match: ReviewEntityMatch | null;
  aggregate: ReviewAggregate | null;
  /** True when the provider ran and genuinely found no record. */
  checkedAndAbsent: boolean;
}

export interface ReputationResult {
  entityId: string;
  reputation: MultiSourceReputation;
  attributions: AttributionBlock[];
  /** Per-provider outcome, including the ones that could not run. */
  providerOutcomes: ProviderOutcome[];
  /**
   * True when at least one provider ran successfully. When false, the absence
   * of reviews is UNKNOWN, not established — the UI must say so.
   */
  anyProviderChecked: boolean;
  /** Owner-facing actions that would unlock more coverage. */
  requiredActions: string[];
}

export interface ReviewServiceDeps {
  adapters: ReviewSourceAdapter[];
  /** Per-category prior for Bayesian shrinkage. */
  categoryAverage: (categoryId: string) => number;
}

export class ReviewService {
  private readonly adapters: ReviewSourceAdapter[];

  constructor(private readonly deps: ReviewServiceDeps) {
    // Independence is verified at construction. An adapter reading a vendor's
    // own site cannot be registered, so the core rule cannot be violated by a
    // later code change without this throwing.
    for (const adapter of deps.adapters) assertIndependentProvider(adapter);
    this.adapters = deps.adapters;
  }

  /** Which providers can run here, and what an owner must do about the rest. */
  capabilities(env: NodeJS.ProcessEnv): {
    available: ReviewProviderId[];
    unavailable: { provider: ReviewProviderId; reason: string; requiredAction?: string }[];
  } {
    const available: ReviewProviderId[] = [];
    const unavailable: { provider: ReviewProviderId; reason: string; requiredAction?: string }[] = [];

    for (const adapter of this.adapters) {
      const a = adapter.availability(env);
      if (a.available) available.push(adapter.id);
      else
        unavailable.push({
          provider: adapter.id,
          reason: a.reason,
          ...(a.requiredAction ? { requiredAction: a.requiredAction } : {}),
        });
    }
    return { available, unavailable };
  }

  /**
   * Gather reputation for one entity across every adapter.
   *
   * Adapters run in parallel and are individually fault-isolated: one provider
   * failing reduces coverage and is reported, it never fails the request.
   */
  async gather(entity: Entity, context: SearchContext): Promise<ReputationResult> {
    const outcomes = await Promise.all(
      this.adapters.map((adapter) => this.runAdapter(adapter, entity, context))
    );

    const aggregates = outcomes
      .map((o) => o.aggregate)
      .filter((a): a is ReviewAggregate => a !== null);

    const reputation = combineReputation(
      aggregates,
      this.deps.categoryAverage(entity.categoryId),
      context.now
    );

    const anyProviderChecked = outcomes.some((o) => o.availability.available);
    if (!anyProviderChecked) {
      // Critical distinction: we did not check, so we do not know.
      reputation.notes.push(
        "No independent review source could be checked for this option — its reputation is unknown, not absent."
      );
    }

    const requiredActions = [
      ...new Set(
        outcomes
          .map((o) => (o.availability.available ? null : o.availability.requiredAction))
          .filter((a): a is string => Boolean(a))
      ),
    ];

    return {
      entityId: entity.id,
      reputation,
      attributions: aggregates.map(toAttributionBlock),
      providerOutcomes: outcomes,
      anyProviderChecked,
      requiredActions,
    };
  }

  /** Gather for many entities. Adapter-level concurrency is bounded per entity. */
  async gatherMany(entities: Entity[], context: SearchContext): Promise<Map<string, ReputationResult>> {
    const results = await Promise.all(entities.map((e) => this.gather(e, context)));
    return new Map(results.map((r) => [r.entityId, r]));
  }

  private async runAdapter(
    adapter: ReviewSourceAdapter,
    entity: Entity,
    context: SearchContext
  ): Promise<ProviderOutcome> {
    const availability = adapter.availability(context.env);

    const absent = (over: Partial<ProviderOutcome> = {}): ProviderOutcome => ({
      provider: adapter.id,
      availability,
      match: null,
      aggregate: null,
      checkedAndAbsent: false,
      ...over,
    });

    if (!availability.available) return absent();
    if (!adapter.supports(entity, context)) {
      return absent({
        availability: {
          available: false,
          reason: "category-unsupported",
          detail: `${adapter.id} does not cover ${entity.categoryId}.`,
        },
      });
    }

    try {
      const match = await adapter.matchEntity(entity, context);

      if (!match.matched) {
        // The provider ran and found nothing — a real, reportable finding.
        return absent({ match, checkedAndAbsent: true });
      }

      // A low-confidence match is kept for audit but must not reach ranking.
      // `combineReputation` enforces this again via the weight calculation;
      // returning it here keeps the diagnostic trail intact.
      if (!canInfluenceRanking(match)) {
        const aggregate = await adapter.fetchAggregate(match, context);
        return absent({ match, aggregate, checkedAndAbsent: aggregate === null });
      }

      const aggregate = await adapter.fetchAggregate(match, context);
      return absent({ match, aggregate, checkedAndAbsent: aggregate === null });
    } catch (err) {
      return absent({
        availability: {
          available: false,
          reason: "provider-error",
          detail: `${adapter.id} failed: ${err instanceof Error ? err.name : "unknown error"}`,
        },
      });
    }
  }
}

// ─── Bridge into the existing evidence pipeline ──────────────────────────────

/**
 * Convert reputation into `Evidence` records the ranking engine already
 * understands.
 *
 * `sourceType` is the provider id, which `SOURCE_CLASS` in ../evidence/classes.ts
 * maps to the `independent` class — so this data flows into reputation scoring
 * while official-site evidence still cannot.
 *
 * Only ranking-eligible sources are emitted. A low-confidence match produces no
 * Evidence record at all, so it cannot influence a score by any path.
 */
export function toEvidenceRecords(result: ReputationResult): Evidence[] {
  const out: Evidence[] = [];

  for (const outcome of result.providerOutcomes) {
    const { aggregate, match } = outcome;
    if (!aggregate || !match || !match.matched) continue;
    if (!canInfluenceRanking(match)) continue;

    out.push({
      sourceType: aggregate.provider,
      sourceUrl: aggregate.providerUrl,
      retrievedAt: aggregate.retrievedAt,
      rating: aggregate.rating,
      ratingScale: aggregate.ratingScale,
      reviewCount: aggregate.reviewCount,
      // Reviews assert reputation, never product facts — an empty attribute bag
      // is what keeps review data out of the official-facts space.
      attributes: {},
      confidence: aggregate.sourceConfidence,
      entityMatchConfidence: aggregate.matchConfidence,
      reviewTopics: aggregate.topics.map((t) => ({
        topic: t.topic,
        sentiment: t.sentiment,
        mentions: t.mentions,
      })),
    });
  }

  return out;
}
