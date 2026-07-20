import { LegalLayout } from "@/components/legal/legal-layout";
import { ROUTES } from "@/lib/routes";

export default function DmcaPage() {
  return (
    <LegalLayout title="DMCA" updated="July 2026" active={ROUTES.legal.dmca}>
      <p>
        If a listing infringes your copyright, send a takedown notice to our support address with the
        listing URL, a description of the work, and a statement that you own the rights.
      </p>
      <h2>What happens next</h2>
      <p>
        We review valid notices and remove infringing listings promptly. The submitter is notified and
        can respond with a counter-notice.
      </p>
    </LegalLayout>
  );
}
