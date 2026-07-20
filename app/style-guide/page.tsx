import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/layout/container";
import { Stack } from "@/components/layout/grid";

const colorGroups: { label: string; stops: [string, string][] }[] = [
  {
    label: "black — background surfaces",
    stops: [
      ["950", "var(--color-black-950)"],
      ["900", "var(--color-black-900)"],
      ["850", "var(--color-black-850)"],
      ["800", "var(--color-black-800)"],
      ["700", "var(--color-black-700)"],
      ["600", "var(--color-black-600)"],
      ["500", "var(--color-black-500)"],
      ["400", "var(--color-black-400)"],
      ["300", "var(--color-black-300)"],
      ["200", "var(--color-black-200)"],
      ["100", "var(--color-black-100)"],
    ],
  },
  {
    label: "sky — primary accent",
    stops: [
      ["50", "var(--color-sky-50)"],
      ["100", "var(--color-sky-100)"],
      ["200", "var(--color-sky-200)"],
      ["300", "var(--color-sky-300)"],
      ["400", "var(--color-sky-400)"],
      ["500", "var(--color-sky-500)"],
      ["600", "var(--color-sky-600)"],
      ["700", "var(--color-sky-700)"],
      ["800", "var(--color-sky-800)"],
      ["900", "var(--color-sky-900)"],
    ],
  },
  {
    label: "navy — secondary accent",
    stops: [
      ["900", "var(--color-navy-900)"],
      ["800", "var(--color-navy-800)"],
      ["700", "var(--color-navy-700)"],
      ["600", "var(--color-navy-600)"],
      ["500", "var(--color-navy-500)"],
      ["400", "var(--color-navy-400)"],
      ["300", "var(--color-navy-300)"],
    ],
  },
  {
    label: "white — text / foreground",
    stops: [
      ["950", "var(--color-white-950)"],
      ["900", "var(--color-white-900)"],
      ["700", "var(--color-white-700)"],
      ["500", "var(--color-white-500)"],
      ["300", "var(--color-white-300)"],
      ["100", "var(--color-white-100)"],
    ],
  },
];

const radii = [
  ["sm", "8px"],
  ["md", "12px"],
  ["lg", "16px"],
  ["xl", "24px"],
  ["2xl", "32px"],
  ["full", "999px"],
] as const;

const spacing = [
  ["1", "4px"],
  ["2", "8px"],
  ["3", "12px"],
  ["4", "16px"],
  ["6", "24px"],
  ["8", "32px"],
  ["12", "48px"],
  ["16", "64px"],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--border-subtle)] py-12 first:border-none first:pt-0">
      <h2 className="t-label mb-6 uppercase tracking-wider text-[var(--text-tertiary)]">{title}</h2>
      {children}
    </section>
  );
}

export default function StyleGuidePage() {
  return (
    <div className="min-h-screen bg-[var(--surface-base)] py-16 text-[var(--text-primary)]">
      <Container size="lg">
        <Stack gap={2}>
          <p className="t-label text-sky-500">Design system</p>
          <h1 className="t-display-lg">Crossing style guide</h1>
          <p className="t-subheading max-w-xl">
            Colors, type, radius, and components — the tokens every page on the site draws from.
          </p>
        </Stack>

        <Section title="Color">
          <Stack gap={8}>
            {colorGroups.map((group) => (
              <div key={group.label}>
                <p className="t-body-sm mb-3 text-[var(--text-secondary)]">{group.label}</p>
                <div className="flex flex-wrap gap-3">
                  {group.stops.map(([stop, value]) => (
                    <div key={stop} className="w-20">
                      <div
                        className="h-16 rounded-md border border-[var(--border-subtle)]"
                        style={{ background: value }}
                      />
                      <p className="t-caption mt-1.5">{stop}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Stack>
        </Section>

        <Section title="Type scale">
          <Stack gap={5}>
            <p className="t-display-xl">Display XL</p>
            <p className="t-display-lg">Display large</p>
            <p className="t-display-md">Display medium</p>
            <p className="t-heading">Heading</p>
            <p className="t-subheading">Subheading — a supporting line under a headline.</p>
            <p className="t-body">Body — the default paragraph size used for most copy on the site.</p>
            <p className="t-body-sm">Body small — secondary copy, dense lists, metadata.</p>
            <p className="t-label uppercase tracking-wide">Label</p>
            <p className="t-caption">Caption — timestamps, fine print.</p>
            <p className="t-mono">t-mono — 04f3a9e2, user_812</p>
          </Stack>
        </Section>

        <Section title="Radius">
          <div className="flex flex-wrap gap-6">
            {radii.map(([name, value]) => (
              <div key={name} className="text-center">
                <div
                  className="h-16 w-16 border border-[var(--border-default)] bg-[var(--surface-raised)]"
                  style={{ borderRadius: value }}
                />
                <p className="t-caption mt-1.5">
                  {name} · {value}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Spacing">
          <div className="flex flex-wrap items-end gap-4">
            {spacing.map(([name, value]) => (
              <div key={name} className="text-center">
                <div className="h-2 rounded-sm bg-sky-500" style={{ width: value }} />
                <p className="t-caption mt-1.5">
                  {name} · {value}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary">Sign up</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link button</Button>
            <Button variant="primary" size="sm">
              Small
            </Button>
            <Button variant="primary" size="lg">
              Large
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Default</Badge>
            <Badge variant="accent">Accent</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        </Section>

        <Section title="Card shapes">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card shape="tile">
              <div className="h-10 w-10 rounded-md bg-sky-500/15" />
              <p className="t-label">Tile</p>
              <p className="t-caption">Categories, icon grids</p>
            </Card>
            <Card shape="tall">
              <div>
                <p className="t-label">Tall</p>
                <p className="t-caption">Ranked results, listings</p>
              </div>
              <p className="t-display-md">#1</p>
            </Card>
            <Card shape="wide" className="sm:col-span-2 lg:col-span-2">
              <div className="t-display-md text-sky-500">12.4K</div>
              <div>
                <p className="t-label">Wide</p>
                <p className="t-caption">Summary stats, comparisons</p>
              </div>
            </Card>
            <Card shape="row" className="sm:col-span-2 lg:col-span-4">
              <p className="t-body-sm">Row — minimal, text-only</p>
              <p className="t-caption">Dense lists, settings</p>
            </Card>
          </div>
        </Section>
      </Container>
    </div>
  );
}
