import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRedirect } from "./redirect";

test("validateRedirect — allows same-origin relative paths", () => {
  assert.equal(validateRedirect("/dashboard"), "/dashboard");
  assert.equal(validateRedirect("/settings?tab=privacy"), "/settings?tab=privacy");
  assert.equal(validateRedirect("/profiles/abc#top"), "/profiles/abc#top");
});

test("validateRedirect — denies absolute URLs", () => {
  assert.equal(validateRedirect("https://evil.com"), "/dashboard");
  assert.equal(validateRedirect("http://evil.com/path"), "/dashboard");
});

test("validateRedirect — denies protocol-relative URLs", () => {
  assert.equal(validateRedirect("//evil.com"), "/dashboard");
  assert.equal(validateRedirect("/\\evil.com"), "/dashboard");
});

test("validateRedirect — denies javascript: and data: schemes", () => {
  assert.equal(validateRedirect("javascript:alert(1)"), "/dashboard");
  assert.equal(validateRedirect("data:text/html,<script>"), "/dashboard");
});

test("validateRedirect — denies anything containing ://", () => {
  assert.equal(validateRedirect("/foo://bar"), "/dashboard");
});

test("validateRedirect — falls back on empty / null / undefined", () => {
  assert.equal(validateRedirect(null), "/dashboard");
  assert.equal(validateRedirect(undefined), "/dashboard");
  assert.equal(validateRedirect(""), "/dashboard");
});

test("validateRedirect — honours a custom fallback", () => {
  assert.equal(validateRedirect("https://evil.com", "/login"), "/login");
  assert.equal(validateRedirect(null, "/login"), "/login");
});
