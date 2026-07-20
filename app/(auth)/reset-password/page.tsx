import { PageTransition } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  return (
    <PageTransition>
      <div className="w-full max-w-sm">
        <h1 className="t-heading">Set a new password</h1>
        <p className="t-body-sm mt-1.5 text-[var(--text-secondary)]">
          Choose a new password for your account.
        </p>

        <form className="mt-6 flex flex-col gap-4">
          <Input type="password" name="password" placeholder="New password" autoComplete="new-password" required />
          <Input
            type="password"
            name="confirmPassword"
            placeholder="Confirm new password"
            autoComplete="new-password"
            required
          />
          <Button type="submit" variant="primary" className="w-full">
            Update password
          </Button>
        </form>
      </div>
    </PageTransition>
  );
}
