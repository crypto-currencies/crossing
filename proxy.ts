import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication (cookie presence only — role checks happen
// in layouts/pages which have full DB access).
const PROTECTED_ROUTES = [
  "/dashboard",
  "/settings",
  "/notifications",
  "/control", // role guard enforced server-side in app/(dashboard)/control/admin/layout.tsx
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );

  if (isProtected) {
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
