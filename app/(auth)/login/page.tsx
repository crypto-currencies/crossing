import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { emailConfigured } from "@/lib/email";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  const magicLinkEnabled = emailConfigured();

  return (
    <Suspense>
      <LoginForm magicLinkEnabled={magicLinkEnabled} />
    </Suspense>
  );
}
