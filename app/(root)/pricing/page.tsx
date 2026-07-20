import Link from "next/link";
import { PageTransition, Reveal } from "@/components/motion";
import { PageHero } from "@/components/marketing/page-hero";
import { Container } from "@/components/layout/container";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

const FAQ = [
  { q: "Is Crossing free to use?", a: "Yes — searching, saving, voting, and submitting are all free." },
  { q: "Will that ever change?", a: "No. Using Crossing to find things stays free." },
  { q: "What about businesses?", a: "Businesses can list for free too, with optional paid plans for more visibility." },
];

export default function PricingPage() {
  return (
    <PageTransition>
      <PageHero eyebrow="Pricing" title="Searching Crossing is free. Always." subtitle="No account required to browse, no paywall on results.">
        <Button asChild variant="primary">
          <Link href={ROUTES.root.home}>Start searching</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={ROUTES.site.businessPricing}>Business pricing</Link>
        </Button>
      </PageHero>

      <Container size="content" className="pb-24" id="faq">
        <Reveal>
          <h2 className="t-heading mb-4">FAQ</h2>
          <div className="flex flex-col gap-1">
            {FAQ.map((item) => (
              <Card key={item.q} shape="row" className="flex-col items-start gap-1">
                <p className="t-body-sm text-[var(--text-primary)]">{item.q}</p>
                <p className="t-caption">{item.a}</p>
              </Card>
            ))}
          </div>
        </Reveal>
      </Container>
    </PageTransition>
  );
}
