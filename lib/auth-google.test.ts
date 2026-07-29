import { test } from "node:test";
import assert from "node:assert/strict";
import { GOOGLE_PROVIDER_ID, googleCallbackUrl, googleSignInArgs, isGoogleConfigured } from "./auth-google";

test("google — provider id is 'google' (matches GoogleProvider registration)", () => {
  assert.equal(GOOGLE_PROVIDER_ID, "google");
});

test("google — sign-in args carry the provider and preserve the redirect", () => {
  const args = googleSignInArgs("/control/admin/evidence");
  assert.equal(args.provider, "google");
  assert.equal(args.options.callbackUrl, "/oauth-callback?redirect=%2Fcontrol%2Fadmin%2Fevidence");
});

test("google — callback URL rejects an unsafe redirect (falls back)", () => {
  assert.equal(googleCallbackUrl("https://evil.com"), "/oauth-callback?redirect=%2F");
  assert.equal(googleCallbackUrl("//evil.com"), "/oauth-callback?redirect=%2F");
});

test("google — isGoogleConfigured requires both real credentials", () => {
  const env = (o: Record<string, string>) => ({ NODE_ENV: "development", ...o }) as NodeJS.ProcessEnv;
  assert.equal(isGoogleConfigured(env({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" })), true);
  assert.equal(isGoogleConfigured(env({ GOOGLE_CLIENT_ID: "id" })), false);
  assert.equal(isGoogleConfigured(env({})), false);
  // .env.example placeholders count as unconfigured.
  assert.equal(
    isGoogleConfigured(env({ GOOGLE_CLIENT_ID: "your-google-client-id", GOOGLE_CLIENT_SECRET: "your-google-client-secret" })),
    false
  );
});
