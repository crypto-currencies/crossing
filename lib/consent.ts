// ── Cookie Consent ────────────────────────────────────────────────────────────
// Consent is stored in localStorage under CONSENT_KEY as a JSON record.
//
// HOW TO UPDATE THE CONSENT VERSION:
//   1. Increment CONSENT_VERSION below.
//   2. Add an entry to CONSENT_CHANGELOG.
//   3. Deploy. All users with a prior version number will see the banner again
//      and must re-consent before the new version is recorded.
//
// The required categories (authentication, security, session management) are
// always active and are NOT part of the consent record — they cannot be
// disabled and need no user acknowledgement beyond the banner itself.

export const CONSENT_VERSION = 1;
export const CONSENT_KEY = "ex_cookie_consent";

export const CONSENT_CHANGELOG: Record<number, string> = {
  1: "Initial cookie consent policy.",
};

export interface ConsentRecord {
  v: number;            // policy version at time of consent
  ts: string;           // ISO timestamp of when consent was given/updated
  analytics: boolean;
  performance: boolean;
  preferences: boolean;
}

export type OptionalCategory = "analytics" | "performance" | "preferences";

// ─── Read ─────────────────────────────────────────────────────────────────────

export function readConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.v !== "number") return null;
    return parsed as ConsentRecord;
  } catch {
    return null;
  }
}

/** Returns true only when a current-version consent record exists. */
export function hasValidConsent(): boolean {
  const c = readConsent();
  return c !== null && c.v >= CONSENT_VERSION;
}

// ─── Write ────────────────────────────────────────────────────────────────────

export function writeConsent(
  opts: Pick<ConsentRecord, "analytics" | "performance" | "preferences">
): ConsentRecord {
  const record: ConsentRecord = {
    v: CONSENT_VERSION,
    ts: new Date().toISOString(),
    analytics: opts.analytics,
    performance: opts.performance,
    preferences: opts.preferences,
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
  return record;
}

export function acceptAll(): ConsentRecord {
  return writeConsent({ analytics: true, performance: true, preferences: true });
}

export function acceptNecessaryOnly(): ConsentRecord {
  return writeConsent({ analytics: false, performance: false, preferences: false });
}

export function clearConsent(): void {
  if (typeof window !== "undefined") localStorage.removeItem(CONSENT_KEY);
}
