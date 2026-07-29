/**
 * Layered discovery runner.
 *
 * Runs adapters in tier order and STOPS EARLY once the raw pool is deep enough.
 * That ordering is the cost-control mechanism: the canonical layer is free, the
 * search layer costs a few cents, and the agentic layer costs the most — so a
 * category we already cover well never pays for the expensive tiers.
 */

import { issue, nowMs, type StageIssue, type StageMetrics } from "../contracts";
import {
  DISCOVERY_LAYERS,
  LAYER_TIER,
  RAW_CANDIDATE_MAX,
  RAW_CANDIDATE_MIN,
  type CandidateDiscoveryAdapter,
  type DiscoveredCandidate,
  type DiscoveryContext,
  type DiscoveryLayer,
} from "./types";

export interface LayeredDiscoveryResult {
  candidates: DiscoveredCandidate[];
  issues: StageIssue[];
  metrics: StageMetrics;
  /** Candidate counts per adapter id, for observability. */
  byAdapter: Record<string, number>;
  /** Layers that actually ran (vs. skipped because the pool was already deep). */
  layersRun: DiscoveryLayer[];
  /** Every search string issued this request. */
  queriesIssued: string[];
  costUsd: number;
}

export interface LayeredDiscoveryOptions {
  /** Stop once this many raw candidates exist. */
  minCandidates?: number;
  /** Never collect more than this. */
  maxCandidates?: number;
}

export async function runLayeredDiscovery(
  adapters: CandidateDiscoveryAdapter[],
  context: DiscoveryContext,
  options: LayeredDiscoveryOptions = {}
): Promise<LayeredDiscoveryResult> {
  const started = nowMs();
  const min = options.minCandidates ?? RAW_CANDIDATE_MIN;
  const max = options.maxCandidates ?? RAW_CANDIDATE_MAX;

  const candidates: DiscoveredCandidate[] = [];
  const issues: StageIssue[] = [];
  const byAdapter: Record<string, number> = {};
  const layersRun: DiscoveryLayer[] = [];
  const queriesIssued: string[] = [];
  let externalCalls = 0;
  let costUsd = 0;

  const ordered = [...adapters].sort((a, b) => LAYER_TIER[a.layer] - LAYER_TIER[b.layer]);

  for (const adapter of ordered) {
    // Enough breadth already — do not pay for a deeper tier.
    if (candidates.length >= min) break;
    if (candidates.length >= max) break;
    if (context.signal?.aborted) {
      issues.push(issue("discover", "source_timeout", "Discovery cancelled by deadline."));
      break;
    }

    const wanted = Math.max(0, max - candidates.length);
    const scoped: DiscoveryContext = { ...context, wanted };

    if (!adapter.supports(scoped)) continue;

    try {
      const outcome = await adapter.discover(scoped);
      candidates.push(...outcome.candidates.slice(0, wanted));
      issues.push(...outcome.issues);
      byAdapter[adapter.id] = outcome.candidates.length;
      queriesIssued.push(...outcome.queriesIssued);
      externalCalls += outcome.externalCalls;
      costUsd += outcome.costUsd;
      if (!layersRun.includes(adapter.layer)) layersRun.push(adapter.layer);
    } catch (err) {
      // One adapter failing must never fail discovery.
      issues.push(
        issue(
          "discover",
          "source_unavailable",
          `Adapter threw: ${err instanceof Error ? err.name : "unknown"}`,
          adapter.id
        )
      );
    }
  }

  if (candidates.length === 0) {
    issues.push(
      issue("discover", "partial_data", "No discovery layer produced a candidate for this category.")
    );
  }

  return {
    candidates,
    issues,
    byAdapter,
    layersRun,
    queriesIssued,
    costUsd: Math.round(costUsd * 10_000) / 10_000,
    metrics: {
      stage: "discover",
      durationMs: Math.round((nowMs() - started) * 1000) / 1000,
      itemsIn: ordered.length,
      itemsOut: candidates.length,
      externalCalls,
    },
  };
}

/** Layer order, exported for tests and diagnostics. */
export const LAYER_ORDER = DISCOVERY_LAYERS;
