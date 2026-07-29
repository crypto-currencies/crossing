/**
 * Ranking integration + mock/live isolation.
 *
 * Overlays recent official-site FACTUAL attributes onto a seeded entity with
 * explicit precedence + conflict rules, and classifies each entity's evidence
 * mode (seeded / mixed / live). Deterministic given (entity, snapshot).
 *
 * Precedence (Part 11):
 *   - Factual attrs (hasFreePlan, priceMonthly, platforms): fresh, confident
 *     official evidence generally outranks the seed value.
 *   - Official marketing copy never becomes a rating or review-quality signal.
 *   - Missing official data never means "feature absent" — the seed value stays.
 *   - Conflicts produce warnings, never silent overwrites.
 *
 * Enrichment is OPT-IN (INGESTION_MERGE=on). Default behavior — and every existing
 * recommendation test — is unchanged: the seeded corpus is used as-is.
 */

import type { Entity } from "@/features/recommendation/entities/types";
import { RANKING_FACTUAL_ATTRIBUTES, toRecommendationEvidence } from "./evidence";
import { computeFreshness, type EvidenceSnapshot } from "./snapshot";
import type { SnapshotStore } from "./store";
import type { EvidenceMode } from "./types";

/** Minimum per-attribute confidence for official evidence to influence ranking. */
export const MIN_OVERLAY_CONFIDENCE = 0.6;

export interface AttributeConflict {
  attribute: string;
  seedValue: string | number | boolean | undefined;
  officialValue: string | number | boolean;
  resolution: "official" | "seed";
  reason: string;
}

export interface MergeResult {
  entity: Entity;
  evidenceMode: EvidenceMode;
  conflicts: AttributeConflict[];
  /** Ranking-relevant attribute keys whose value is now official-backed. */
  rankingFieldsAffected: string[];
  /** Ranking-relevant attribute keys still sourced from the seed. */
  rankingFieldsSeeded: string[];
  warnings: string[];
  usedSnapshotId: string | null;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return String(a).toLowerCase() === String(b).toLowerCase();
}

/**
 * Merge one entity with its latest official snapshot. Returns a NEW entity; the
 * input is never mutated. Precedence + conflicts are recorded for the audit UI.
 */
export function mergeOfficialEvidence(
  entity: Entity,
  snapshot: EvidenceSnapshot | null,
  opts: { now?: Date; minConfidence?: number } = {}
): MergeResult {
  const now = opts.now ?? new Date();
  const minConfidence = opts.minConfidence ?? MIN_OVERLAY_CONFIDENCE;

  // Factual attrs that matter for THIS entity (it has a seed value, or official asserts one).
  const critical = RANKING_FACTUAL_ATTRIBUTES.filter(
    (k) => k in entity.attributes || (snapshot?.attributes && k in snapshot.attributes)
  );

  if (!snapshot || !snapshot.ok) {
    return {
      entity,
      evidenceMode: "seeded",
      conflicts: [],
      rankingFieldsAffected: [],
      rankingFieldsSeeded: critical as unknown as string[],
      warnings: [],
      usedSnapshotId: null,
    };
  }

  const freshness = computeFreshness(snapshot.retrievedAt, now);
  const nextAttributes = { ...entity.attributes };
  const conflicts: AttributeConflict[] = [];
  const warnings: string[] = [];
  const affected: string[] = [];
  const seeded: string[] = [];

  for (const key of critical) {
    const officialValue = snapshot.attributes[key];
    const seedValue = entity.attributes[key];
    const prov = snapshot.provenance.find((p) => p.attribute === key);
    const confidence = prov?.confidence ?? snapshot.confidence;
    const eligible = freshness !== "stale" && confidence >= minConfidence && officialValue !== undefined;

    if (officialValue === undefined) {
      // No official assertion → seed remains (missing ≠ absent).
      if (seedValue !== undefined) seeded.push(key);
      continue;
    }

    if (!eligible) {
      seeded.push(key);
      if (seedValue !== undefined && !valuesEqual(seedValue, officialValue)) {
        conflicts.push({
          attribute: key,
          seedValue,
          officialValue,
          resolution: "seed",
          reason: freshness === "stale" ? "official evidence is stale" : "official confidence below threshold",
        });
        warnings.push(`Kept seeded ${key}: official value not applied (${freshness === "stale" ? "stale" : "low confidence"}).`);
      }
      continue;
    }

    // Eligible official value.
    if (seedValue === undefined) {
      nextAttributes[key] = officialValue;
      affected.push(key);
    } else if (valuesEqual(seedValue, officialValue)) {
      // Official corroborates the seed → treat as official-backed, no conflict.
      affected.push(key);
    } else {
      // Conflict: recent official generally outranks the seed.
      nextAttributes[key] = officialValue;
      affected.push(key);
      conflicts.push({
        attribute: key,
        seedValue,
        officialValue,
        resolution: "official",
        reason: "recent official-site evidence outranks the seeded value",
      });
      warnings.push(`Updated ${key}: ${String(seedValue)} → ${String(officialValue)} from official site.`);
    }
  }

  for (const key of critical) {
    if (!affected.includes(key) && !seeded.includes(key)) seeded.push(key);
  }

  // Append the official Evidence record (adds source diversity + freshness; never a rating).
  const officialEvidence = toRecommendationEvidence(
    { attributes: snapshot.attributes, provenance: snapshot.provenance, pricing: snapshot.pricing, confidence: snapshot.confidence },
    snapshot.primarySourceUrl,
    snapshot.retrievedAt
  );

  const mergedEntity: Entity = {
    ...entity,
    attributes: nextAttributes,
    evidence: [...entity.evidence, officialEvidence],
  };

  const evidenceMode: EvidenceMode =
    critical.length > 0 && affected.length === critical.length ? "live" : affected.length > 0 ? "mixed" : "seeded";

  return {
    entity: mergedEntity,
    evidenceMode,
    conflicts,
    rankingFieldsAffected: affected,
    rankingFieldsSeeded: seeded,
    warnings,
    usedSnapshotId: snapshot.id,
  };
}

/** Classify evidence mode without building the merged entity (for list views). */
export function classifyEvidenceMode(entity: Entity, snapshot: EvidenceSnapshot | null, now: Date = new Date()): EvidenceMode {
  return mergeOfficialEvidence(entity, snapshot, { now }).evidenceMode;
}

/**
 * Enrich a seeded corpus with stored official evidence. OPT-IN via
 * INGESTION_MERGE=on. Reads only the snapshot store (no crawling), so it is safe
 * to call from the recommendation path. Returns the corpus unchanged when
 * disabled or when there are no snapshots.
 */
export async function enrichCorpusWithOfficialEvidence(
  corpus: Entity[],
  store: SnapshotStore,
  now: Date = new Date()
): Promise<{ corpus: Entity[]; anyLive: boolean; anyMixed: boolean }> {
  const latest = await store.allLatest();
  let anyLive = false;
  let anyMixed = false;
  const enriched = corpus.map((entity) => {
    const snap = latest.get(entity.id) ?? null;
    if (!snap || !snap.ok) return entity;
    const merged = mergeOfficialEvidence(entity, snap, { now });
    if (merged.evidenceMode === "live") anyLive = true;
    if (merged.evidenceMode === "mixed") anyMixed = true;
    return merged.entity;
  });
  return { corpus: enriched, anyLive, anyMixed };
}

/** True when official-evidence enrichment is explicitly enabled. */
export function isEnrichmentEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.INGESTION_MERGE === "on";
}
