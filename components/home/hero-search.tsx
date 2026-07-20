"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { ease } from "@/lib/motion";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  { category: "Software", phrase: "Compare coding tools" },
  { category: "Local", phrase: "Find a coffee shop near me" },
  { category: "Products", phrase: "Best headphones under $200" },
  { category: "Communities", phrase: "Find a Discord for indie devs" },
  { category: "Games", phrase: "Find a Minecraft server" },
  { category: "Services", phrase: "Find a reliable moving company" },
  { category: "Places", phrase: "Best casual restaurants nearby" },
] as const;

const ROTATE_MS = 3200;
const FADE_MS = 220;

export function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [exampleIndex, setExampleIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  // Placeholder rotation pauses entirely once the user starts typing.
  useEffect(() => {
    if (query !== "") return;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setExampleIndex((i) => (i + 1) % EXAMPLES.length);
        setVisible(true);
      }, FADE_MS);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [query]);

  function submitQuery(q: string) {
    router.push(`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitQuery(query || EXAMPLES[exampleIndex].phrase);
  }

  function onCategoryClick(index: number) {
    setVisible(false);
    setTimeout(() => {
      setExampleIndex(index);
      setVisible(true);
    }, FADE_MS);
  }

  const example = EXAMPLES[exampleIndex];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
      <div className="hero-search-shell w-full">
        <div className="halo halo-bloom" />
        <div className="halo halo-inner" />

        <form onSubmit={onSubmit} className="search-surface w-full rounded-full">
          <div className="relative flex h-[68px] items-center rounded-full sm:h-20">
            <Search size={20} className="pointer-events-none absolute left-7 text-[var(--text-tertiary)]" />

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search Crossing"
              className="h-full w-full rounded-full bg-transparent pl-16 pr-[76px] text-base text-[var(--text-primary)] outline-none sm:pr-20 sm:text-lg"
            />

            {query === "" && (
              <div aria-hidden className="pointer-events-none absolute left-16 right-20 text-left sm:right-24">
                <motion.span
                  animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : -4 }}
                  transition={{ duration: FADE_MS / 1000, ease: ease.out }}
                  className="block truncate text-base text-[var(--text-tertiary)] sm:text-lg"
                >
                  {example.phrase}
                </motion.span>
              </div>
            )}

            <button
              type="submit"
              aria-label="Search"
              className="absolute right-2.5 flex h-12 w-12 items-center justify-center rounded-full bg-sky-500 text-black-950 shadow-[inset_0_1px_0_rgb(255_255_255_/_25%)] transition-all duration-200 ease-out hover:bg-sky-400 active:scale-95 sm:h-14 sm:w-14"
            >
              <Search size={18} />
            </button>
          </div>
        </form>
      </div>

      <div className="mt-5 flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-1.5">
        {EXAMPLES.map((ex, i) => {
          const active = i === exampleIndex && query === "";
          return (
            <span key={ex.category} className="flex items-center">
              {i > 0 && <span className="px-1.5 text-[var(--text-tertiary)]/30 select-none">&middot;</span>}
              <button
                type="button"
                onClick={() => onCategoryClick(i)}
                aria-pressed={active}
                className={cn(
                  "rounded px-0.5 text-sm transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60",
                  active ? "text-sky-400" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                )}
              >
                {ex.category}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
