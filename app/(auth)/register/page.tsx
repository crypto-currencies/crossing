import { PageTransition } from "@/components/motion";
import { AuthCard } from "@/components/auth/auth-card";

export default function RegisterPage() {
  return (
    <PageTransition>
      <AuthCard mode="signup" />
    </PageTransition>
  );
}
