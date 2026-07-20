import Link from "next/link";
import { PageTransition, StaggerReveal, StaggerItem, Reveal } from "@/components/motion";
import { PageHero } from "@/components/marketing/page-hero";
import { Container } from "@/components/layout/container";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "A working listing, nothing held back.",
    features: ["Full profile", "Appears in search", "Save & vote counts"],
    highlight: false,
  },
  {
    name: "Growth",
    price: "$29",
    period: "/month",
    description: "For businesses that want a head start.",
    features: ["Everything in Free", "Priority placement in your category", "Monthly performance summary"],
    highlight: true,
  },
  {
    name: "Featured",
    price: "$99",
    period: "/month",
    description: "Maximum visibility, labeled clearly.",
    features: ["Everything in Growth", "Homepage rotation", "“Sponsored” badge, never affects ranking"],
    highlight: false,
  },
];

const FAQ = [
  { q: "Does paying change my ranking?", a: "No. Ranking is based on votes, saves, and quality — never payment." },
  { q: "Can I cancel anytime?", a: "Yes, plans are month-to-month with no lock-in." },
  { q: "Is there a free option?", a: "Yes — every business can list for free, permanently." },
];

export default function BusinessPricingPage() {
  return (
    <PageTransition>
      <PageHero eyebrow="For businesses" title="Simple pricing, no surprises" subtitle="Start free. Upgrade only if you want more visibility." />

      <Container size="lg" className="pb-24">
        <StaggerReveal className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <StaggerItem key={plan.name}>
              <Card
                shape="tall"
                className={cn(plan.highlight && "border-sky-500/50 shadow-[var(--shadow-accent)]")}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <p className="t-label">{plan.name}</p>
                    {plan.highlight && <Badge variant="accent">Popular</Badge>}
                  </div>
                  <p className="t-display-md mt-2">
                    {plan.price}
                    <span className="t-body-sm text-[var(--text-tertiary)]">{plan.period}</span>
                  </p>
                  <p className="t-body-sm mt-2 text-[var(--text-secondary)]">{plan.description}</p>
                </div>
                <div>
                  <ul className="flex flex-col gap-2">
                    {plan.features.map((f) => (
                      <li key={f} className="t-body-sm text-[var(--text-secondary)]">
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    variant={plan.highlight ? "primary" : "outline"}
                    className="mt-5 w-full"
                  >
                    <Link href={ROUTES.auth.register}>Get started</Link>
                  </Button>
                </div>
              </Card>
            </StaggerItem>
          ))}
        </StaggerReveal>

        <Reveal className="mt-20">
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
