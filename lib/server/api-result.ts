/**
 * Uniform server result + error contract (backend plan §5, Part 21).
 *
 * Rules this enforces:
 *   - A failed mutation NEVER returns 200.
 *   - Raw Prisma/driver errors are never surfaced to a client.
 *   - Every failure carries a stable machine-readable `code` the frontend can
 *     switch on, plus a human-safe `message`.
 */

import { NextResponse } from "next/server";

export const ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "not_found",
  "invalid_body",
  "invalid_state",
  "conflict",
  "rate_limited",
  "feature_disabled",
  "db_unavailable",
  "dependency_unavailable",
  "internal_error",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiError {
  code: ErrorCode;
  message: string;
  /** Field-level validation detail. Never contains DB internals. */
  fields?: Record<string, string[]>;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail(code: ErrorCode, message: string, fields?: Record<string, string[]>): Result<never> {
  return { ok: false, error: { code, message, ...(fields ? { fields } : {}) } };
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_body: 400,
  invalid_state: 409,
  conflict: 409,
  rate_limited: 429,
  feature_disabled: 404, // don't advertise the existence of a disabled surface
  db_unavailable: 503,
  dependency_unavailable: 503,
  internal_error: 500,
};

export function httpStatusFor(code: ErrorCode): number {
  return STATUS_BY_CODE[code] ?? 500;
}

/** Serialize a Result to a NextResponse with the correct status. */
export function toResponse<T>(result: Result<T>): NextResponse {
  if (result.ok) return NextResponse.json({ ok: true, data: result.data }, { status: 200 });
  return NextResponse.json({ ok: false, error: result.error }, { status: httpStatusFor(result.error.code) });
}

/**
 * Convert an unexpected thrown value into a safe ApiError. Prisma error codes are
 * mapped to meaningful client codes; everything else becomes `internal_error`
 * with the detail logged server-side only.
 */
export function fromThrown(err: unknown, context: string): Result<never> {
  const code = (err as { code?: unknown } | null)?.code;

  if (code === "P2002") return fail("conflict", "That already exists.");
  if (code === "P2025") return fail("not_found", "The requested record no longer exists.");
  if (code === "P2003") return fail("invalid_state", "A related record is missing.");
  if (code === "P2021" || code === "P2022") {
    return fail("db_unavailable", "This feature's storage is not migrated yet.");
  }
  if (code === "P1001" || code === "P1002" || code === "P1017") {
    return fail("db_unavailable", "The database is unreachable.");
  }

  // Log the real error server-side; never leak it to the client.
  console.error(`[${context}]`, err);
  return fail("internal_error", "Something went wrong. Please try again.");
}

/** Flatten a ZodError into the `fields` shape without leaking internals. */
export function zodFields(error: { issues: { path: PropertyKey[]; message: string }[] }): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.map(String).join(".") : "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
