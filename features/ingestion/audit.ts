/**
 * Evidence audit view-models (development/admin only).
 *
 * Compares each seeded entity's factual attributes against the latest official-
 * site snapshot so developers can judge evidence quality before live evidence
 * influences production ranking. Read-only; never crawls. Supporting text is
 * kept as short excerpts (escaped at render, never raw HTML).
 */

import { buildFixtures } from "@/features/recommendation/fixtures";
import { getCategory } from "@/features/recommendation/categories/definitions";
import type { Entity } from "@/features/recommendation/entities/types";
import { listApprovedSources, getApprovedSource, resolveApprovedUrls, type ApprovedEntitySource } from "./registry";
import { getPilotSeedEntity } from "./pilot";
import { RANKING_FACTUAL_ATTRIBUTES } from "./evidence";
import { mergeOfficialEvidence, type AttributeConflict } from "./merge";
import { assessReadiness, type ReadinessResult, type ReadinessVerdict } from "./readiness";
import type { SnapshotStore } from "./store";
import type { EvidenceSnapshot, FreshnessStatus } from "./snapshot";
import type { EvidenceMode } from "./types";

/** Coarse robots status derived from the latest snapshot outcome. */
function robotsStatusFor(latest: EvidenceSnapshot | null): "allowed" | "blocked" | "unknown" {
  if (!latest) return "unknown";
  if (latest.error?.kind === "robots_blocked") return "blocked";
  return "allowed";
}

export type LastOutcome = "created" | "deduplicated" | "failed" | "never";

export interface EntityAuditRow {
  entityId: string;
  canonicalName: string;
  categoryId: string;
  categoryName: string;
  enabled: boolean;
  pilot: boolean;
  sourceUrls: string[];
  robotsStatus: "allowed" | "blocked" | "unknown";
  evidenceMode: EvidenceMode;
  lastIngestAt: string | null;
  lastSuccessAt: string | null;
  lastOutcome: LastOutcome;
  freshness: FreshnessStatus | "none";
  hasConflicts: boolean;
  missingFactualFields: string[];
  failed: boolean;
  extractionConfidence: number | null;
  readiness: ReadinessVerdict;
}

/** Whether the official side has a value, and why not when it doesn't. */
export type OfficialState = "value" | "not-found" | "ingest-failed" | "never-ingested";

export interface AttributeComparison {
  attribute: string;
  rankingField: boolean;
  seedValue: string | number | boolean | undefined;
  officialState: OfficialState;
  officialValue?: string | number | boolean;
  method?: string;
  sourceUrl?: string;
  sourceText?: string;
  confidence?: number;
  fingerprint?: string;
  verdict: "match" | "conflict" | "official-only" | "seed-only" | "both-missing" | "unavailable";
}

export interface EntityAuditDetail {
  row: EntityAuditRow;
  source: ApprovedEntitySource | null;
  latest: EvidenceSnapshot | null;
  latestValid: EvidenceSnapshot | null;
  history: EvidenceSnapshot[];
  comparisons: AttributeComparison[];
  conflicts: AttributeConflict[];
  rankingFieldsAffected: string[];
  rankingFieldsNotAffected: string[];
  warnings: string[];
  readiness: ReadinessResult;
  robotsStatus: "allowed" | "blocked" | "unknown";
}

function seedEntity(entityId: string, now: Date): Entity | undefined {
  return buildFixtures(now).find((e) => e.id === entityId) ?? getPilotSeedEntity(entityId);
}

function officialStateFor(latest: EvidenceSnapshot | null, key: string): { state: OfficialState; value?: string | number | boolean } {
  if (!latest) return { state: "never-ingested" };
  if (!latest.ok) return { state: "ingest-failed" };
  if (key in latest.attributes) return { state: "value", value: latest.attributes[key] };
  return { state: "not-found" };
}

function compareAttribute(entity: Entity, latest: EvidenceSnapshot | null, key: string): AttributeComparison {
  const seedValue = entity.attributes[key];
  const { state, value } = officialStateFor(latest, key);
  const prov = latest?.provenance.find((p) => p.attribute === key);

  let verdict: AttributeComparison["verdict"];
  if (state === "value") {
    if (seedValue === undefined) verdict = "official-only";
    else if (String(seedValue).toLowerCase() === String(value).toLowerCase()) verdict = "match";
    else verdict = "conflict";
  } else if (seedValue !== undefined) {
    verdict = "seed-only";
  } else if (state === "not-found") {
    verdict = "both-missing";
  } else {
    // never-ingested or ingest-failed, and no seed value either.
    verdict = "unavailable";
  }

  return {
    attribute: key,
    rankingField: (RANKING_FACTUAL_ATTRIBUTES as readonly string[]).includes(key),
    seedValue,
    officialState: state,
    officialValue: value,
    method: prov?.method,
    sourceUrl: prov?.sourceUrl,
    sourceText: prov?.sourceText,
    confidence: prov?.confidence,
    fingerprint: prov?.fingerprint,
    verdict,
  };
}

async function rowFor(source: ApprovedEntitySource, store: SnapshotStore, now: Date): Promise<EntityAuditRow> {
  const entity = seedEntity(source.entityId, now);
  const latest = await store.latest(source.entityId);
  const latestValid = await store.latestValid(source.entityId);
  const merge = entity ? mergeOfficialEvidence(entity, latestValid, { now }) : null;
  const category = getCategory(source.categoryId);

  const missing = entity
    ? RANKING_FACTUAL_ATTRIBUTES.filter((k) => officialStateFor(latestValid, k).state !== "value")
    : [...RANKING_FACTUAL_ATTRIBUTES];

  const lastOutcome: LastOutcome = !latest ? "never" : !latest.ok ? "failed" : "created";
  const readiness = merge
    ? assessReadiness({ source, latest, latestValid, merge }).verdict
    : "not-ingested";

  return {
    entityId: source.entityId,
    canonicalName: source.canonicalName,
    categoryId: source.categoryId,
    categoryName: category?.name ?? source.categoryId,
    enabled: source.enabled,
    pilot: !!source.pilot,
    sourceUrls: resolveApprovedUrls(source),
    robotsStatus: robotsStatusFor(latest),
    evidenceMode: merge?.evidenceMode ?? "seeded",
    lastIngestAt: latest?.retrievedAt ?? null,
    lastSuccessAt: latestValid?.retrievedAt ?? null,
    lastOutcome,
    freshness: latestValid?.freshnessStatus ?? "none",
    hasConflicts: (merge?.conflicts.length ?? 0) > 0,
    missingFactualFields: missing,
    failed: !!latest && !latest.ok,
    extractionConfidence: latestValid?.confidence ?? null,
    readiness,
  };
}

export async function buildAuditRows(store: SnapshotStore, now: Date = new Date()): Promise<EntityAuditRow[]> {
  const rows = await Promise.all(listApprovedSources(true).map((s) => rowFor(s, store, now)));
  return rows.sort((a, b) => a.categoryName.localeCompare(b.categoryName) || a.canonicalName.localeCompare(b.canonicalName));
}

export async function buildEntityAudit(
  entityId: string,
  store: SnapshotStore,
  now: Date = new Date()
): Promise<EntityAuditDetail | null> {
  const source = getApprovedSource(entityId) ?? null;
  const entity = seedEntity(entityId, now);
  if (!source && !entity) return null;

  const latest = await store.latest(entityId);
  const latestValid = await store.latestValid(entityId);
  const history = await store.history(entityId, 20);
  const row = source ? await rowFor(source, store, now) : null;

  // Compare the union of ranking factual attrs + any attrs either side asserts.
  const keys = new Set<string>([...RANKING_FACTUAL_ATTRIBUTES]);
  if (entity) for (const k of Object.keys(entity.attributes)) keys.add(k);
  if (latestValid) for (const k of Object.keys(latestValid.attributes)) keys.add(k);

  const comparisons = entity
    ? [...keys].sort().map((k) => compareAttribute(entity, latestValid, k))
    : [];

  const merge = entity ? mergeOfficialEvidence(entity, latestValid, { now }) : null;
  const readiness: ReadinessResult = merge
    ? assessReadiness({ source, latest, latestValid, merge })
    : { verdict: "not-ingested", reasons: ["No seed entity found."], promotable: false };

  const fallbackRow: EntityAuditRow = {
    entityId,
    canonicalName: entity?.canonicalName ?? entityId,
    categoryId: entity?.categoryId ?? "unknown",
    categoryName: getCategory(entity?.categoryId ?? "")?.name ?? "Unknown",
    enabled: false,
    pilot: false,
    sourceUrls: source ? resolveApprovedUrls(source) : [],
    robotsStatus: robotsStatusFor(latest),
    evidenceMode: merge?.evidenceMode ?? "seeded",
    lastIngestAt: latest?.retrievedAt ?? null,
    lastSuccessAt: latestValid?.retrievedAt ?? null,
    lastOutcome: !latest ? "never" : !latest.ok ? "failed" : "created",
    freshness: latestValid?.freshnessStatus ?? "none",
    hasConflicts: (merge?.conflicts.length ?? 0) > 0,
    missingFactualFields: [...RANKING_FACTUAL_ATTRIBUTES],
    failed: !!latest && !latest.ok,
    extractionConfidence: latestValid?.confidence ?? null,
    readiness: readiness.verdict,
  };

  return {
    row: row ?? fallbackRow,
    source,
    latest,
    latestValid,
    history,
    comparisons,
    conflicts: merge?.conflicts ?? [],
    rankingFieldsAffected: merge?.rankingFieldsAffected ?? [],
    rankingFieldsNotAffected: merge?.rankingFieldsSeeded ?? [...RANKING_FACTUAL_ATTRIBUTES],
    warnings: merge?.warnings ?? [],
    readiness,
    robotsStatus: robotsStatusFor(latest),
  };
}
