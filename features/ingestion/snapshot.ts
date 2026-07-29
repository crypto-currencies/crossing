/**
 * Versioned evidence snapshots.
 *
 * A snapshot is the immutable result of one adapter run for one entity. Snapshots
 * are append-only — a refresh writes a NEW snapshot, never mutating history. We
 * store hashes + constrained supporting excerpts, NOT full raw HTML.
 */

import { createHash } from "node:crypto";
import type { PricingModel } from "./pricing";
import type { ExtractionMethod } from "./extract";

export type FreshnessStatus = "fresh" | "aging" | "stale";

/** Per-attribute provenance — where a fact came from and how sure we are. */
export interface AttributeProvenance {
  attribute: string;
  value: string | number | boolean;
  method: ExtractionMethod;
  sourceUrl: string;
  /** Short, escaped-at-render supporting excerpt (never full HTML). */
  sourceText: string;
  confidence: number;
  /** Fingerprint of the supporting text (stable identity for a fact). */
  fingerprint: string;
}

export interface PageResult {
  url: string;
  ok: boolean;
  status?: number;
  bytes?: number;
  durationMs?: number;
  /** Fingerprint of the fetched body (content identity for dedup/debug). */
  contentFingerprint?: string;
  /** Present when the page failed. */
  error?: { kind: string; message: string; retryable: boolean };
}

export interface EvidenceSnapshot {
  id: string;
  entityId: string;
  adapterId: string;
  primarySourceUrl: string;
  retrievedAt: string;
  extractionVersion: string;
  /** True when at least one page was fetched + extracted successfully. */
  ok: boolean;

  http: { pagesFetched: number; pagesFailed: number; totalBytes: number; totalDurationMs: number };

  /** Fingerprint over the normalized attributes + pricing (drives dedup). */
  contentFingerprint: string;

  /** Normalized, engine-usable attributes (keys match category attribute keys). */
  attributes: Record<string, string | number | boolean>;
  pricing: PricingModel;
  provenance: AttributeProvenance[];

  /** 0..1 overall source confidence for this snapshot. */
  confidence: number;
  freshnessStatus: FreshnessStatus;

  pages: PageResult[];
  warnings: string[];
  /** Set when the whole run failed (no usable evidence). */
  error?: { kind: string; message: string } | null;
}

/** Freshness thresholds in days. */
export const FRESHNESS_THRESHOLDS = { freshDays: 30, agingDays: 90 };

export function computeFreshness(
  retrievedAt: string,
  now: Date = new Date(),
  thresholds = FRESHNESS_THRESHOLDS
): FreshnessStatus {
  const ageDays = (now.getTime() - new Date(retrievedAt).getTime()) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays < 0) return "fresh";
  if (ageDays <= thresholds.freshDays) return "fresh";
  if (ageDays <= thresholds.agingDays) return "aging";
  return "stale";
}

/** Deterministic JSON with sorted keys — stable input for fingerprinting. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function fingerprint(value: unknown): string {
  return sha256(stableStringify(value)).slice(0, 32);
}
