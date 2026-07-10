import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/server/auth";
import { mapUser } from "@/lib/server/mappers";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session-cookie";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";
import { emailConfigured } from "@/lib/email";

export async function POST(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  // 5 registrations per minute per IP
  if (!await rateLimit(`register:${clientIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  let body: { email?: unknown; password?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!email || !password) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Basic email format check
  if (!email.includes("@") || email.length < 5 || email.length > 254) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  // Password strength
  if (password.length < 8) {
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  }
  if (password.length > 128) {
    return NextResponse.json({ error: "password_too_long" }, { status: 400 });
  }

  const existing = await db.user.findFirst({
    where: { email },
    select: { email: true },
  });

  if (existing) {
    return NextResponse.json({ error: "credential_taken" }, { status: 409 });
  }

  const passwordHash = hashPassword(password);

  const user = await db.user.create({
    data: {
      email,
      name: name || null,
      passwordHash,
    },
  });

  const token = await createSession(user.id);
  const session = await db.session.findUnique({ where: { sessionToken: token } });

  // Send email verification (fire-and-forget — non-fatal; user can resend from settings)
  if (emailConfigured()) {
    import("@/app/api/auth/verify-email/resend/route")
      .then(({ sendVerificationEmail }) => sendVerificationEmail(user.id, email))
      .catch((err) => console.error("[register] Verification email failed:", err));
  }

  if (!session) {
    return NextResponse.json({ error: "session_create_failed" }, { status: 500 });
  }

  const response = NextResponse.json(
    {
      token,
      expiresAt: session.expires.toISOString(),
      user: mapUser(user, { includeEmail: true }),
      isNewUser: true,
    },
    { status: 201 }
  );

  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(session.expires));

  return response;
}
