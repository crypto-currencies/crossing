import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isProtectedPath } from "@/lib/auth-redirect";

// Only the routes in PROTECTED_PREFIXES (lib/auth-redirect.ts) require a session
// cookie. `/login` and `/api/auth/*` are deliberately NOT matched here, so the
// OAuth flow and the login page are never blocked and can't loop.

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isProtectedPath(pathname)) {
    // Accept our custom httpOnly session cookie OR a NextAuth session cookie
    const hasSession =
      request.cookies.has("session_token") ||
      request.cookies.has("next-auth.session-token") ||
      request.cookies.has("__Secure-next-auth.session-token");

    if (!hasSession) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/notifications/:path*",
    "/control/:path*",
  ],
};
