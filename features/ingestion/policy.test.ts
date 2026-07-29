import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeOrigin, isUrlApproved, isRedirectAllowed, isWithinApprovedOrigin } from "./url-policy";
import { isBlockedIp, assertPublicHost, SsrfBlockedError, type LookupFn } from "./ssrf";
import { parseRobots, isPathAllowed, fetchCrawlPolicy } from "./robots";
import { validateRegistry, listApprovedSources, resolveApprovedUrls, APPROVED_SOURCES } from "./registry";

// ─── Approved-domain validation ──────────────────────────────────────────────

test("registry — the shipped registry is valid; exactly the 3 pilots are enabled", () => {
  assert.doesNotThrow(() => validateRegistry());
  assert.ok(listApprovedSources(true).length >= 13); // all entries (incl. disabled fictional)
  const enabled = listApprovedSources();
  assert.equal(enabled.length, 3); // only the real pilot entities
  assert.ok(enabled.every((s) => s.pilot === true));
});

test("registry — every source resolves at least one fetchable URL within its origin", () => {
  for (const s of APPROVED_SOURCES) {
    const urls = resolveApprovedUrls(s);
    assert.ok(urls.length > 0, `${s.entityId} has no urls`);
    for (const u of urls) assert.ok(isUrlApproved(u, s.approvedOrigins), `${u} not approved`);
  }
});

test("url-policy — exact origin match, www + default port normalized", () => {
  assert.equal(normalizeOrigin("https://www.example.com:443/x")!.key, "https://example.com");
  assert.ok(isWithinApprovedOrigin("https://example.com/pricing", "https://www.example.com"));
  assert.ok(!isWithinApprovedOrigin("http://example.com", "https://example.com")); // scheme differs
});

test("url-policy — look-alike and parent domains are NOT approved", () => {
  assert.ok(!isUrlApproved("https://foo-example.com", ["https://example.com"]));
  assert.ok(!isUrlApproved("https://evil.com/example.com", ["https://example.com"]));
  assert.ok(!isUrlApproved("https://example.com.evil.com", ["https://example.com"]));
});

test("url-policy — subdomains only when allowed", () => {
  assert.ok(!isUrlApproved("https://docs.example.com", ["https://example.com"]));
  assert.ok(isUrlApproved("https://docs.example.com", ["https://example.com"], { allowSubdomains: true }));
});

test("url-policy — a redirect leaving the approved origin is rejected", () => {
  assert.ok(isRedirectAllowed("https://example.com/next", ["https://example.com"]));
  assert.ok(!isRedirectAllowed("https://tracker.net/next", ["https://example.com"]));
  assert.ok(isRedirectAllowed("https://tracker.net/next", ["https://example.com"], { allowOffOriginRedirect: true }));
});

// ─── SSRF / private-IP rejection ─────────────────────────────────────────────

test("ssrf — blocks loopback, private, link-local, metadata, CGNAT", () => {
  for (const ip of ["127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0"]) {
    assert.ok(isBlockedIp(ip), `${ip} should be blocked`);
  }
});

test("ssrf — blocks IPv6 loopback, ULA, link-local, and IPv4-mapped private", () => {
  for (const ip of ["::1", "fc00::1", "fe80::1", "fd00:ec2::254", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
    assert.ok(isBlockedIp(ip), `${ip} should be blocked`);
  }
});

test("ssrf — allows public addresses", () => {
  assert.ok(!isBlockedIp("93.184.216.34"));
  assert.ok(!isBlockedIp("2606:2800:220:1:248:1893:25c8:1946"));
});

test("ssrf — assertPublicHost blocks a host resolving to a private IP", async () => {
  const lookup: LookupFn = async () => [{ address: "10.1.2.3", family: 4 }];
  await assert.rejects(() => assertPublicHost("internal.example.com", lookup), SsrfBlockedError);
});

test("ssrf — assertPublicHost blocks localhost and DNS failures", async () => {
  const okLookup: LookupFn = async () => [{ address: "93.184.216.34", family: 4 }];
  await assert.rejects(() => assertPublicHost("localhost", okLookup), SsrfBlockedError);
  const failLookup: LookupFn = async () => { throw new Error("ENOTFOUND"); };
  await assert.rejects(() => assertPublicHost("nope.example", failLookup), SsrfBlockedError);
  await assert.doesNotReject(() => assertPublicHost("example.com", okLookup));
});

// ─── Robots ──────────────────────────────────────────────────────────────────

test("robots — parses the group for our agent and the wildcard fallback", () => {
  const txt = `User-agent: *\nDisallow: /private\n\nUser-agent: CrossingBot\nDisallow: /secret\nCrawl-delay: 2`;
  const rules = parseRobots(txt, "crossingbot");
  assert.deepEqual(rules.disallow, ["/secret"]);
  assert.equal(rules.crawlDelay, 2);
});

test("robots — path allow/deny with longest-match precedence", () => {
  const policy = { status: "rules" as const, disallow: ["/docs"], allow: ["/docs/public"] };
  assert.ok(!isPathAllowed(policy, "/docs/secret"));
  assert.ok(isPathAllowed(policy, "/docs/public/page"));
  assert.ok(isPathAllowed(policy, "/pricing"));
});

test("robots — undetermined policy fails closed", () => {
  assert.ok(!isPathAllowed({ status: "undetermined", disallow: [], allow: [] }, "/"));
  assert.ok(!isPathAllowed({ status: "disallow_all", disallow: ["/"], allow: [] }, "/pricing"));
});

test("robots — 404 means permitted, 5xx means fail-closed (undetermined)", async () => {
  const origins = ["https://example.com"];
  const notFound = await fetchCrawlPolicy("https://example.com", { approvedOrigins: origins }, {
    fetchImpl: async () => new Response("nope", { status: 404 }),
    lookup: async () => [{ address: "93.184.216.34", family: 4 }],
  });
  assert.equal(notFound.status, "no_robots");

  const serverErr = await fetchCrawlPolicy("https://example.com", { approvedOrigins: origins }, {
    fetchImpl: async () => new Response("boom", { status: 503 }),
    lookup: async () => [{ address: "93.184.216.34", family: 4 }],
  });
  assert.equal(serverErr.status, "undetermined");
});
