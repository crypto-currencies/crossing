/**
 * Slug generation shared by every domain that needs a URL-safe, unique
 * identifier derived from a human-entered name (categories, listings).
 */

/** Lowercase, hyphenated, alphanumeric-only slug base — not guaranteed unique. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

/**
 * Appends `-2`, `-3`, ... to `base` until `exists` returns false for the
 * candidate. `exists` is typically a DB lookup closure supplied by the caller
 * so this function stays DB-agnostic and unit-testable.
 */
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>
): Promise<string> {
  const root = base || "listing";
  let candidate = root;
  let n = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${n}`;
    n += 1;
  }
  return candidate;
}
