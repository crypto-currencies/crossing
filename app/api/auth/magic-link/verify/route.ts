import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHash, randomBytes } from "crypto";
import { db, DB_AVAILABLE } from "@/lib/db";
import { createSession } from "@/lib/server/auth";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session-cookie";
import { hashIp, maskIp, parseDevice } from "@/lib/server/security";
import { clientIp } from "@/lib/server/rate-limit";

const PENDING_TTL_MS = 5 * 60 * 1000; // 5 minutes to complete 2FA

export async function GET(request: NextRequest) {
  if (!DB_AVAILABLE) {
    return NextResponse.redirect(new URL("/login?error=db_unavailable", request.url));
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  if (!token || !email) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
  }

  // Hash the plain token from the URL before DB lookup — tokens are stored as
  // SHA-256 hashes so a DB read compromise cannot be used to sign in as anyone.
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const record = await db.verificationToken.findFirst({
    where: { identifier: email.toLowerCase(), token: tokenHash },
  });

  if (!record) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
  }

  if (record.expires < new Date()) {
    await db.verificationToken.delete({ where: { identifier_token: { identifier: email.toLowerCase(), token: tokenHash } } }).catch(() => {});
    return NextResponse.redirect(new URL("/login?error=link_expired", request.url));
  }

  // One-time use — delete the token
  await db.verificationToken.delete({
    where: { identifier_token: { identifier: email.toLowerCase(), token: tokenHash } },
  }).catch(() => {});

  // Find or create the user
  let user = await db.user.findFirst({ where: { email: email.toLowerCase() } });
  const isNewUser = !user;

  if (!user) {
    // Auto-create account for first-time magic link users
    user = await db.user.create({
      data: { email: email.toLowerCase() },
    });
  }

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=user_create_failed", request.url));
  }

  // Suspended accounts cannot complete magic-link sign-in. The token was
  // already consumed above (single-use), so no partial auth state remains.
  if (user.suspendedAt) {
    return NextResponse.redirect(new URL("/login?error=account_suspended", request.url));
  }

  // Magic link proves email ownership — mark as verified if not already.
  // Awaited: an un-awaited write can be dropped when the serverless function
  // is frozen right after the redirect response is returned.
  const userExt = user as unknown as { emailVerifiedAt?: Date | null };
  if (!userExt.emailVerifiedAt) {
    await db.user
      .update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } })
      .catch((err) => { console.error("[magic-link] emailVerifiedAt update failed:", err); });
  }

  // ── 2FA gate ───────────────────────────────────────────────────────────────
  // If the account has TOTP enabled, do NOT create a session yet. Issue a
  // short-lived pending token and redirect to the login page for TOTP verification.
  const userWith2FA = user as unknown as { twoFactorEnabled?: boolean; twoFactorSecret?: string | null };
  if (userWith2FA.twoFactorEnabled && userWith2FA.twoFactorSecret) {
    const plain     = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(plain).digest("hex");
    const expiresAt = new Date(Date.now() + PENDING_TTL_MS);

    await db.pendingLogin.deleteMany({ where: { userId: user.id } }).catch(() => {});
    await db.pendingLogin.create({ data: { tokenHash, userId: user.id, expiresAt } });

    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("magic_2fa", plain);
    return NextResponse.redirect(redirectUrl);
  }

  // Capture device metadata so magic-link sessions show a readable browser/OS
  // in the sessions list instead of "Unknown device".
  const ua = request.headers.get("user-agent") ?? undefined;
  const ip = clientIp(request);
  const device = parseDevice(ua);
  const sessionToken = await createSession(user.id, {
    userAgent:  ua,
    ipHash:     hashIp(ip),
    maskedIp:   maskIp(ip),
    deviceHint: device.hint,
  });
  const sessionRecord = await db.session.findUnique({ where: { sessionToken } });

  // Build the bridge URL — the oauth-callback page hydrates the Zustand store
  // using the session cookie only; the token is NOT passed in the URL to avoid
  // exposure in browser history, server logs, and Referrer headers.
  const callbackUrl = new URL("/oauth-callback", request.url);
  callbackUrl.searchParams.set("magic", "1");
  if (isNewUser) callbackUrl.searchParams.set("new", "1");

  const response = NextResponse.redirect(callbackUrl);

  // Set the httpOnly cookie — the callback page reads the session via this cookie
  response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions(sessionRecord!.expires));

  return response;
}
