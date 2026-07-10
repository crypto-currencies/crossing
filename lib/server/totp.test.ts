/**
 * TOTP verification unit tests.
 *
 * These tests cover the pure cryptographic layer (verifyTotp) and backup-code
 * helpers. Flow-level tests (replay prevention, pending-login lifecycle) require
 * a live database and live in integration tests outside this file.
 *
 * Run: npm test  (tsx --test lib/**\/*.test.ts)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOtplib() {
  const otplib = await import("otplib");
  return otplib;
}

/**
 * Dynamically import the functions under test so the module's dynamic imports
 * (otplib, bcryptjs) are resolved at test time, not at module load.
 */
async function getVerifyTotp() {
  const { verifyTotp } = await import("./security");
  return verifyTotp;
}

async function getBackupHelpers() {
  const { hashBackupCode, verifyBackupCodeHash, generateBackupCodes } = await import("./security");
  return { hashBackupCode, verifyBackupCodeHash, generateBackupCodes };
}

// ─── TOTP: valid code ─────────────────────────────────────────────────────────

describe("verifyTotp — valid code (current step)", async () => {
  test("current-step code is accepted", async () => {
    const { authenticator } = await getOtplib();
    const secret = authenticator.generateSecret(20);
    const token  = authenticator.generate(secret);

    const verifyTotp = await getVerifyTotp();
    const ok = await verifyTotp(token, secret);
    assert.equal(ok, true, "current-step TOTP code must be accepted");
  });
});

// ─── TOTP: wrong code ─────────────────────────────────────────────────────────

describe("verifyTotp — wrong code", () => {
  test("completely wrong 6-digit code is rejected", async () => {
    const { authenticator } = await getOtplib();
    const secret      = authenticator.generateSecret(20);
    const correctCode = authenticator.generate(secret);

    // Flip the last digit to get a guaranteed wrong code
    const wrongCode = correctCode.slice(0, 5) + ((Number(correctCode[5]) + 1) % 10).toString();

    const verifyTotp = await getVerifyTotp();
    const ok = await verifyTotp(wrongCode, secret);
    assert.equal(ok, false, "wrong TOTP code must be rejected");
  });

  test("all-zeros is rejected", async () => {
    const { authenticator } = await getOtplib();
    const secret = authenticator.generateSecret(20);

    const verifyTotp = await getVerifyTotp();
    const ok = await verifyTotp("000000", secret);
    assert.equal(ok, false, "000000 must be rejected unless it is the actual current code");
  });
});

// ─── TOTP: expired code (outside ±1 step window) ──────────────────────────────

describe("verifyTotp — expired code (outside tolerance window)", () => {
  test("code from 3 steps ago is rejected", async () => {
    const { authenticator } = await getOtplib();
    const secret = authenticator.generateSecret(20);

    // Generate a code for 3 time steps in the past (90 seconds ago).
    // The ±1 step verification window only accepts 1 step, so this must fail.
    const THREE_STEPS_MS = 3 * 30 * 1000;
    const past = authenticator.clone({ epoch: Date.now() - THREE_STEPS_MS });
    const pastCode = past.generate(secret);

    const verifyTotp = await getVerifyTotp();
    const ok = await verifyTotp(pastCode, secret);
    assert.equal(ok, false, "code from 3 steps ago must be rejected");
  });

  test("code from 3 steps in the future is rejected", async () => {
    const { authenticator } = await getOtplib();
    const secret = authenticator.generateSecret(20);

    const THREE_STEPS_MS = 3 * 30 * 1000;
    const future = authenticator.clone({ epoch: Date.now() + THREE_STEPS_MS });
    const futureCode = future.generate(secret);

    const verifyTotp = await getVerifyTotp();
    const ok = await verifyTotp(futureCode, secret);
    assert.equal(ok, false, "code from 3 steps in the future must be rejected");
  });
});

// ─── Backup codes ─────────────────────────────────────────────────────────────

describe("backup codes", () => {
  test("generated codes have XXXX-XXXX-XXXX format", async () => {
    const { generateBackupCodes } = await getBackupHelpers();
    const codes = generateBackupCodes(10);
    assert.equal(codes.length, 10, "should generate 10 codes");
    for (const code of codes) {
      assert.match(code, /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/, `invalid format: ${code}`);
    }
  });

  test("plain-text code verifies against its hash", async () => {
    const { generateBackupCodes, hashBackupCode, verifyBackupCodeHash } = await getBackupHelpers();
    const [plain] = generateBackupCodes(1);
    const hash    = await hashBackupCode(plain);
    const ok      = await verifyBackupCodeHash(plain, hash);
    assert.equal(ok, true, "backup code must verify against its own hash");
  });

  test("wrong code does not verify against a hash", async () => {
    const { generateBackupCodes, hashBackupCode, verifyBackupCodeHash } = await getBackupHelpers();
    const [plain] = generateBackupCodes(1);
    const hash    = await hashBackupCode(plain);
    const ok      = await verifyBackupCodeHash("AAAA-BBBB-CCCC", hash);
    assert.equal(ok, false, "wrong backup code must not verify");
  });

  test("code normalisation: lowercase with dashes/spaces equals original", async () => {
    const { generateBackupCodes, hashBackupCode, verifyBackupCodeHash } = await getBackupHelpers();
    const [plain] = generateBackupCodes(1);
    const hash    = await hashBackupCode(plain);

    // Lower-case with dashes stripped — normaliser should handle both
    const variants = [
      plain.toLowerCase(),
      plain.replace(/-/g, ""),
      plain.replace(/-/g, " "),
    ];
    for (const v of variants) {
      const ok = await verifyBackupCodeHash(v, hash);
      assert.equal(ok, true, `variant "${v}" should verify`);
    }
  });

  test("all-zeros backup code does not verify against a real hash", async () => {
    const { generateBackupCodes, hashBackupCode, verifyBackupCodeHash } = await getBackupHelpers();
    const [plain] = generateBackupCodes(1);
    const hash    = await hashBackupCode(plain);
    const ok      = await verifyBackupCodeHash("0000-0000-0000", hash);
    assert.equal(ok, false, "trivial code must not verify");
  });
});

// ─── Integration scenario documentation ───────────────────────────────────────
//
// The following scenarios require a live database (PendingLogin, User, UserBackupCode)
// and are documented here for completeness. Run them against the dev DB with a
// test script or an E2E test suite.
//
// Scenario 4 — wrong then right:
//   a. POST /api/auth/login  → pendingToken
//   b. POST /api/auth/login/2fa { pendingToken, code: <wrong> }  → 401 invalid_code
//   c. POST /api/auth/login/2fa { pendingToken, code: <correct> } → 200 session
//   PendingLogin.failedAttempts is 1 after (b); the pending login is NOT deleted.
//
// Scenario 5 — max attempts (5 wrong codes):
//   After 5 consecutive wrong codes the API returns too_many_attempts and the
//   PendingLogin row is deleted. Subsequent attempts with the same pendingToken
//   return invalid_pending_token.
//
// Scenario 6 — replay prevention:
//   Two login flows started within the same 30-second TOTP window (same step):
//   a. Flow 1 completes successfully → twoFactorLastUsedStep = K
//   b. Flow 2 uses the same 6-digit code (also step K) → rejected (count=0 in updateMany)
//
// Scenario 7 — failed attempt does not destroy pending:
//   After one wrong code the pending login must still exist in the DB and
//   failedAttempts must equal 1. Verified by reading the PendingLogin row.
//
// Scenario 8 — pending login expiry (5-minute TTL):
//   Manually set PendingLogin.expiresAt to a past time; the route returns
//   pending_token_expired and deletes the row.
//
// Scenario 9 — backup codes:
//   POST /api/auth/login/2fa with a valid backup code → 200 session and
//   UserBackupCode.usedAt is now set for that row. Second use → null (usedAt != null).
