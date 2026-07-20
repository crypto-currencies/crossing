"use client";

import { useState } from "react";
import { StaggerReveal, StaggerItem } from "@/components/motion";
import { SearchResultsWindow } from "./windows/search-results-window";
import { ComparisonWindow } from "./windows/comparison-window";
import { RankedAnswerWindow } from "./windows/ranked-answer-window";
import { CollectionWindow } from "./windows/collection-window";
import { SCENE_PLACES } from "./scene-data";

/**
 * A decorative card-stack "echo" — a second, inert surface offset behind a
 * window to read as depth/layering (a stack, not a flat grid item). Purely
 * visual: aria-hidden, no pointer events, never covers real content.
 */
function StackEcho({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute -z-10 hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)]/50 lg:block ${className}`}
    />
  );
}

export function ProductScene() {
  const [selectedId, setSelectedId] = useState(SCENE_PLACES[0].id);

  return (
    <div className="relative mx-auto max-w-7xl px-4 pb-4 pt-10 sm:pt-14 lg:-mt-4">
      <StaggerReveal className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <StaggerItem className="relative lg:col-span-4 lg:mt-10">
          <StackEcho className="inset-0 translate-x-2.5 translate-y-2.5" />
          <SearchResultsWindow selectedId={selectedId} onSelect={setSelectedId} className="relative h-full" />
        </StaggerItem>

        <StaggerItem className="relative lg:col-span-5">
          <StackEcho className="inset-0 translate-x-3 translate-y-3" />
          <RankedAnswerWindow
            selectedId={selectedId}
            onSelect={setSelectedId}
            className="relative h-full border-sky-500/15 shadow-[var(--shadow-accent)]"
          />
        </StaggerItem>

        <StaggerItem className="lg:col-span-3 lg:mt-16">
          <CollectionWindow className="h-full" />
        </StaggerItem>

        <StaggerItem className="lg:col-span-12">
          <ComparisonWindow selectedId={selectedId} onSelect={setSelectedId} />
        </StaggerItem>
      </StaggerReveal>
    </div>
  );
}
