/**
 * Evidence-mode visibility (Part 12).
 *
 * Dev/admin surfaces (the audit tool, recommendation diagnostics) may show the
 * precise mode. Public UI must stay honest and jargon-free, and must never claim
 * results are fully live when they are mixed. The existing prototype/live guard
 * (features/recommendation/data-mode.ts) is unchanged; these helpers only supply
 * wording and are used ONLY when official evidence is actually merged (which is
 * gated by config + readiness and off by default).
 */

import type { EvidenceMode } from "./types";
import type { ReadinessVerdict } from "./readiness";

/** Detailed mode for dev/admin displays (jargon is acceptable here). */
export type DetailedEvidenceMode =
  | "seeded"
  | "official"
  | "mixed"
  | "stale-official"
  | "official-blocked"
  | "ingestion-failed";

export function detailedModeFromReadiness(mode: EvidenceMode, verdict: ReadinessVerdict): DetailedEvidenceMode {
  if (verdict === "stale") return "stale-official";
  if (verdict === "blocked-by-conflict") return "official-blocked";
  if (verdict === "ingestion-failed") return "ingestion-failed";
  if (mode === "live") return "official";
  if (mode === "mixed") return "mixed";
  return "seeded";
}

export function devEvidenceModeLabel(mode: DetailedEvidenceMode): string {
  switch (mode) {
    case "official": return "Official (live factual evidence)";
    case "mixed": return "Mixed (official + seeded)";
    case "stale-official": return "Stale official evidence";
    case "official-blocked": return "Official blocked (conflict)";
    case "ingestion-failed": return "Ingestion failed";
    case "seeded": default: return "Seeded (prototype data)";
  }
}

/**
 * Honest public wording. Returns null for a fully-seeded result — the existing
 * prototype banner already covers that case. Never claims "all live".
 */
export function publicEvidenceNote(mode: EvidenceMode): string | null {
  if (mode === "live") return "Pricing and platform information checked from official sources.";
  if (mode === "mixed")
    return "Pricing and platform information checked from official sources. Some product details still use prototype data.";
  return null;
}
