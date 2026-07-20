import type { ReactNode } from "react";
import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/motion";

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function PageHero({ eyebrow, title, subtitle, children }: PageHeroProps) {
  return (
    <section className="px-4 pb-16 pt-4 text-center sm:pb-24">
      <Container size="content">
        <Reveal>
          {eyebrow && <p className="t-label text-sky-500">{eyebrow}</p>}
          <h1 className="t-display-lg mt-2">{title}</h1>
          {subtitle && <p className="t-subheading mx-auto mt-4 max-w-xl">{subtitle}</p>}
          {children && <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{children}</div>}
        </Reveal>
      </Container>
    </section>
  );
}
