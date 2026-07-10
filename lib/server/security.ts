/**
 * Server-only security utilities.
 * Import only from API routes and server components — never from client code.
 */

import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";

// ─── IP utilities ─────────────────────────────────────────────────────────────

/** Mask the last two octets of IPv4, or last four groups of IPv6. */
export function maskIp(ip: string): string {
  if (!ip || ip === "unknown") return "Unknown IP";
  if (ip.includes(":")) {
    const groups = ip.split(":");
    return groups.slice(0, 4).join(":") + ":xxxx:xxxx:xxxx:xxxx";
  }
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.xx.xx`;
  return ip.slice(0, 8) + "…";
}

/** One-way SHA-256 hash of an IP for storage (not reversible). */
export function hashIp(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

// ─── Device parsing ───────────────────────────────────────────────────────────

export interface DeviceInfo {
  hint:   string;              // "Chrome on macOS"
  type:   "browser" | "mobile";
}

/** Parse a user-agent string into a human-readable hint. */
export function parseDevice(ua: string | null | undefined): DeviceInfo {
  if (!ua) return { hint: "Unknown device", type: "browser" };

  const isMobile = /iPhone|iPad|iPod|Android|Mobile/i.test(ua);

  let browser = "Unknown browser";
  if      (/Edg\//i.test(ua))                             browser = "Edge";
  else if (/Chrome/i.test(ua) && !/Chromium/i.test(ua))   browser = "Chrome";
  else if (/Firefox/i.test(ua))                            browser = "Firefox";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua))     browser = "Safari";
  else if (/Opera|OPR/i.test(ua))                          browser = "Opera";

  let os = "Unknown OS";
  if      (/Windows NT/i.test(ua))  os = "Windows";
  else if (/Mac OS X/i.test(ua))    os = isMobile ? "iOS" : "macOS";
  else if (/Android/i.test(ua))     os = "Android";
  else if (/CrOS/i.test(ua))        os = "ChromeOS";
  else if (/Linux/i.test(ua))       os = "Linux";

  return { hint: `${browser} on ${os}`, type: isMobile ? "mobile" : "browser" };
}

// ─── Security events ──────────────────────────────────────────────────────────

// ─── TOTP helpers ─────────────────────────────────────────────────────────────

/** Generate a new TOTP secret (base32, 20 bytes = 160-bit). */
export async function generateTotpSecret(): Promise<string> {
  const { authenticator } = await import("otplib");
  return authenticator.generateSecret(20);
}

/** Build an otpauth:// URI for a QR code. */
export async function buildTotpUri(label: string, secret: string): Promise<string> {
  const { authenticator } = await import("otplib");
  return authenticator.keyuri(label, "crossing.dev", secret);
}

/** TOTP time step in seconds (RFC 6238 standard, matches authenticator apps). */
const TOTP_PERIOD_SECONDS = 30;

interface TotpResult {
  valid:    boolean;
  timeStep: number; // TOTP counter value used for this verification
}

/**
 * Verify a 6-digit TOTP token against a base32 secret.
 * Returns whether the code is valid and which time step it belongs to.
 *
 * `window: 1` accepts ±1 step so users with up to 30-second clock skew can
 * still authenticate. This is the RFC 6238 recommended window.
 */
async function verifyTotpRaw(token: string, secret: string): Promise<TotpResult> {
  const { authenticator } = await import("otplib");
  authenticator.options = { window: 1 };
  const delta = authenticator.checkDelta(token, secret);
  const nowStep = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
  return {
    valid:    delta !== null,
    timeStep: delta !== null ? nowStep + delta : nowStep,
  };
}

/**
 * Public single-result TOTP verifier — only returns true/false.
 * Use `verifyTotpOrBackup` for the full login flow (it handles replay prevention).
 */
export async function verifyTotp(token: string, secret: string): Promise<boolean> {
  return (await verifyTotpRaw(token, secret)).valid;
}

export type SecurityEventType =
  | "login"
  | "login_failed"
  | "logout"
  | "password_set"
  | "password_changed"
  | "email_changed"
  | "totp_setup_started"
  | "totp_enabled"
  | "totp_disabled"
  | "backup_codes_generated"
  | "backup_code_used"
  | "session_revoked"
  | "sessions_revoked_all"
  | "account_suspended"
  | "role_changed"
  | "account_deletion_requested"
  | "account_deletion_cancelled"
  | "password_reset_requested"
  | "password_reset_completed"
  | "email_verification_sent"
  | "email_verified";

export interface SecurityEventInput {
  userId:    string;
  type:      SecurityEventType;
  metadata?: Record<string, unknown>;
  ip?:       string;
  userAgent?: string;
}

/** Write a security event. Non-fatal — logs errors but never throws. */
export async function writeSecurityEvent(event: SecurityEventInput): Promise<void> {
  try {
    await db.securityEvent.create({
      data: {
        userId:    event.userId,
        type:      event.type,
        metadata:  event.metadata as Record<string, string | number | boolean | null | undefined> | undefined,
        ipHash:    event.ip ? hashIp(event.ip) : null,
        userAgent: event.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error("[security] writeSecurityEvent failed:", err);
  }
}

// ─── Backup codes ─────────────────────────────────────────────────────────────

const BACKUP_CODE_COUNT = 10;

/**
 * Generate N random backup codes in XXXX-XXXX-XXXX format (uppercase hex).
 * Returns plain-text codes — caller must hash before storing.
 */
export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const hex = randomBytes(6).toString("hex").toUpperCase();
    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
  });
}

/**
 * Hash a single backup code with bcrypt (cost 10).
 * Normalises the code: uppercase, strip dashes/spaces before hashing.
 */
export async function hashBackupCode(code: string): Promise<string> {
  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.hash(normaliseBackupCode(code), 10);
}

/** Compare a plain-text code against a stored bcrypt hash. */
export async function verifyBackupCodeHash(code: string, hash: string): Promise<boolean> {
  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.compare(normaliseBackupCode(code), hash);
}

function normaliseBackupCode(code: string): string {
  return code.toUpperCase().replace(/[-\s]/g, "");
}

/**
 * Replace all backup codes for a user atomically.
 * Deletes old codes and inserts new hashed ones.
 * Returns the NEW plain-text codes (show once, never again).
 */
export async function replaceBackupCodes(userId: string): Promise<string[]> {
  const plain = generateBackupCodes();
  const hashed = await Promise.all(plain.map(hashBackupCode));

  await db.$transaction([
    db.userBackupCode.deleteMany({ where: { userId } }),
    db.userBackupCode.createMany({
      data: hashed.map((codeHash) => ({ userId, codeHash })),
    }),
  ]);

  return plain;
}

/**
 * Attempt to verify either a TOTP code or a backup code for a user.
 * - 6-digit numeric string → tries TOTP with replay prevention
 * - Anything else → tries backup codes
 *
 * Returns "totp" | "backup" on success, null on failure.
 *
 * Replay prevention: after a successful TOTP verification, the time-step counter
 * is atomically written to `User.twoFactorLastUsedStep`. Any subsequent attempt
 * that resolves to the same or an older step is rejected — this means the same
 * 6-digit code cannot be used twice within the same 30-second window even if the
 * attacker has a different pending login token.
 *
 * The write uses `updateMany` with a conditional `WHERE` so the check and
 * write are atomic with respect to concurrent requests: if two requests race
 * with identical codes, only the first succeeds and the second sees count=0.
 */
export async function verifyTotpOrBackup(
  userId: string,
  code:   string,
  secret: string,
): Promise<"totp" | "backup" | null> {
  const stripped = code.replace(/\s/g, "");

  // Try TOTP first (6 digits)
  if (/^\d{6}$/.test(stripped)) {
    try {
      const { valid, timeStep } = await verifyTotpRaw(stripped, secret);
      if (valid) {
        // Atomically record this time step as consumed.
        // The WHERE ensures we only succeed if no equal-or-newer step has already
        // been recorded — this is the single-statement replay guard.
        const updated = await db.user.updateMany({
          where: {
            id: userId,
            OR: [
              { twoFactorLastUsedStep: null },
              { twoFactorLastUsedStep: { lt: timeStep } },
            ],
          },
          data: { twoFactorLastUsedStep: timeStep },
        });
        if (updated.count === 0) {
          // Another request already consumed this step — treat as invalid
          return null;
        }
        return "totp";
      }
    } catch { /* malformed secret — fall through */ }
  }

  // Try backup code
  const normalised = normaliseBackupCode(code);
  if (normalised.length >= 8) {
    const rows = await db.userBackupCode.findMany({ where: { userId, usedAt: null } });
    for (const row of rows) {
      const bcrypt = (await import("bcryptjs")).default;
      const ok = await bcrypt.compare(normalised, row.codeHash);
      if (ok) {
        await db.userBackupCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
        return "backup";
      }
    }
  }

  return null;
}
