/**
 * Cautious pricing normalization.
 *
 * Turns extracted price signals into a normalized model WITHOUT guessing. A
 * monthly price is only asserted when the evidence is explicit (a schema.org
 * monthly offer, or "$X/mo" / "$X per month" copy). Ambiguous "$X" copy never
 * becomes a monthly price. Currencies are NOT converted. When nothing can be
 * defended, the model is `unknown` and the supporting evidence is preserved.
 */

import type { ExtractedEvidence } from "./extract";

export type PricingKind =
  | "free"
  | "freemium"
  | "free_trial"
  | "fixed_monthly"
  | "per_user_monthly"
  | "annual"
  | "usage_based"
  | "contact_sales"
  | "unknown";

export interface PricingModel {
  kind: PricingKind;
  /** Defensible minimum MONTHLY price, or null when not confidently known. */
  minMonthly: number | null;
  currency: string | null;
  hasFreePlan: boolean | null;
  hasFreeTrial: boolean | null;
  /** 0..1 confidence in the normalization. */
  confidence: number;
  /** Raw supporting text kept for provenance/audit. */
  supportingText: string[];
}

const MONTHLY_RE = /(?:[$£€]|usd|eur|gbp)\s?(\d+(?:\.\d{1,2})?)\s*(?:\/|per\s+)\s*(?:mo|month)\b/i;
const ANNUAL_RE = /(?:[$£€]|usd|eur|gbp)\s?(\d+(?:\.\d{1,2})?)\s*(?:\/|per\s+)\s*(?:yr|year|annually|annum)\b/i;
const CONTACT_RE = /\b(contact (?:us|sales)|talk to sales|get a quote|custom pricing|enterprise pricing)\b/i;
const USAGE_RE = /\b(usage[-\s]?based|pay[-\s]?as[-\s]?you[-\s]?go|per (?:request|gb|seat-hour|api call)|metered)\b/i;
const PERUSER_RE = /\b(per (?:user|seat)|\/user|\/seat|per member)\b/i;

function detectCurrency(s: string): string | null {
  if (/\$|usd/i.test(s)) return "USD";
  if (/£|gbp/i.test(s)) return "GBP";
  if (/€|eur/i.test(s)) return "EUR";
  return null;
}

export function normalizePricing(ev: ExtractedEvidence): PricingModel {
  const supporting: string[] = [];
  const push = (t?: string | null) => {
    if (t && !supporting.includes(t)) supporting.push(t);
  };

  const hasFreePlan = ev.hasFreePlan?.value ?? null;
  const hasFreeTrial = ev.hasFreeTrial?.value ?? null;
  if (ev.hasFreePlan) push(ev.hasFreePlan.sourceText);
  if (ev.hasFreeTrial) push(ev.hasFreeTrial.sourceText);

  // 1. Structured JSON-LD monthly offers are the strongest signal.
  let structuredMonthly: number | null = null;
  let currency: string | null = null;
  const monthlyPeriod = new Set(["month", "p1m", "monthly"]);
  const billing = ev.billingPeriods?.value ?? [];
  const jsonMonthly = ev.priceStatements.filter(
    (p) => p.method === "json-ld" && p.amount != null && p.amount > 0 && billing.some((b) => monthlyPeriod.has(b))
  );
  for (const p of jsonMonthly) {
    structuredMonthly = structuredMonthly == null ? p.amount! : Math.min(structuredMonthly, p.amount!);
    currency = currency ?? p.currency;
    push(p.text);
  }

  // 2. Explicit "$X/mo" copy (from any statement text or the description).
  const textPool = [
    ...ev.priceStatements.map((p) => p.text),
    ev.description?.sourceText ?? "",
    ev.title?.sourceText ?? "",
  ].join("  •  ");

  let copyMonthly: number | null = null;
  const mm = textPool.match(MONTHLY_RE);
  if (mm) {
    copyMonthly = Number(mm[1]);
    currency = currency ?? detectCurrency(mm[0]);
    push(mm[0]);
  }

  // Per-user/seat pricing: "$9 per user/month", "$9/seat", "$9 per member" — the
  // amount is a monthly per-seat price. Captured separately since the monthly
  // regex above requires the period to immediately follow the amount.
  let perUserMonthly: number | null = null;
  const pu = textPool.match(/(?:[$£€])\s?(\d+(?:\.\d{1,2})?)\s*(?:\/\s*|per\s+)(?:user|seat|member)\b/i);
  if (pu) {
    perUserMonthly = Number(pu[1]);
    currency = currency ?? detectCurrency(pu[0]);
    push(pu[0]);
  }
  const am = textPool.match(ANNUAL_RE);
  const annualAmount = am ? Number(am[1]) : null;
  if (am) push(am[0]);

  const minMonthly = structuredMonthly ?? copyMonthly ?? perUserMonthly;
  const isContact = CONTACT_RE.test(textPool);
  const isUsage = USAGE_RE.test(textPool);
  const isPerUser = PERUSER_RE.test(textPool) || perUserMonthly != null;
  if (isContact) push(textPool.match(CONTACT_RE)?.[0] ?? "");
  if (isUsage) push(textPool.match(USAGE_RE)?.[0] ?? "");

  // ── Decide the model, most-confident first ──
  let kind: PricingKind = "unknown";
  let confidence = 0.3;

  if (minMonthly != null) {
    if (hasFreePlan) {
      kind = "freemium";
    } else if (isPerUser) {
      kind = "per_user_monthly";
    } else {
      kind = "fixed_monthly";
    }
    confidence = structuredMonthly != null ? 0.85 : 0.65;
  } else if (isUsage) {
    kind = "usage_based";
    confidence = 0.6;
  } else if (isContact && !hasFreePlan) {
    kind = "contact_sales";
    confidence = 0.6;
  } else if (annualAmount != null && !hasFreePlan) {
    kind = "annual";
    confidence = 0.55;
  } else if (hasFreePlan) {
    kind = "free"; // free plan present, no defensible paid price found
    confidence = 0.6;
  } else if (hasFreeTrial) {
    kind = "free_trial";
    confidence = 0.5;
  }

  return {
    kind,
    minMonthly: minMonthly ?? null,
    currency: minMonthly != null ? currency ?? "USD" : null,
    hasFreePlan,
    hasFreeTrial,
    confidence,
    supportingText: supporting.filter(Boolean).slice(0, 6),
  };
}
