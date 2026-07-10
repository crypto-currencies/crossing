import type { Metadata } from "next";
import { PageTransition } from "@/components/motion/page-transition";
import { SupportClient } from "@/components/support/support-client";

export const metadata: Metadata = { title: "Support — crossing.dev" };

export default function SupportPage() {
  return (
    <PageTransition>
      <SupportClient />
    </PageTransition>
  );
}
