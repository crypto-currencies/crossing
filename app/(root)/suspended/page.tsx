/**
 * /suspended — shown to users whose account has been suspended.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server/auth";
import { SuspendedClient } from "@/components/suspended/suspended-client";

export const metadata: Metadata = {
  title: "Account suspended — crossing.dev",
  robots: "noindex, nofollow",
};

export default async function SuspendedPage() {
  const user = await getServerUser();

  if (!user) redirect("/login");

  const ext = user as { suspendedAt?: Date | null; suspendedReason?: string | null };

  if (!ext.suspendedAt) redirect("/dashboard");

  return (
    <SuspendedClient
      suspendedAt={ext.suspendedAt.toISOString()}
      suspendedReason={ext.suspendedReason ?? null}
      username={(user as { username?: string | null }).username ?? null}
    />
  );
}
