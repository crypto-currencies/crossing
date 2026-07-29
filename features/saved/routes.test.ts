/**
 * Route-contract tests for /api/saved/*.
 *
 * Hermetic: these call the exported route handlers directly with mock Requests.
 * They assert the guard ordering and the response envelope — specifically that a
 * failed request NEVER returns 200 and never leaks a raw database error.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { httpStatusFor, ERROR_CODES } from "@/lib/server/api-result";

const SAVED_URL = "http://localhost/api/saved";

async function readBody(res: Response): Promise<{ ok: boolean; error?: { code: string; message: string } }> {
  return (await res.json()) as { ok: boolean; error?: { code: string; message: string } };
}

function withFlag(value: string | undefined, fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    const prev = process.env.FEATURE_SAVED_ITEMS;
    if (value === undefined) delete process.env.FEATURE_SAVED_ITEMS;
    else process.env.FEATURE_SAVED_ITEMS = value;
    try {
      await fn();
    } finally {
      if (prev === undefined) delete process.env.FEATURE_SAVED_ITEMS;
      else process.env.FEATURE_SAVED_ITEMS = prev;
    }
  };
}

// ─── Feature gating ──────────────────────────────────────────────────────────

test(
  "routes — with the flag off, saved endpoints 404 and never advertise themselves",
  withFlag(undefined, async () => {
    const { GET, POST } = await import("@/app/api/saved/route");

    const get = await GET(new Request(SAVED_URL));
    assert.equal(get.status, 404, "a disabled surface must not return 200");
    const getBody = await readBody(get);
    assert.equal(getBody.ok, false);
    assert.equal(getBody.error?.code, "feature_disabled");

    const post = await POST(new Request(SAVED_URL, { method: "POST", body: JSON.stringify({ entityKey: "matomo" }) }));
    assert.equal(post.status, 404);
    assert.equal((await readBody(post)).error?.code, "feature_disabled");
  })
);

test(
  "routes — a mutation never returns 200 when the guard rejects it",
  withFlag(undefined, async () => {
    const { DELETE } = await import("@/app/api/saved/[entityKey]/route");
    const res = await DELETE(new Request(`${SAVED_URL}/matomo`, { method: "DELETE" }), {
      params: Promise.resolve({ entityKey: "matomo" }),
    });
    assert.notEqual(res.status, 200);
    assert.equal((await readBody(res)).ok, false);
  })
);

test(
  "routes — collection endpoints are gated by the same flag",
  withFlag(undefined, async () => {
    const collections = await import("@/app/api/saved/collections/route");
    const res = await collections.GET(new Request(`${SAVED_URL}/collections`));
    assert.equal(res.status, 404);
    assert.equal((await readBody(res)).error?.code, "feature_disabled");
  })
);

// ─── Error envelope ──────────────────────────────────────────────────────────

test("routes — every failure carries a known, machine-readable code", async () => {
  for (const code of ERROR_CODES) {
    const status = httpStatusFor(code);
    assert.ok(status >= 400, `${code} must map to a non-success status, got ${status}`);
  }
  // Disabled features are indistinguishable from missing routes by design.
  assert.equal(httpStatusFor("feature_disabled"), 404);
  assert.equal(httpStatusFor("unauthenticated"), 401);
  assert.equal(httpStatusFor("forbidden"), 403);
  assert.equal(httpStatusFor("rate_limited"), 429);
  assert.equal(httpStatusFor("conflict"), 409);
});

test("routes — raw database errors are never surfaced to a client", async () => {
  const { fromThrown } = await import("@/lib/server/api-result");

  const prismaish = Object.assign(new Error("Invalid `prisma.savedItem.create()` invocation ... connection string"), {
    code: "P2002",
  });
  const mapped = fromThrown(prismaish, "test");
  assert.equal(mapped.ok, false);
  if (mapped.ok) return;
  assert.equal(mapped.error.code, "conflict");
  assert.ok(!/prisma|invocation|connection string/i.test(mapped.error.message), "must not leak driver detail");

  const unknown = fromThrown(new Error("ECONNREFUSED 10.0.0.5:5432"), "test");
  assert.equal(unknown.ok, false);
  if (unknown.ok) return;
  assert.equal(unknown.error.code, "internal_error");
  assert.ok(!/ECONNREFUSED|10\.0\.0\.5/.test(unknown.error.message), "must not leak internal addresses");
});
