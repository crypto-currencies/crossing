import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server/auth";
import { AppShell } from "@/components/layout/app-shell";
import { AppFooter } from "@/components/layout/footer";
import { DeletionBanner } from "@/components/account/deletion-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── Suspension guard ────────────────────────────────────────────────────────
  // Runs server-side on every dashboard page render.
  // Suspended users are redirected to /suspended where they can read the
  // notice and submit an appeal ticket — they do not need dashboard access.
  const user = await getServerUser();
  if (user && (user as { suspendedAt?: Date | null }).suspendedAt) {
    redirect("/suspended");
  }

  // ── Pending-deletion notice ─────────────────────────────────────────────────
  // Users in the 7-day grace period keep full access, but are always shown a
  // banner with the erase date and a one-click cancel — never a silent login.
  const deletionScheduledAt =
    (user as { deletionScheduledAt?: Date | null } | null)?.deletionScheduledAt ?? null;

  return (
    <AppShell sidebar footer={<AppFooter />}>
      {deletionScheduledAt && (
        <DeletionBanner scheduledAt={deletionScheduledAt.toISOString()} />
      )}
      {children}
    </AppShell>
  );
}
