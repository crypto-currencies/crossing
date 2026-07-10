import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="w-full">
      <section
        className="relative flex items-center justify-center overflow-hidden px-[var(--page-gutter)]"
        style={{ minHeight: "calc(100svh - var(--topbar-height))" }}
      >
        <div className="mx-auto flex max-w-[560px] flex-col items-center text-center">
          <p className="mb-[16px] text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Crossing.dev
          </p>
          <h1
            className="mb-[20px]"
            style={{
              fontSize:      "clamp(32px, 5vw, 56px)",
              fontWeight:    800,
              lineHeight:    1.02,
              letterSpacing: "-0.03em",
              color:         "var(--text)",
            }}
          >
            Find the things worth your time.
          </h1>
          <p className="mb-[30px] max-w-[420px] text-[14px] leading-[1.7] text-[var(--text-soft)]">
            Crossing.dev is a discovery platform for products, services, tools,
            and communities. This foundation is still being built out.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-[10px]">
            <Button variant="primary" size="lg" asChild>
              <Link href="/register">
                Create an account <ArrowRight className="size-[14px]" />
              </Link>
            </Button>
            <Button variant="ghost" size="lg" asChild>
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
