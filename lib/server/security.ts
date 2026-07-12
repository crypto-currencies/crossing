/**
 * Server-only security utilities.
 * Import only from API routes and server components — never from client code.
 */

import { createHash } from "crypto";
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

export type SecurityEventType =
  | "login"
  | "login_failed"
  | "logout"
  | "password_set"
  | "password_changed"
  | "email_changed"
  | "session_revoked"
  | "sessions_revoked_all"
  | "account_suspended"
  | "role_changed"
  | "account_deleted"
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
