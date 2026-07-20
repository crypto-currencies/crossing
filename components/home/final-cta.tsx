import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion";
import { ROUTES } from "@/lib/routes";

export function FinalCta() {
  return (
    <section className="px-4 py-24 sm:py-32">
      <Container size="content" className="text-center">
        <Reveal>
          <h2 className="t-display-md">Start finding what&rsquo;s actually good.</h2>
          <p className="t-body mx-auto mt-4 max-w-md text-[var(--text-secondary)]">
            Free to search, free to save, free to change your mind.
          </p>
          <Button asChild variant="primary" size="lg" className="mt-8">
            <Link href={ROUTES.auth.register}>Sign up</Link>
          </Button>
        </Reveal>
      </Container>
    </section>
  );
}
