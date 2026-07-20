import Link from "next/link";
import { PageTransition } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/routes";

export default function ForgotPasswordPage() {
  return (
    <PageTransition>
      <div className="w-full max-w-sm">
        <h1 className="t-heading">Reset your password</h1>
        <p className="t-body-sm mt-1.5 text-[var(--text-secondary)]">
          Enter your email and we&rsquo;ll send you a link to reset it.
        </p>

        <form className="mt-6 flex flex-col gap-4">
          <Input type="email" name="email" placeholder="Email" autoComplete="email" required />
          <Button type="submit" variant="primary" className="w-full">
            Send reset link
          </Button>
        </form>

        <Link
          href={ROUTES.auth.login}
          className="t-caption mt-6 block text-center text-sky-500 hover:text-sky-400"
        >
          Back to log in
        </Link>
      </div>
    </PageTransition>
  );
}
