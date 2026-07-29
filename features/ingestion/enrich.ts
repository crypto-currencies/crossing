/**
 * Config-gated, readiness-checked ranking enrichment (Part 11).
 *
 * Overlays official factual evidence onto the ranking corpus ONLY for entities
 * whose category/entity is explicitly allow-listed AND whose latest snapshot
 * passes readiness. Unready entities keep their seeded values (a warning is
 * recorded). Ready pilot entities (not in the base corpus) are injected. When no
 * merge scope is configured, the corpus is returned unchanged — the validated
 * seeded path.
 *
 * Ratings/reviews are never touched (mergeOfficialEvidence appends official
 * evidence with rating=null and only overlays factual attributes).
 */

import type { Entity } from "@/features/recommendation/entities/types";
import { mergeOfficialEvidence } from "./merge";
import { assessReadiness } from "./readiness";
import { anyMergeConfigured, mergeAllowed } from "./config";
import { getApprovedSource } from "./registry";
import { PILOT_ENTITIES } from "./pilot";
import type { SnapshotStore } from "./store";

export interface EnrichResult {
  corpus: Entity[];
  evidenceMode?: "seeded" | "mixed" | "live";
  warnings: string[];
}

export async function applyConfiguredMerge(
  baseCorpus: Entity[],
  store: SnapshotStore,
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date()
): Promise<EnrichResult> {
  if (!anyMergeConfigured(env)) return { corpus: baseCorpus, warnings: [] };

  const latest = await store.allLatest();
  const corpus = [...baseCorpus];
  const present = new Set(corpus.map((e) => e.id));
  const warnings: string[] = [];
  let anyLive = false;
  let anyMixed = false;

  const consider = (entity: Entity, index: number, addIfNew: boolean) => {
    if (!mergeAllowed(entity.id, entity.categoryId, env)) return;
    const snap = latest.get(entity.id) ?? null;
    const latestValid = snap && snap.ok ? snap : null;
    const merged = mergeOfficialEvidence(entity, latestValid, { now });
    const readiness = assessReadiness({
      source: getApprovedSource(entity.id) ?? null,
      latest: snap,
      latestValid,
      merge: merged,
    });

    if (readiness.verdict === "ready" || readiness.verdict === "mixed") {
      if (index >= 0) corpus[index] = merged.entity;
      else if (addIfNew) corpus.push(merged.entity);
      if (merged.evidenceMode === "live") anyLive = true;
      else anyMixed = true;
    } else {
      // Not ready → keep seeded values; surface a warning, apply nothing unsafe.
      warnings.push(`${entity.id}: official evidence not applied (${readiness.verdict}).`);
    }
  };

  // Existing corpus entities (allow-listed only).
  baseCorpus.forEach((e, i) => consider(e, i, false));
  // Ready pilot entities not already in the corpus.
  for (const pilot of PILOT_ENTITIES) {
    if (!present.has(pilot.id)) consider(pilot, -1, true);
  }

  const evidenceMode = anyLive ? (anyMixed ? "mixed" : "live") : anyMixed ? "mixed" : "seeded";
  return { corpus, evidenceMode, warnings };
}
