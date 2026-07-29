import { LegalLayout } from "@/components/legal/legal-layout";
import { ROUTES } from "@/lib/routes";

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy" updated="July 2026" active={ROUTES.legal.privacy}>
      <p>
        We collect what&rsquo;s needed to run Crossing, and nothing beyond that. We don&rsquo;t sell
        your data and we don&rsquo;t share it except where it&rsquo;s required to operate the product.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details.</strong> If you sign in with Google, we receive your email, name,
          and profile image from Google and store them to identify your account.
        </li>
        <li>
          <strong>Session data.</strong> A session record so you stay signed in, plus a hashed IP and
          a browser/OS hint so you can recognize your own sessions.
        </li>
        <li>
          <strong>Search usage.</strong> Operational logs about requests. Search queries are not
          attached to your account for advertising, and our server logs record query length rather
          than query text in production.
        </li>
      </ul>

      <h2>What we don&rsquo;t do</h2>
      <p>
        No selling of personal data, no advertising profiles, no third-party tracking or advertising
        cookies.
      </p>

      <h2>Third parties</h2>
      <p>
        We rely on infrastructure providers to operate: a database host, an email sender for
        transactional email, and Google for OAuth sign-in. They process data on our behalf to
        deliver the service.
      </p>

      <h2>Retention</h2>
      <p>
        Account data is kept while your account exists. Sessions expire automatically. Operational
        logs are short-lived.
      </p>

      <h2>Your data</h2>
      <p>
        You can request export or deletion of your account data. Self-service export and deletion
        controls are not built yet — until they are, contact us and we&rsquo;ll handle it manually.
      </p>
    </LegalLayout>
  );
}
