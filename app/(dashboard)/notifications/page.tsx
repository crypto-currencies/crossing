import type { Metadata } from "next";
import { PageTransition } from "@/components/motion/page-transition";
import { NotificationsClient } from "@/components/notifications/notifications-client";

export const metadata: Metadata = { title: "Notifications — crossing.dev" };

export default function NotificationsPage() {
  return (
    <PageTransition>
      <NotificationsClient />
    </PageTransition>
  );
}
