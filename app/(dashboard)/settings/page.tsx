import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsClient } from "@/components/settings/settings-client";
import { PageTransition } from "@/components/motion/page-transition";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PageTransition>
      <Suspense>
        <SettingsClient />
      </Suspense>
    </PageTransition>
  );
}
