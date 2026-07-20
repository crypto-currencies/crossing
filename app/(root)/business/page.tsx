import Link from "next/link";
import { PageTransition, Reveal, StaggerReveal, StaggerItem } from "@/components/motion";
import { PageHero } from "@/components/marketing/page-hero";
import { Container } from "@/components/layout/container";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

const STATS = [
  { value: "3.2x", label: "more inquiries after listing" },
  { value: "10 min", label: "average setup time" },
  { value: "Free", label: "to get started" },
];

const STEPS = [
  { title: "Create your profile", body: "Add your business, hours, and what makes it worth finding." },
  { title: "Get discovered", body: "Show up when someone nearby searches for what you offer." },
  { title: "Grow from there", body: "Track saves and votes, then upgrade if you want more visibility." },
];

export default function BusinessPage() {
  return (
    <PageTransition>
      <PageHero
        eyebrow="For businesses"
        title="Get found by people already looking"
        subtitle="List your business where people go to find a plumber, a coffee shop, or whatever they need next."
      >
        <Button asChild variant="primary">
          <Link href={ROUTES.auth.register}>Get listed</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={ROUTES.site.businessPricing}>See pricing</Link>
        </Button>
      </PageHero>

      <Container size="lg" className="pb-24">
        <section id="why" className="scroll-mt-28">
          <StaggerReveal className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {STATS.map((stat) => (
              <StaggerItem key={stat.label}>
                <Card shape="wide" className="flex-col items-start gap-2 text-left">
                  <p className="t-display-md text-sky-500">{stat.value}</p>
                  <p className="t-body-sm text-[var(--text-secondary)]">{stat.label}</p>
                </Card>
              </StaggerItem>
            ))}
          </StaggerReveal>
        </section>

        <Reveal className="mt-20 text-center">
          <h2 className="t-display-md">How it works</h2>
        </Reveal>

        <StaggerReveal className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <StaggerItem key={step.title}>
              <Card shape="tile" className="aspect-auto min-h-52">
                <p className="t-label text-sky-500">Step {i + 1}</p>
                <p className="t-heading">{step.title}</p>
                <p className="t-body-sm text-[var(--text-secondary)]">{step.body}</p>
              </Card>
            </StaggerItem>
          ))}
        </StaggerReveal>
      </Container>
    </PageTransition>
  );
}
