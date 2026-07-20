import { LegalLayout } from "@/components/legal/legal-layout";
import { ROUTES } from "@/lib/routes";

export default function PoliciesPage() {
  return (
    <LegalLayout title="Platform policies" updated="July 2026" active={ROUTES.legal.policies}>
      <p>The rules that keep listings and votes trustworthy.</p>
      <h2>Listing standards</h2>
      <p>
        Every listing needs a working link, an accurate description, and a real reason someone would
        want to find it. No placeholder pages, no dead links.
      </p>
      <h2>Voting</h2>
      <p>
        One vote per account per listing. Coordinated or bought votes get removed, and repeat offenders
        lose their voting privileges.
      </p>
    </LegalLayout>
  );
}
