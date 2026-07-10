import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { createSession, SuspendedAccountError } from "@/lib/server/auth";
import { DB_AVAILABLE, db } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session-cookie";
import { hashIp, maskIp, parseDevice } from "@/lib/server/security";
import { clientIp } from "@/lib/server/rate-limit";

const PENDING_TTL_MS = 5 * 60 * 1000;

/**
 * OAuth-to-custom-session bridge.
 *
 * Called once by /oauth-callback after Google or Discord OAuth completes.
 * Reads the encrypted NextAuth JWT (which contains only userId), creates a
 * fresh custom DB session for that user, and returns the token so the client
 * can use it as a Bearer token for all subsequent API calls.
 *
 * Why here instead of inside the NextAuth jwt() callback?
 * ────────────────────────────────────────────────────────
 * Storing a DB session token inside a JWT — even an encrypted JWE — couples two
 * credential systems unnecessarily: a compromised or leaked JWT immediately
 * yields a valid DB session token without a DB lookup. By creating the DB
 * session here, the NextAuth JWT only ever contains user identity data (userId,
 * username, displayName), keeping both systems cleanly separated.
 */
export async function GET(request: NextRequest) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  // Decrypt and verify the NextAuth JWE cookie
  let token;
  try {
    token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
  } catch (err) {
    console.error("[google-token] getToken() threw:", err);
    return NextResponse.json({ error: "no_session", detail: "jwt_decrypt_failed" }, { status: 401 });
  }

  const userId = token?.userId as string | undefined;
  if (!userId) {
    // Log what we DID get so the failure is diagnosable
    const hasToken = token !== null;
    const tokenKeys = token ? Object.keys(token) : [];
    console.error(
      `[google-token] no userId in JWT — hasToken=${hasToken} keys=[${tokenKeys.join(",")}]`,
      "NEXTAUTH_URL=", process.env.NEXTAUTH_URL,
      "VERCEL=", process.env.VERCEL,
    );
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }

  // ── 2FA gate ───────────────────────────────────────────────────────────────
  // OAuth proves identity via the provider but does NOT satisfy TOTP. If the
  // account has 2FA enabled, return a pending token instead of a real session.
  const oauthUser = await db.user.findUnique({
    where:  { id: userId },
    select: { twoFactorEnabled: true, twoFactorSecret: true, suspendedAt: true },
  });

  if (oauthUser?.suspendedAt) {
    return NextResponse.json({ error: "account_suspended" }, { status: 403 });
  }

  if (oauthUser?.twoFactorEnabled && oauthUser.twoFactorSecret) {
    const plain     = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(plain).digest("hex");
    const expiresAt = new Date(Date.now() + PENDING_TTL_MS);

    await db.pendingLogin.deleteMany({ where: { userId } }).catch(() => {});
    await db.pendingLogin.create({ data: { tokenHash, userId, expiresAt } });

    return NextResponse.json({
      requires2FA: true,
      pendingToken: plain,
      isNewUser: token?.isNewUser ?? false,
    });
  }

  // Create a fresh 30-day DB session for this user.
  // Capture device metadata so OAuth sessions show a readable browser/OS in the
  // sessions list (parity with email/password login) instead of "Unknown device".
  const ua = request.headers.get("user-agent") ?? undefined;
  const ip = clientIp(request);
  const device = parseDevice(ua);
  let sessionToken: string;
  try {
    sessionToken = await createSession(userId, {
      userAgent:  ua,
      ipHash:     hashIp(ip),
      maskedIp:   maskIp(ip),
      deviceHint: device.hint,
    });
  } catch (err) {
    if (err instanceof SuspendedAccountError) {
      return NextResponse.json({ error: "account_suspended" }, { status: 403 });
    }
    throw err;
  }

  // Look up the expiry so we can set the cookie with the correct max-age
  const session = await db.session.findUnique({ where: { sessionToken } });

  const response = NextResponse.json({
    token: sessionToken,
    isNewUser: token?.isNewUser ?? false,
  });

  // Set the same httpOnly session cookie that email/password login sets.
  // This allows server components (layouts, admin pages) to read the session
  // via cookies() — without it, OAuth users have no server-readable session.
  if (session) {
    response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions(session.expires));
  }

  return response;
}
