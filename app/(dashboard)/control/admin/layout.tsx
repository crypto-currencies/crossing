/**
 * Admin layout — server-side role guard.
 *
 * Every route under /control/admin is wrapped by this layout.
 * It runs on the server before any page content renders, so there is
 * no client-side check that can be bypassed.
 *
 * Uses getAdminUser() (not getServerUser()) because getAdminUser() handles
 * BOTH custom session cookies (email/password) AND NextAuth JWT cookies
 * (Google / Discord OAuth), plus auto-promotes the owner account on first access.
 *
 * Access rules:
 *   - Unauthenticated → redirect to /login
 *   - Authenticated but role < ADMIN → 404  (avoids leaking that the route exists)
 *   - ADMIN or OWNER → render children normally
 */

import { notFound, redirect } from "next/navigation";
import { getAdminUser } from "@/lib/server/admin";
import { isAdmin } from "@/lib/server/auth";

export default async function ControlAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAdminUser();

  // Not logged in via any supported auth method
  if (!user) {
    redirect("/login");
  }

  // Logged in but insufficient role — 404 (don't reveal the route exists)
  if (!isAdmin(user)) {
    notFound();
  }

  // Authorized — render the page
  return <>{children}</>;
}
