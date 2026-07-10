import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { emailConfigured } from "@/lib/email";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  const emailAvailable = emailConfigured();
  return <ForgotPasswordForm emailAvailable={emailAvailable} />;
}
