import { LegalLayout } from "@/components/legal/legal-layout";
import { ROUTES } from "@/lib/routes";

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of service" updated="July 2026" active={ROUTES.legal.terms}>
      <p>
        These terms cover your use of Crossing — the accounts you create, the listings you submit, and
        the votes and saves you make along the way.
      </p>
      <h2>Using Crossing</h2>
      <p>
        You need an account to save, vote, or submit a listing. You&rsquo;re responsible for keeping your
        login secure and for what happens under your account.
      </p>
      <h2>Submissions</h2>
      <p>
        Anything you submit goes through moderation before it&rsquo;s public. We can reject or remove a
        listing that&rsquo;s inaccurate, spammy, or doesn&rsquo;t belong.
      </p>
      <h2>Account suspension</h2>
      <p>
        We can suspend accounts that abuse the platform — fake votes, repeated bad submissions, or
        anything that makes the site worse for everyone else.
      </p>
    </LegalLayout>
  );
}
