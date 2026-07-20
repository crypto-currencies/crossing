import { LegalLayout } from "@/components/legal/legal-layout";
import { ROUTES } from "@/lib/routes";

export default function PromotionDisclosurePage() {
  return (
    <LegalLayout title="Promotion disclosure" updated="July 2026" active={ROUTES.site.promotionDisclosure}>
      <p>
        Businesses can pay to be listed on Crossing. Paid listings never affect ranking or search
        results — they&rsquo;re shown separately and labeled &ldquo;Sponsored.&rdquo;
      </p>
      <h2>Editorial picks</h2>
      <p>
        Editorial picks are chosen by our team based on quality, not payment. Businesses can&rsquo;t buy
        their way into a ranked position.
      </p>
    </LegalLayout>
  );
}
