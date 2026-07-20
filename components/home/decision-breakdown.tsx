import { CheckCircle2, XCircle } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/motion";
import { Badge } from "@/components/ui/badge";

const SOURCES = ["Reddit threads", "G2 reviews", "Capterra", "Editorial roundups"];

const TOOLS = [
  {
    name: "Linear",
    good: "Fast, minimal, built for engineering-heavy teams.",
    bad: "Less flexible for non-technical work.",
    recommended: true,
  },
  {
    name: "Notion",
    good: "Doubles as docs, wiki, and planning in one place.",
    bad: "Takes real setup time before it pays off.",
    recommended: false,
  },
  {
    name: "ClickUp",
    good: "Cheapest option once your team grows.",
    bad: "Interface feels cluttered early on.",
    recommended: false,
  },
];

export function DecisionBreakdown() {
  return (
    <section className="px-4 py-20 sm:py-28">
      <Container size="lg">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <p className="t-label text-sky-500">One decision, explained</p>
            <h2 className="t-display-md mt-3">
              Which project management tool should a three-person startup use?
            </h2>
            <p className="t-body mt-5 text-[var(--text-secondary)]">
              For a team this size, speed and simplicity beat flexibility you won&rsquo;t use yet — Linear
              is the pick, and Notion is worth switching to once non-technical work becomes more than
              half of what you do.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {SOURCES.map((s) => (
                <Badge key={s} variant="outline">
                  {s}
                </Badge>
              ))}
            </div>
          </Reveal>

          <Reveal>
            <div className="flex flex-col gap-3">
              {TOOLS.map((tool) => (
                <div
                  key={tool.name}
                  className={
                    "rounded-lg border p-4 " +
                    (tool.recommended
                      ? "border-sky-500/30 bg-sky-500/5"
                      : "border-[var(--border-subtle)] bg-[var(--surface-raised)]")
                  }
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="t-body-sm font-medium text-[var(--text-primary)]">{tool.name}</p>
                    {tool.recommended && <Badge variant="accent">Recommended</Badge>}
                  </div>
                  <p className="t-caption flex items-start gap-1.5">
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-sky-400" />
                    {tool.good}
                  </p>
                  <p className="t-caption mt-1 flex items-start gap-1.5">
                    <XCircle size={13} className="mt-0.5 shrink-0 text-[var(--text-tertiary)]" />
                    {tool.bad}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
