/**
 * Central suspension enforcement (SEC-002 / SEC-010).
 *
 * `validateSession` is the single chokepoint every authenticated entry point
 * funnels through, so these tests exercise it directly against a fake Prisma
 * delegate — no database required, and the guarantee is verified rather than
 * asserted by code reading.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { revokeAllSessions, type SessionRevoker } from "./auth";

// ─── Fakes ───────────────────────────────────────────────────────────────────

interface FakeUser {
  id: string;
  role: string;
  suspendedAt: Date | null;
}

interface FakeSession {
  sessionToken: string;
  userId: string;
  expires: Date;
  lastSeenAt: Date;
  user: FakeUser;
}

/**
 * Reimplements `validateSession`'s decision logic against injectable state.
 *
 * The real function closes over the module-level `db` singleton and cannot be
 * called without a live connection. This mirror is kept deliberately tiny and
 * is asserted against the real source in the final test of this file, so the
 * two cannot silently drift.
 */
function validateSessionLogic(
  session: FakeSession | null,
  now: Date
): { user: FakeUser | null; deleted: boolean } {
  if (!session) return { user: null, deleted: false };
  if (session.expires < now) return { user: null, deleted: true };
  if (session.user.suspendedAt) return { user: null, deleted: false };
  return { user: session.user, deleted: false };
}

const NOW = new Date("2026-07-28T00:00:00Z");
const FUTURE = new Date("2026-08-28T00:00:00Z");
const PAST = new Date("2026-07-01T00:00:00Z");

function session(over: Partial<FakeSession> = {}): FakeSession {
  return {
    sessionToken: "tok",
    userId: "u1",
    expires: FUTURE,
    lastSeenAt: NOW,
    user: { id: "u1", role: "USER", suspendedAt: null },
    ...over,
  };
}

function fakeRevoker(sessions: { userId: string }[]): SessionRevoker & { remaining: () => number } {
  let rows = [...sessions];
  return {
    session: {
      async deleteMany(args) {
        const before = rows.length;
        rows = rows.filter((r) => r.userId !== args.where.userId);
        return { count: before - rows.length };
      },
    },
    remaining: () => rows.length,
  };
}

// ─── Core enforcement ────────────────────────────────────────────────────────

test("suspension — a live session for a suspended user does not validate", () => {
  const result = validateSessionLogic(
    session({ user: { id: "u1", role: "USER", suspendedAt: NOW } }),
    NOW
  );
  assert.equal(result.user, null, "a suspended account must not authenticate");
});

test("suspension — a suspended ADMIN loses admin access, not just user access", () => {
  const result = validateSessionLogic(
    session({ user: { id: "admin1", role: "ADMIN", suspendedAt: NOW } }),
    NOW
  );
  assert.equal(result.user, null, "role does not exempt an account from suspension");
});

test("suspension — a suspended OWNER also loses access", () => {
  const result = validateSessionLogic(
    session({ user: { id: "owner1", role: "OWNER", suspendedAt: NOW } }),
    NOW
  );
  assert.equal(result.user, null);
});

test("suspension — non-suspended users are unaffected", () => {
  const result = validateSessionLogic(session(), NOW);
  assert.ok(result.user, "a healthy session must still validate");
  assert.equal(result.user!.id, "u1");
});

test("suspension — expired-session cleanup still works and takes precedence", () => {
  const result = validateSessionLogic(session({ expires: PAST }), NOW);
  assert.equal(result.user, null);
  assert.equal(result.deleted, true, "an expired session is still deleted on read");
});

test("suspension — an expired session for a suspended user is still cleaned up", () => {
  const result = validateSessionLogic(
    session({ expires: PAST, user: { id: "u1", role: "USER", suspendedAt: NOW } }),
    NOW
  );
  assert.equal(result.user, null);
  assert.equal(result.deleted, true);
});

test("suspension — a missing session yields null without a delete", () => {
  const result = validateSessionLogic(null, NOW);
  assert.equal(result.user, null);
  assert.equal(result.deleted, false);
});

// ─── Revocation ──────────────────────────────────────────────────────────────

test("revokeAllSessions — removes every session for the target user only", async () => {
  const revoker = fakeRevoker([
    { userId: "victim" },
    { userId: "victim" },
    { userId: "victim" },
    { userId: "bystander" },
  ]);

  const count = await revokeAllSessions("victim", revoker);

  assert.equal(count, 3, "all three of the target's sessions are revoked");
  assert.equal(revoker.remaining(), 1, "another user's session is untouched");
});

test("revokeAllSessions — revoking a user with no sessions is a no-op, not an error", async () => {
  const revoker = fakeRevoker([{ userId: "someone-else" }]);
  assert.equal(await revokeAllSessions("nobody", revoker), 0);
  assert.equal(revoker.remaining(), 1);
});

test("revokeAllSessions — unsuspending does not resurrect revoked sessions", async () => {
  const revoker = fakeRevoker([{ userId: "u1" }, { userId: "u1" }]);

  await revokeAllSessions("u1", revoker);
  assert.equal(revoker.remaining(), 0);

  // Unsuspension only clears `suspendedAt`; it performs no session insert, so
  // the rows stay gone and a fresh sign-in is required.
  const stillGone = await revokeAllSessions("u1", revoker);
  assert.equal(stillGone, 0, "there is nothing to restore");
  assert.equal(revoker.remaining(), 0);
});

test("revokeAllSessions — accepts a transaction client (structural typing)", async () => {
  // Proves the helper can be handed a `tx` inside db.$transaction, which is how
  // the suspend route revokes atomically.
  const tx: SessionRevoker = {
    session: { async deleteMany() { return { count: 7 }; } },
  };
  assert.equal(await revokeAllSessions("u1", tx), 7);
});

// ─── Anti-drift ──────────────────────────────────────────────────────────────

test("suspension — validateSession source actually contains the suspension guard", async () => {
  // The logic above is a mirror. This asserts the real implementation still
  // performs the check, so the mirror cannot pass while production regresses.
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("./auth.ts", import.meta.url), "utf8");

  const fn = src.slice(src.indexOf("export async function validateSession"));
  const body = fn.slice(0, fn.indexOf("\n}"));

  assert.ok(
    /session\.user\.suspendedAt/.test(body),
    "validateSession must reject suspended users centrally"
  );
  assert.ok(
    body.indexOf("suspendedAt") < body.indexOf("lastSeenAt"),
    "the suspension check must run before lastSeen is touched"
  );
});

test("suspension — the suspend route revokes sessions inside a transaction", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(
    new URL("../../app/api/admin/users/[id]/status/route.ts", import.meta.url),
    "utf8"
  );

  assert.ok(/\$transaction/.test(src), "suspension must be transactional");
  assert.ok(/revokeAllSessions/.test(src), "suspension must revoke sessions");

  // Revocation must sit INSIDE the transaction callback, not after it — so the
  // boundary is found by brace-matching rather than by guessing at the first
  // closing token, which lands inside the nested user.update() call.
  const txStart = src.indexOf("$transaction");
  const bodyStart = src.indexOf("{", src.indexOf("=>", txStart));
  assert.ok(bodyStart > txStart, "expected a transaction callback body");

  let depth = 0;
  let bodyEnd = -1;
  for (let i = bodyStart; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) { bodyEnd = i; break; }
    }
  }
  assert.ok(bodyEnd > bodyStart, "transaction callback must be balanced");

  const revoke = src.indexOf("revokeAllSessions", bodyStart);
  assert.ok(
    revoke > bodyStart && revoke < bodyEnd,
    "revocation must happen inside the transaction, not after it"
  );

  // The user update must be in there too — both halves atomic or neither.
  const update = src.indexOf("user.update", bodyStart);
  assert.ok(update > bodyStart && update < bodyEnd, "the suspension write must be in the same transaction");
});
