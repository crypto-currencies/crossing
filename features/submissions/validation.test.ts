import { test } from "node:test";
import assert from "node:assert/strict";
import { submissionCreateSchema, submissionRejectSchema } from "./validation";

const valid = {
  name: "Linear",
  websiteUrl: "https://linear.app",
  tagline: "Issue tracking built for speed.",
  description: "Linear is a purpose-built tool for planning and tracking software projects.",
  categoryId: "clxxxxxxxxxxxxxxxxxxxxxxx",
};

test("submissionCreateSchema — accepts a well-formed submission", () => {
  const result = submissionCreateSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("submissionCreateSchema — rejects a non-http(s) websiteUrl", () => {
  const result = submissionCreateSchema.safeParse({ ...valid, websiteUrl: "javascript:alert(1)" });
  assert.equal(result.success, false);
});

test("submissionCreateSchema — rejects a too-short name", () => {
  const result = submissionCreateSchema.safeParse({ ...valid, name: "A" });
  assert.equal(result.success, false);
});

test("submissionCreateSchema — rejects a too-short description", () => {
  const result = submissionCreateSchema.safeParse({ ...valid, description: "too short" });
  assert.equal(result.success, false);
});

test("submissionCreateSchema — rejects a missing categoryId", () => {
  const rest: Record<string, unknown> = { ...valid };
  delete rest.categoryId;
  const result = submissionCreateSchema.safeParse(rest);
  assert.equal(result.success, false);
});

test("submissionCreateSchema — trims whitespace", () => {
  const result = submissionCreateSchema.safeParse({ ...valid, name: "  Linear  " });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.name, "Linear");
});

test("submissionRejectSchema — moderatorNote is optional", () => {
  assert.equal(submissionRejectSchema.safeParse({}).success, true);
  assert.equal(submissionRejectSchema.safeParse({ moderatorNote: "duplicate listing" }).success, true);
});

test("submissionRejectSchema — rejects an overlong moderatorNote", () => {
  const result = submissionRejectSchema.safeParse({ moderatorNote: "x".repeat(1001) });
  assert.equal(result.success, false);
});
