import Link from "next/link";
import { Wrench, Coffee, HeartPulse, Car, Laptop, Briefcase, Dumbbell, Scissors } from "lucide-react";
import { Container } from "@/components/layout/container";
import { SectionHeader } from "@/components/marketing/section-header";
import { StaggerReveal, StaggerItem } from "@/components/motion";
import { ROUTES } from "@/lib/routes";

const CATEGORIES = [
  { label: "Home services", slug: "home-services", icon: Wrench },
  { label: "Food & drink", slug: "food-drink", icon: Coffee },
  { label: "Health & wellness", slug: "health-wellness", icon: HeartPulse },
  { label: "Auto & repair", slug: "auto-repair", icon: Car },
  { label: "Tech & tools", slug: "tech-tools", icon: Laptop },
  { label: "Professional", slug: "professional", icon: Briefcase },
  { label: "Fitness", slug: "fitness", icon: Dumbbell },
  { label: "Beauty", slug: "beauty", icon: Scissors },
];

export function CategoryGrid() {
  return (
    <section className="px-4 py-20 sm:py-28">
      <Container size="lg">
        <SectionHeader eyebrow="Browse" title="Browse by category" />

        <StaggerReveal className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {CATEGORIES.map(({ label, slug, icon: Icon }) => (
            <StaggerItem key={slug}>
              <Link
                href={ROUTES.discovery.category(slug)}
                className="group flex flex-col items-center justify-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 text-center transition-all duration-150 ease-out hover:scale-[1.02] hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
              >
                <Icon size={22} className="text-[var(--text-tertiary)] transition-colors duration-150 group-hover:text-sky-500" />
                <p className="t-label">{label}</p>
              </Link>
            </StaggerItem>
          ))}
        </StaggerReveal>
      </Container>
    </section>
  );
}
