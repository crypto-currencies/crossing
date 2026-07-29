import { PageTransition } from "@/components/motion";
import { AuthCard } from "@/components/auth/auth-card";
import { isGoogleConfigured } from "@/lib/auth-google";
import { safeInternalPath } from "@/lib/auth-redirect";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[]; intent?: string | string[] }>;
}) {
  const { redirect, intent } = await searchParams;
  const raw = Array.isArray(redirect) ? redirect[0] : redirect;
  const redirectPath = safeInternalPath(raw, "/");
  const rawIntent = Array.isArray(intent) ? intent[0] : intent;

  return (
    <PageTransition>
      <AuthCard mode="signup" googleConfigured={isGoogleConfigured()} redirectPath={redirectPath} intent={rawIntent === "business" ? "business" : "consumer"} />
    </PageTransition>
  );
}
