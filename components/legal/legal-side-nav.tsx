"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface LegalSection {
  id: string;
  label: string;
}

interface LegalSideNavProps {
  sections: LegalSection[];
}

export function LegalSideNav({ sections }: LegalSideNavProps) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px" }
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      className="hidden lg:block flex-shrink-0 w-[152px]"
      style={{ position: "sticky", top: "calc(var(--nav-height) + 32px)", alignSelf: "flex-start" }}
      aria-label="Page sections"
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-[14px]">
        Contents
      </p>
      <ul className="flex flex-col gap-[2px]">
        {sections.map((s, i) => (
          <li key={s.id}>
            <Link
              href={`#${s.id}`}
              className={cn(
                "flex items-center gap-[8px] py-[5px] px-[8px] rounded-[var(--radius-md)]",
                "text-[11px] leading-tight transition-all duration-100 group",
                active === s.id
                  ? "text-[var(--text)] bg-[var(--panel-2)]"
                  : "text-[var(--muted)] hover:text-[var(--text-soft)] hover:bg-[var(--panel-2)]"
              )}
            >
              <span
                className={cn(
                  "font-mono text-[8px] flex-shrink-0 w-[16px] transition-colors",
                  active === s.id ? "text-[var(--muted)]" : "opacity-30"
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 truncate">{s.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
