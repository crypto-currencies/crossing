/**
 * Seed safety (SEC-003).
 *
 * These tests import only the pure guards from `prisma/seed-guards.ts`, which
 * is deliberately separate from `seed.ts` so nothing instantiates a Prisma
 * client. No database is touched.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertSeedAllowed, resolveDemoPassword, SeedRefusedError } from "./seed-guards";

const SEED_PATH = new URL("./seed.ts", import.meta.url);

// ─── Production guard ────────────────────────────────────────────────────────

test("seed — refuses to run in production without an override", () => {
  assert.throws(
    () => assertSeedAllowed({ NODE_ENV: "production" } as NodeJS.ProcessEnv),
    SeedRefusedError
  );
});

test("seed — the refusal explains how to override deliberately", () => {
  try {
    assertSeedAllowed({ NODE_ENV: "production" } as NodeJS.ProcessEnv);
    assert.fail("expected a refusal");
  } catch (err) {
    assert.ok(err instanceof SeedRefusedError);
    assert.match(err.message, /SEED_ALLOW_PROD=true/);
    assert.match(err.message, /production/i);
  }
});

test("seed — a near-miss override value does not unlock production", () => {
  for (const value of ["1", "yes", "TRUE", "True", " true", ""]) {
    assert.throws(
      () =>
        assertSeedAllowed({
          NODE_ENV: "production",
          SEED_ALLOW_PROD: value,
        } as NodeJS.ProcessEnv),
      SeedRefusedError,
      `"${value}" must not be accepted as an override`
    );
  }
});

test("seed — an explicit override is honored and warns loudly", () => {
  const original = console.warn;
  const warnings: string[] = [];
  console.warn = (msg?: unknown) => { warnings.push(String(msg)); };

  try {
    assert.doesNotThrow(() =>
      assertSeedAllowed({
        NODE_ENV: "production",
        SEED_ALLOW_PROD: "true",
      } as NodeJS.ProcessEnv)
    );
  } finally {
    console.warn = original;
  }

  assert.equal(warnings.length, 1, "the override must produce exactly one warning");
  assert.match(warnings[0], /WARNING/);
  assert.match(warnings[0], /PRODUCTION/i);
});

test("seed — development and test environments run without friction", () => {
  for (const env of ["development", "test", undefined]) {
    assert.doesNotThrow(() => assertSeedAllowed({ NODE_ENV: env } as NodeJS.ProcessEnv));
  }
});

// ─── Credentials ─────────────────────────────────────────────────────────────

test("seed — a demo password is generated when none is supplied", () => {
  const a = resolveDemoPassword({} as NodeJS.ProcessEnv);
  const b = resolveDemoPassword({} as NodeJS.ProcessEnv);

  assert.equal(a.generated, true);
  assert.notEqual(a.password, b.password, "each run must mint a distinct password");
  assert.ok(a.password.length >= 20, "generated passwords must not be trivially short");
});

test("seed — SEED_DEMO_PASSWORD pins a known local value", () => {
  const result = resolveDemoPassword({ NODE_ENV: "test", SEED_DEMO_PASSWORD: "local-dev-pw" } as NodeJS.ProcessEnv);
  assert.equal(result.password, "local-dev-pw");
  assert.equal(result.generated, false);
});

test("seed — a blank SEED_DEMO_PASSWORD falls back to generation", () => {
  const result = resolveDemoPassword({ NODE_ENV: "test", SEED_DEMO_PASSWORD: "   " } as NodeJS.ProcessEnv);
  assert.equal(result.generated, true);
});

// ─── Source-level guarantees ─────────────────────────────────────────────────

test("seed — no static plaintext password remains in source", async () => {
  const src = await readFile(SEED_PATH, "utf8");

  // A literal `password: "..."` assignment is exactly the pattern SEC-003 flagged.
  assert.ok(
    !/\bpassword:\s*["'][^"']+["']/.test(src),
    "seed.ts must not contain a hardcoded password literal"
  );
});

test("seed — the generated password is never printed to stdout", async () => {
  const src = await readFile(SEED_PATH, "utf8");
  const logLines = src.split("\n").filter((l) => /console\.log/.test(l));

  for (const line of logLines) {
    assert.ok(
      !/\$\{\s*demo\.password\s*\}/.test(line) && !/\$\{[^}]*\.password\s*\}/.test(line),
      `a password must never reach stdout — offending line: ${line.trim()}`
    );
  }
});

test("seed — demo credentials are written to a gitignored file", async () => {
  const src = await readFile(SEED_PATH, "utf8");
  const guards = await readFile(new URL("./seed-guards.ts", import.meta.url), "utf8");

  // seed.ts writes to the constant; seed-guards.ts owns its value.
  assert.match(src, /writeFile\(\s*DEMO_CREDENTIALS_FILE/, "credentials must go to a file");
  assert.match(guards, /DEMO_CREDENTIALS_FILE\s*=\s*"\.seed-credentials"/);

  const gitignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
  assert.ok(
    gitignore.split("\n").some((l) => l.trim() === ".seed-credentials"),
    ".seed-credentials must be gitignored"
  );
});

test("seed — demo accounts are pinned to the USER role", async () => {
  const src = await readFile(SEED_PATH, "utf8");
  const userUpserts = src.split("db.user.upsert").slice(1);

  assert.equal(userUpserts.length, 2, "expected exactly two seed accounts");
  for (const block of userUpserts) {
    const scope = block.slice(0, block.indexOf("});"));
    assert.match(scope, /role:\s*"USER"/, "seed accounts must be explicitly USER");
    assert.ok(
      !/role:\s*"(ADMIN|OWNER|MODERATOR)"/.test(scope),
      "a seed account must never be created with a privileged role"
    );
  }
});

test("seed — fabricated engagement counts are explicitly labelled as fixtures", async () => {
  const src = await readFile(SEED_PATH, "utf8");

  assert.match(src, /FIXTURE ENGAGEMENT DATA/, "the invented counts must carry a clear warning");
  assert.match(src, /type FixtureCount/, "fixture counts should be typed as such");
  assert.match(
    src,
    /votes:\s*FixtureCount/,
    "votes/saves/views must be declared as fixture data, not plain numbers"
  );
});

test("seed — main() invokes the production guard before any write", async () => {
  const src = await readFile(SEED_PATH, "utf8");
  const main = src.slice(src.indexOf("async function main()"));

  const guard = main.indexOf("assertSeedAllowed()");
  const firstWrite = main.indexOf("db.user.upsert");

  assert.ok(guard !== -1, "main() must call the guard");
  assert.ok(guard < firstWrite, "the guard must run before the first database write");
});
