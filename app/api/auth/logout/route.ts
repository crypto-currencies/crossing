import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { extractBearerToken, deleteSession } from "@/lib/server/auth";
import { DB_AVAILABLE } from "@/lib/db";
import { SESSION_COOKIE, SESSION_COOKIE_CLEAR } from "@/lib/server/session-cookie";

const NEXTAUTH_COOKIE_CLEAR = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 0 };

export async function POST(request: NextRequest) {
  if (DB_AVAILABLE) {
    // Delete the custom DB session — present as Bearer header (email/password, OAuth) or
    // as the session_token httpOnly cookie.
    const bearerToken =
      extractBearerToken(request) ?? request.cookies.get(SESSION_COOKIE)?.value;
    if (bearerToken) {
      await deleteSession(bearerToken).catch(() => {});
    }
    // Note: we no longer read the NextAuth JWT to find a customSessionToken, because
    // the JWT no longer embeds one. The Bearer token above is the sole DB session
    // credential for both email/password and OAuth users.
  }

  const response = NextResponse.json({ ok: true });

  // Clear the custom session cookie
  response.cookies.set(SESSION_COOKIE, "", SESSION_COOKIE_CLEAR);
  // Clear the NextAuth JWT cookies (standard + __Secure- prefix for HTTPS)
  response.cookies.set("next-auth.session-token", "", NEXTAUTH_COOKIE_CLEAR);
  response.cookies.set("__Secure-next-auth.session-token", "", {
    ...NEXTAUTH_COOKIE_CLEAR,
    secure: true,
  });

  return response;
}
