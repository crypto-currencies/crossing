import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/layout/container";
import { SectionHeader } from "@/components/marketing/section-header";
import { StaggerReveal, StaggerItem } from "@/components/motion";

function Sparkline() {
  return (
    <svg viewBox="0 0 100 32" className="h-8 w-24 shrink-0" preserveAspectRatio="none">
      <polyline
        points="0,26 15,22 30,24 45,14 60,16 75,6 100,4"
        fill="none"
        stroke="var(--color-sky-500)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrendingStrip() {
  return (
    <section className="px-4 py-20 sm:py-28">
      <Container size="lg">
        <SectionHeader eyebrow="Trending" title="What people are finding this week" />

        <StaggerReveal className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <StaggerItem className="sm:col-span-2">
            <Card shape="wide" className="h-full">
              <Sparkline />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="t-body-sm text-[var(--text-primary)]">Corner Press Coffee</p>
                  <Badge variant="outline">Coffee shop</Badge>
                </div>
                <p className="t-caption mt-1">Locals love the cold brew.</p>
              </div>
              <p className="t-display-md text-sky-500">9.1</p>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card shape="tall" className="h-full">
              <div>
                <Badge variant="outline">Tool</Badge>
                <p className="t-heading mt-3">Ledger</p>
              </div>
              <div>
                <p className="t-caption mb-2">Invoicing without the busywork.</p>
                <p className="t-display-md text-sky-500">8.9</p>
              </div>
            </Card>
          </StaggerItem>

          <StaggerItem className="sm:col-span-2 lg:col-span-3">
            <div className="flex flex-col gap-1">
              <Card shape="row">
                <div className="flex items-center gap-3">
                  <span className="t-body-sm">Northside Bike Repair</span>
                  <Badge variant="outline">Repair</Badge>
                </div>
                <span className="t-body-sm text-sky-500">8.7</span>
              </Card>
              <Card shape="row">
                <div className="flex items-center gap-3">
                  <span className="t-body-sm">Bright Line Electric</span>
                  <Badge variant="outline">Electrician</Badge>
                </div>
                <span className="t-body-sm text-sky-500">9.0</span>
              </Card>
            </div>
          </StaggerItem>
        </StaggerReveal>
      </Container>
    </section>
  );
}
