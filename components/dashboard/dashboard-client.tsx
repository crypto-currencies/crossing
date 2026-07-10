"use client";

import { PageHeader, SectionShell } from "@/components/layout/surface";
import { Card } from "@/components/ui/card";
import { useAuthStore } from "@/store/auth";

export function DashboardClient() {
  const { user } = useAuthStore();

  return (
    <div className="page-stack">
      <SectionShell spacing="tight">
        <PageHeader
          title={`Welcome${user?.name ? `, ${user.name}` : ""}`}
          description="This is a placeholder dashboard — the real Crossing.dev workflows land here."
        />
      </SectionShell>
      <SectionShell spacing="default">
        <Card variant="default" padding="xl" className="max-w-[720px]">
          <p className="t-body-sm text-[var(--text-soft)]">
            Your account is set up. Discovery features (browsing and submitting
            products, services, and tools) haven&apos;t been built yet.
          </p>
        </Card>
      </SectionShell>
    </div>
  );
}
