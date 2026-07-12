import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server/auth";
import { AppShell } from "@/components/layout/app-shell";
import { AppFooter } from "@/components/layout/footer";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── Suspension guard ────────────────────────────────────────────────────────
  // Runs server-side on every dashboard page render.
  // Suspended users are redirected to /suspended where they can read the notice.
  const user = await getServerUser();
  if (user && (user as { suspendedAt?: Date | null }).suspendedAt) {
    redirect("/suspended");
  }

  return (
    <AppShell sidebar footer={<AppFooter />}>
      {children}
    </AppShell>
  );
}
