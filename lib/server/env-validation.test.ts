import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEnv } from "./env-validation";

const REQUIRED = {
  DATABASE_URL: "postgres://x",
  NEXTAUTH_SECRET: "x".repeat(32),
  OWNER_EMAIL: "owner@example.com",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x",
  RESEND_API_KEY: "re_x",
  EMAIL_FROM: "noreply@example.com",
  UPSTASH_REDIS_REST_URL: "https://x.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "x",
};

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const snapshot = { ...process.env };
  // Clear the keys we care about so leftovers don't mask the test
  for (const k of [...Object.keys(REQUIRED), "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL", "NODE_ENV"]) {
    delete (process.env as Record<string, string | undefined>)[k];
  }
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const k of Object.keys(process.env)) delete (process.env as Record<string, string | undefined>)[k];
    Object.assign(process.env, snapshot);
  }
}

test("validateEnv — passes in prod when only NEXTAUTH_URL is set (no NEXT_PUBLIC_APP_URL)", () => {
  withEnv({ ...REQUIRED, NEXTAUTH_URL: "https://crossing.dev", NODE_ENV: "production" }, () => {
    assert.doesNotThrow(() => validateEnv());
  });
});

test("validateEnv — passes in prod when only NEXT_PUBLIC_APP_URL is set", () => {
  withEnv({ ...REQUIRED, NEXT_PUBLIC_APP_URL: "https://crossing.dev", NODE_ENV: "production" }, () => {
    assert.doesNotThrow(() => validateEnv());
  });
});

test("validateEnv — throws in prod when both base-URL vars are missing", () => {
  withEnv({ ...REQUIRED, NODE_ENV: "production" }, () => {
    assert.throws(() => validateEnv(), /base URL/);
  });
});

test("validateEnv — throws in prod when a hard-required var is missing", () => {
  withEnv({ ...REQUIRED, DATABASE_URL: undefined, NEXTAUTH_URL: "https://crossing.dev", NODE_ENV: "production" }, () => {
    assert.throws(() => validateEnv(), /DATABASE_URL/);
  });
});

test("validateEnv — only warns (never throws) in development", () => {
  withEnv({ NODE_ENV: "development" }, () => {
    assert.doesNotThrow(() => validateEnv());
  });
});
