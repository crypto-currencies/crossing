import type { Metadata } from "next";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { PageTransition } from "@/components/motion/page-transition";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <PageTransition>
      <DashboardClient />
    </PageTransition>
  );
}
