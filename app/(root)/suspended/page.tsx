import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/marketing/page-placeholder";

export const metadata: Metadata = {
  title: "Account suspended — Crossing",
  robots: { index: false, follow: false },
};

export default function SuspendedPage() {
  return (
    <PagePlaceholder
      eyebrow="Account"
      title="This account is suspended"
      subtitle="Access to account features has been paused."
      status="Suspended"
      body="You can still browse and search Crossing while signed out. If you think this is a mistake, reply to the email we sent about the suspension — there is no separate appeals form yet."
      actions={[{ label: "Back to home", href: "/" }]}
    />
  );
}
