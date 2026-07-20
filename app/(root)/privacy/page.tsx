import { LegalLayout } from "@/components/legal/legal-layout";
import { ROUTES } from "@/lib/routes";

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy" updated="July 2026" active={ROUTES.legal.privacy}>
      <p>
        We collect what&rsquo;s needed to run Crossing: your account details, the listings you save or
        vote on, and basic usage data. Nothing beyond that.
      </p>
      <h2>What we don&rsquo;t do</h2>
      <p>We don&rsquo;t sell your data, and we don&rsquo;t share it beyond what running the product requires.</p>
      <h2>Your data</h2>
      <p>You can export or delete your account data at any time from account settings.</p>
    </LegalLayout>
  );
}
