/**
 * Review-source wiring, and the bridge into the search pipeline's
 * `EvidenceSource` interface.
 *
 * `buildReviewAdapters` returns ONLY adapters that actually exist. There is no
 * placeholder, no stub, and no "coming soon" adapter that returns empty data —
 * an unimplemented provider is simply absent, and `providers.ts` documents what
 * an owner must do to change that.
 */

import { getCategory } from "@/features/recommendation/categories/definitions";
import type { SearchContext } from "../contracts";
import { issue } from "../contracts";
import type {
  BatchEvidenceOutcome,
  BatchEvidenceSource,
  EvidenceOutcome,
  EvidenceRequest,
  SourceDescriptor,
} from "../sources/types";
import type { Entity } from "@/features/recommendation/entities/types";
import { ReviewService, toEvidenceRecords, type ReputationResult } from "./service";
import { TrustpilotAdapter } from "./trustpilot";
import type { ReviewSourceAdapter } from "./types";

export interface ReviewWiringOptions {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

/**
 * Every review adapter implemented in this codebase.
 *
 * Trustpilot is the only one. Adapters are constructed regardless of whether
 * credentials exist — the adapter itself reports `missing-credentials`, which is
 * how the pipeline can tell an owner what to configure instead of silently
 * having no review coverage.
 */
export function buildReviewAdapters(options: ReviewWiringOptions = {}): ReviewSourceAdapter[] {
  const env = options.env ?? process.env;
  return [
    new TrustpilotAdapter({
      env,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      ...(options.now ? { now: options.now } : {}),
    }),
  ];
}

export function buildReviewService(options: ReviewWiringOptions = {}): ReviewService {
  return new ReviewService({
    adapters: buildReviewAdapters(options),
    categoryAverage: (categoryId) => getCategory(categoryId)?.categoryAverageRating ?? 0.75,
  });
}

// ─── EvidenceSource bridge ───────────────────────────────────────────────────

/**
 * Adapts the review service to the pipeline's `EvidenceSource` interface so the
 * orchestrator needs no special case for reviews.
 *
 * Declared `independence: "independent"`, which is what allows its ratings to
 * survive `enforceIndependence` — the same guard that strips them from vendor
 * sources.
 */
export class ReviewEvidenceSource implements BatchEvidenceSource {
  readonly descriptor: SourceDescriptor = {
    id: "reviews",
    label: "Independent reviews",
    independence: "independent",
    network: true,
  };

  /** Populated per batch so the orchestrator can surface attribution. */
  private lastResults = new Map<string, ReputationResult>();

  constructor(
    private readonly service: ReviewService,
    /** Resolves an entity id back to the entity — adapters match on domain. */
    private readonly entitiesById: () => Map<string, Entity>
  ) {}

  /** Attribution + per-source breakdown from the most recent batch. */
  getResults(): Map<string, ReputationResult> {
    return this.lastResults;
  }

  isAvailable(ctx: SearchContext): boolean {
    return this.service.capabilities(ctx.env).available.length > 0;
  }

  async gather(request: EvidenceRequest, ctx: SearchContext): Promise<EvidenceOutcome> {
    const entity = this.entitiesById().get(request.entityId);
    if (!entity) {
      return {
        evidence: [],
        issues: [issue("gatherEvidence", "partial_data", "Entity not available for review lookup.", request.entityId)],
        externalCalls: 0,
      };
    }

    const result = await this.service.gather(entity, ctx);
    this.lastResults.set(request.entityId, result);

    return {
      evidence: toEvidenceRecords(result),
      issues: issuesFor(result),
      externalCalls: result.providerOutcomes.filter((o) => o.availability.available).length,
    };
  }

  async gatherMany(requests: EvidenceRequest[], ctx: SearchContext): Promise<BatchEvidenceOutcome> {
    const byId = this.entitiesById();
    const entities = requests.map((r) => byId.get(r.entityId)).filter((e): e is Entity => Boolean(e));

    if (entities.length === 0) {
      return { byEntity: new Map(), issues: [], externalCalls: 0 };
    }

    const results = await this.service.gatherMany(entities, ctx);
    this.lastResults = results;

    const byEntity = new Map<string, ReturnType<typeof toEvidenceRecords>>();
    const allIssues = [];
    let externalCalls = 0;

    for (const [entityId, result] of results) {
      byEntity.set(entityId, toEvidenceRecords(result));
      allIssues.push(...issuesFor(result));
      externalCalls += result.providerOutcomes.filter((o) => o.availability.available).length;
    }

    return { byEntity, issues: allIssues, externalCalls };
  }
}

/**
 * Turn reputation gaps into pipeline issues.
 *
 * The distinction that matters: a provider that ran and found nothing is
 * `field_absent` (reviews genuinely absent), while a provider that could not run
 * is `source_unavailable` (reputation UNKNOWN). Collapsing those two would let
 * a missing API key read as "this product has no reviews".
 */
function issuesFor(result: ReputationResult) {
  const issues = [];

  for (const outcome of result.providerOutcomes) {
    if (!outcome.availability.available) {
      issues.push(
        issue(
          "gatherEvidence",
          outcome.availability.reason === "missing-credentials" ? "source_unavailable" : "source_rejected",
          `${outcome.provider}: ${outcome.availability.detail}`,
          result.entityId
        )
      );
      continue;
    }
    if (outcome.checkedAndAbsent) {
      issues.push(
        issue("gatherEvidence", "field_absent", `${outcome.provider}: no record found for this entity.`, result.entityId)
      );
    }
    if (outcome.match?.matched && outcome.aggregate && outcome.match.confidence < 0.85) {
      issues.push(
        issue(
          "gatherEvidence",
          "low_confidence",
          `${outcome.provider}: match confidence ${outcome.match.confidence.toFixed(2)} — excluded from ranking.`,
          result.entityId
        )
      );
    }
  }

  return issues;
}
