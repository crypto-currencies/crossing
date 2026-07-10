import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { writeSecurityEvent } from "@/lib/server/security";

const IDENTIFIER_PREFIX = "email-verify:";

// ─── GET /api/auth/verify-email?token=X&userId=Y ──────────────────────────────
// Confirms an email verification token, sets emailVerifiedAt, then redirects
// to /settings?verified=1 (authenticated) or /login?verified=1 (not signed in).

export async function GET(request: NextRequest) {
  if (!DB_AVAILABLE) {
    return NextResponse.redirect(new URL("/login?error=db_unavailable", request.url));
  }

  const { searchParams } = new URL(request.url);
  const token  = searchParams.get("token")  ?? "";
  const userId = searchParams.get("userId") ?? "";

  if (!token || !userId) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
  }

  const identifier = `${IDENTIFIER_PREFIX}${userId}`;

  const record = await db.verificationToken.findFirst({
    where: { identifier, token },
  });

  if (!record) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
  }

  if (record.expires < new Date()) {
    await db.verificationToken
      .delete({ where: { identifier_token: { identifier, token } } })
      .catch(() => {});
    return NextResponse.redirect(new URL("/login?error=link_expired", request.url));
  }

  // Consume token
  await db.verificationToken
    .delete({ where: { identifier_token: { identifier, token } } })
    .catch(() => {});

  const user = await db.user.findUnique({
    where:  { id: userId },
    select: { id: true, emailVerifiedAt: true },
  });

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
  }

  // Already verified — still redirect with success so the UX is consistent
  if (!user.emailVerifiedAt) {
    await db.user.update({
      where: { id: userId },
      data:  { emailVerifiedAt: new Date() },
    });

    void writeSecurityEvent({ userId, type: "email_verified" });
  }

  // Redirect into settings so the verified badge appears immediately
  return NextResponse.redirect(new URL("/settings?tab=account&verified=1", request.url));
}
