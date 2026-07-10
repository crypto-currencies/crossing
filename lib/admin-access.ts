/**
 * Shared helpers for admin role-grant confirmation phrases.
 *
 * SINGLE SOURCE OF TRUTH — imported by both:
 *   • components/admin/access-tab.tsx  (UI display + frontend validation)
 *   • app/api/admin/access/users/[id]/role/route.ts  (backend validation)
 *
 * Comparison must be done with normalizePhrase() on BOTH sides so that
 * leading/trailing whitespace and letter-case never cause false mismatches.
 * The @username segment intentionally preserves original case in the display
 * string; normalisation lowercases it for comparison only.
 */

export type RoleChangeAction = "grant" | "revoke";
export type RoleChangeRole   = "ADMIN" | "MODERATOR" | "USER";

/**
 * Build the human-readable confirmation phrase shown to the admin and
 * submitted to the API.
 *
 * Examples:
 *   grant  ADMIN     → "GRANT ADMIN TO @alice"
 *   revoke ADMIN     → "REVOKE ADMIN FROM @alice"
 *   revoke USER      → "REVOKE ACCESS FROM @alice"   (revoking back to USER)
 */
export function getRoleChangePhrase(
  action:   RoleChangeAction,
  role:     RoleChangeRole,
  username: string | null,
): string {
  const handle = `@${username ?? "unknown"}`;
  if (role === "USER") {
    return `REVOKE ACCESS FROM ${handle}`;
  }
  return action === "grant"
    ? `GRANT ${role} TO ${handle}`
    : `REVOKE ${role} FROM ${handle}`;
}

/**
 * Normalize a phrase for comparison: trim surrounding whitespace, collapse
 * any run of internal whitespace to a single space, and lowercase everything.
 *
 * Use this on BOTH the submitted phrase and the expected phrase before
 * comparing — never compare the raw strings directly.
 */
export function normalizePhrase(phrase: string): string {
  return phrase.trim().replace(/\s+/g, " ").toLowerCase();
}
