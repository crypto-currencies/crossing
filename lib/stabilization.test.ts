/**
 * Regression tests for the stabilization sprint.
 *
 * These lock in the *integrity* fixes: no blank routes, no post-login dead end,
 * no unsupported search suggestions, no destructive migration, and a graceful
 * admin state when evidence storage is unmigrated.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_REDIRECT, DEFAULT_REDIRECT_NEW_USER } from "./routes";
import { classifyStoreError, isMissingTableError } from "@/features/ingestion/store-health";
import { resolveCategory } from "@/features/recommendation/categories/resolve";
import { DISCOVERY_SUGGESTIONS, QUICK_SEARCHES } from "@/components/home/crossing-home-data";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

// ─── Post-login destination ──────────────────────────────────────────────────

test("auth — login never sends users to the empty /dashboard", () => {
  assert.notEqual(DEFAULT_REDIRECT, "/dashboard");
  assert.notEqual(DEFAULT_REDIRECT_NEW_USER, "/dashboard");
  assert.equal(DEFAULT_REDIRECT, "/");
});

test("nav — /dashboard redirects instead of rendering blank", () => {
  const src = read("app/(dashboard)/dashboard/page.tsx");
  assert.match(src, /redirect\(/);
  assert.doesNotMatch(src, /return null;?\s*}/);
});

test("nav — bare /search redirects to the homepage search, but a query still renders", () => {
  const src = read("app/(root)/search/page.tsx");
  assert.match(src, /if \(!initialQuery\.trim\(\)\)/);
  assert.match(src, /redirect\("\/#search"\)/);
  // The results component must still render for a real query (no blanket redirect
  // — the homepage submits to /search?q=…, which would otherwise loop).
  assert.match(src, /<SearchExperience initialQuery=\{initialQuery\} \/>/);
});

// ─── No blank pages ──────────────────────────────────────────────────────────

test("nav — no route renders a bare `return null` blank page", () => {
  const pages: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (entry.name === "page.tsx") pages.push(rel);
    }
  };
  walk("app");
  assert.ok(pages.length > 15, "expected to find the app's pages");

  const blank = pages.filter((p) => /return null;?\s*}/.test(read(p)));
  assert.deepEqual(blank, [], `these routes still render blank: ${blank.join(", ")}`);
});

// ─── Homepage suggestions must be answerable ─────────────────────────────────

test("homepage — every suggested search resolves to a supported category", () => {
  assert.ok(DISCOVERY_SUGGESTIONS.length > 0);
  for (const s of DISCOVERY_SUGGESTIONS) {
    const res = resolveCategory(s.query);
    assert.equal(
      res.status,
      "supported",
      `suggestion "${s.query}" resolves as ${res.status} (${res.domain}) — it would dead-end`
    );
  }
});

test("homepage — quick searches are supported too, and no local-business queries remain", () => {
  for (const q of QUICK_SEARCHES) {
    assert.equal(resolveCategory(q).status, "supported", `quick search "${q}" is unsupported`);
  }
  const all = [...DISCOVERY_SUGGESTIONS.map((s) => s.query), ...QUICK_SEARCHES].join(" ").toLowerCase();
  for (const banned of ["coffee shop", "near me", "house cleaner", "therapist", "late-night"]) {
    assert.ok(!all.includes(banned), `unsupported local query still suggested: "${banned}"`);
  }
});

// ─── Homepage search UI regressions ──────────────────────────────────────────

test("homepage — hero no longer clips the suggestions dropdown", () => {
  const css = read("app/globals.css");
  const hero = css.slice(css.indexOf(".crossing-hero {"), css.indexOf(".crossing-hero-bg {"));
  assert.doesNotMatch(hero, /overflow:\s*hidden/, ".crossing-hero must not clip its overflow");
  // Decorations are clipped by a dedicated layer instead.
  // `[^}]*` already spans newlines, so no dotAll flag is needed.
  assert.match(css, /\.crossing-hero-bg \{[^}]*overflow:\s*hidden/);

  // The hero must also outrank its sibling sections, or section 2 paints over the
  // overhang. `.crossing-home > section` is (0,1,1) and beats a bare
  // `.crossing-hero` (0,1,0), so this rule MUST stay qualified to win.
  assert.match(css, /\.crossing-home > section\.crossing-hero \{[^}]*z-index:\s*2/);
});

test("homepage — search input has no inner focus-visible box", () => {
  const css = read("app/globals.css");
  assert.doesNotMatch(css, /\.crossing-search input:focus-visible/);
  // Focus is still indicated on the container (accessibility preserved).
  assert.match(css, /\.crossing-search:focus-within/);
});

test("homepage — no fake Save/Saved confirmation remains", () => {
  const home = read("components/home/crossing-home.tsx");
  const demo = read("components/home/crossing-product-demo.tsx");
  for (const [name, src] of [["crossing-home", home], ["crossing-product-demo", demo]] as const) {
    assert.doesNotMatch(src, /"Saved"/, `${name} still renders a fake Saved state`);
    assert.doesNotMatch(src, /savedIds/, `${name} still has save plumbing`);
  }
});

// ─── Prisma / admin evidence ─────────────────────────────────────────────────

test("prisma — the EvidenceSnapshot migration exists and is non-destructive", () => {
  const dir = "prisma/migrations/20260724000000_add_evidence_snapshot";
  assert.ok(existsSync(join(ROOT, dir)), "migration folder missing");
  const sql = read(`${dir}/migration.sql`);
  assert.match(sql, /CREATE TABLE "EvidenceSnapshot"/);
  assert.match(sql, /CREATE UNIQUE INDEX "EvidenceSnapshot_entityId_contentFingerprint_key"/);
  // Must never drop or truncate anything.
  for (const destructive of [/DROP TABLE/i, /DROP DATABASE/i, /TRUNCATE/i, /DROP SCHEMA/i]) {
    assert.doesNotMatch(sql, destructive, "migration contains a destructive statement");
  }
});

test("admin — a missing evidence table is classified, not crashed on", () => {
  const prismaErr = Object.assign(new Error("The table `public.EvidenceSnapshot` does not exist in the current database."), { code: "P2021" });
  assert.equal(isMissingTableError(prismaErr), true);

  const problem = classifyStoreError(prismaErr);
  assert.ok(problem);
  assert.equal(problem!.kind, "missing_table");
  assert.match(problem!.remedy, /migrate deploy/);

  // An unrelated error is NOT swallowed — the page rethrows it.
  assert.equal(classifyStoreError(new Error("something else entirely")), null);
});

// ─── Navigation shell ────────────────────────────────────────────────────────

test("nav — the dashboard/admin shell renders a topbar", () => {
  const layout = read("app/(dashboard)/layout.tsx");
  assert.match(layout, /<Nav \/>/, "dashboard pages must have a topbar");
});

test("nav — the topbar reflects auth state and offers logout", () => {
  const nav = read("components/layout/nav.tsx");
  assert.match(nav, /useAuthStore/);
  assert.match(nav, /isAuthenticated/);
  assert.match(nav, /Log out/);
});

test("nav — there is exactly one Nav per shell (no duplicate topbars)", () => {
  for (const layout of ["app/(root)/layout.tsx", "app/(dashboard)/layout.tsx"]) {
    const matches = read(layout).match(/<Nav \/>/g) ?? [];
    assert.equal(matches.length, 1, `${layout} should render exactly one Nav`);
  }
  // The auth shell intentionally has none (it is a focused, centered layout).
  assert.doesNotMatch(read("app/(auth)/layout.tsx"), /<Nav \/>/);
});

// ─── Session recovery ────────────────────────────────────────────────────────

test("auth — Providers recovers a server session from the cookie", () => {
  const src = read("components/providers/providers.tsx");
  assert.match(src, /\/api\/auth\/session/, "must verify the session against the server");
  assert.match(src, /signOut\(\)/, "must clear stale state on 401");
});

// ─── Legal ───────────────────────────────────────────────────────────────────

test("legal — legal pages carry a visible draft warning", () => {
  assert.match(read("components/legal/legal-layout.tsx"), /Draft — not legally reviewed/);
});
