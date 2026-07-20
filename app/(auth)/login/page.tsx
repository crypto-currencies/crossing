import { PageTransition } from "@/components/motion";
import { AuthCard } from "@/components/auth/auth-card";

export default function LoginPage() {
  return (
    <PageTransition>
      <AuthCard mode="login" />
    </PageTransition>
  );
}
