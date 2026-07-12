import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidHttpUrl, normalizeUrlKey } from "./url-normalize";

test("isValidHttpUrl — accepts http and https", () => {
  assert.equal(isValidHttpUrl("https://example.com"), true);
  assert.equal(isValidHttpUrl("http://example.com"), true);
});

test("isValidHttpUrl — rejects non-http(s) schemes", () => {
  assert.equal(isValidHttpUrl("ftp://example.com"), false);
  assert.equal(isValidHttpUrl("javascript:alert(1)"), false);
  assert.equal(isValidHttpUrl("mailto:a@b.com"), false);
});

test("isValidHttpUrl — rejects malformed input", () => {
  assert.equal(isValidHttpUrl("not a url"), false);
  assert.equal(isValidHttpUrl(""), false);
});

test("normalizeUrlKey — treats http and https as equivalent", () => {
  assert.equal(normalizeUrlKey("http://example.com"), normalizeUrlKey("https://example.com"));
});

test("normalizeUrlKey — treats www and bare host as equivalent", () => {
  assert.equal(normalizeUrlKey("https://www.example.com"), normalizeUrlKey("https://example.com"));
});

test("normalizeUrlKey — strips a trailing slash", () => {
  assert.equal(normalizeUrlKey("https://example.com/tools"), normalizeUrlKey("https://example.com/tools/"));
});

test("normalizeUrlKey — strips an empty query string", () => {
  assert.equal(normalizeUrlKey("https://example.com/tools?"), normalizeUrlKey("https://example.com/tools"));
});

test("normalizeUrlKey — is case-insensitive on host but not path", () => {
  assert.equal(normalizeUrlKey("https://EXAMPLE.com/Tools"), "example.com/Tools");
});

test("normalizeUrlKey — preserves a non-default port", () => {
  assert.equal(normalizeUrlKey("https://example.com:8443/app"), "example.com:8443/app");
});

test("normalizeUrlKey — drops a default port", () => {
  assert.equal(normalizeUrlKey("https://example.com:443/app"), normalizeUrlKey("https://example.com/app"));
});

test("normalizeUrlKey — distinguishes genuinely different paths", () => {
  assert.notEqual(normalizeUrlKey("https://example.com/a"), normalizeUrlKey("https://example.com/b"));
});

test("normalizeUrlKey — throws on an invalid URL", () => {
  assert.throws(() => normalizeUrlKey("not a url"));
  assert.throws(() => normalizeUrlKey("javascript:alert(1)"));
});
