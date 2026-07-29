import { LegalLayout } from "@/components/legal/legal-layout";
import { ROUTES } from "@/lib/routes";

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of service" updated="July 2026" active={ROUTES.legal.terms}>
      <p>
        These terms cover your use of Crossing — the account you create, the searches you run, and
        anything you submit. Crossing is pre-launch software; features change and may be withdrawn.
      </p>

      <h2>Using Crossing</h2>
      <p>
        Searching is free and doesn&rsquo;t require an account. You need an account to use features
        tied to your identity. You&rsquo;re responsible for keeping your login secure and for what
        happens under your account.
      </p>

      <h2>What our recommendations are — and aren&rsquo;t</h2>
      <p>
        Crossing compares options using information from linked sources and shows the reasons behind
        each result. It is information to help you decide,
        not professional advice. Prices, plans, and features change constantly; always confirm on the
        vendor&rsquo;s own site before you buy. When information is missing or older, results say so.
      </p>

      <h2>Submissions</h2>
      <p>
        Public submissions aren&rsquo;t open yet. When they open, anything you submit goes through
        moderation before it&rsquo;s public, and we can reject or remove anything inaccurate, spammy,
        or out of scope.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don&rsquo;t attempt to break, overload, or scrape the service, don&rsquo;t manipulate
        recommendations, and don&rsquo;t use Crossing to do anything unlawful.
      </p>

      <h2>Account suspension</h2>
      <p>
        We can suspend accounts that abuse the platform — manipulated votes, repeated bad
        submissions, or anything that makes the service worse for everyone else.
      </p>

      <h2>No warranty</h2>
      <p>
        Crossing is provided &ldquo;as is&rdquo;, without warranties. We don&rsquo;t guarantee that
        a recommendation is correct, current, or suitable for your situation.
      </p>

      <h2>Changes</h2>
      <p>
        We&rsquo;ll update these terms as the product develops, and the &ldquo;last updated&rdquo;
        date above will change with them.
      </p>
    </LegalLayout>
  );
}
