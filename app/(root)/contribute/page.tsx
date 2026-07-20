import { PageTransition, Reveal, StaggerReveal, StaggerItem } from "@/components/motion";
import { PageHero } from "@/components/marketing/page-hero";
import { Container } from "@/components/layout/container";
import { Card } from "@/components/ui/card";

const STEPS = [
  { title: "Submit a listing", body: "Found something worth sharing? Add it in a couple minutes." },
  { title: "Vote on what's good", body: "A vote is a quiet nudge that helps the right things surface." },
  { title: "It goes live", body: "Once a moderator checks it over, your submission is public." },
];

const GUIDELINES = [
  { do: true, text: "The link works and the description is accurate." },
  { do: true, text: "It's something you'd actually recommend to a friend." },
  { do: false, text: "No duplicate listings for the same business or tool." },
  { do: false, text: "No listings you have a financial stake in without disclosing it." },
];

export default function ContributePage() {
  return (
    <PageTransition>
      <PageHero
        eyebrow="Contribute"
        title="Help people find good things"
        subtitle="Crossing runs on what people submit and vote on — here's how that works."
      />

      <Container size="lg" className="pb-24">
        <section id="how-it-works" className="scroll-mt-28">
          <Reveal className="mb-8 text-center">
            <h2 className="t-display-md">How it works</h2>
          </Reveal>
          <StaggerReveal className="grid grid-cols-1 gap-5 sm:grid-cols-3">
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
        </section>

        <section id="guidelines" className="mt-20 scroll-mt-28">
          <Reveal className="mb-6 text-center">
            <h2 className="t-display-md">Guidelines</h2>
          </Reveal>
          <div className="mx-auto flex max-w-2xl flex-col gap-1">
            {GUIDELINES.map((item) => (
              <Card key={item.text} shape="row">
                <p className="t-body-sm text-[var(--text-primary)]">{item.text}</p>
                <span className={item.do ? "text-sky-500" : "text-[var(--text-tertiary)]"}>
                  {item.do ? "Do" : "Don't"}
                </span>
              </Card>
            ))}
          </div>
        </section>
      </Container>
    </PageTransition>
  );
}
