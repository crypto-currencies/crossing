"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock3, MapPin, Star } from "lucide-react";
import { CrossingProductDemo } from "./crossing-product-demo";
import { CrossingSearch } from "./crossing-search";
import {
  CATEGORY_CARDS,
  PRIORITIES,
  QUERY_REFINEMENTS,
  SEARCH_SETS,
  type Priority,
  type Result,
} from "./crossing-home-data";

function scrollToTop() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
}

export function CrossingHome() {
  const router = useRouter();
  const [query, setQuery] = useState(SEARCH_SETS[0].query);
  const [queryIsSeeded, setQueryIsSeeded] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [setIndex, setSetIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(SEARCH_SETS[0].results[0].id);
  const [compareIds, setCompareIds] = useState<string[]>(["marigold", "frame"]);
  const [priority, setPriority] = useState<Priority>("overall");
  const [demoQuery, setDemoQuery] = useState(SEARCH_SETS[0].query);
  const [demoIntent, setDemoIntent] = useState<string[]>(SEARCH_SETS[0].intent);

  const activeSet = SEARCH_SETS[setIndex];
  const selected = activeSet.results.find((result) => result.id === selectedId) ?? activeSet.results[0];
  const compared = useMemo(
    () => activeSet.results.filter((result) => compareIds.includes(result.id)),
    [activeSet, compareIds],
  );

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const finalQuery = query.trim() || activeSet.query;
    setIsSubmitting(true);
    router.push(`/search?q=${encodeURIComponent(finalQuery)}`);
  }

  function updateQuery(value: string, seeded = false) {
    setQuery(value);
    setQueryIsSeeded(seeded);
    setIsSubmitting(false);
  }

  function switchSet(index: number) {
    const next = SEARCH_SETS[index];
    setSetIndex(index);
    setSelectedId(next.results[0].id);
    setCompareIds(next.results.slice(0, 2).map((result) => result.id));
    setPriority("overall");
    setQuery(next.query);
    setQueryIsSeeded(true);
    setDemoQuery(next.query);
    setDemoIntent(next.intent);
  }

  function chooseSuggestion(value: string, index: number) {
    const next = SEARCH_SETS[index];
    setSetIndex(index);
    setSelectedId(next.results[0].id);
    setCompareIds(next.results.slice(0, 2).map((result) => result.id));
    setPriority("overall");
    setQuery(value);
    setQueryIsSeeded(false);
    setDemoQuery(value);
    setDemoIntent(next.intent);
  }

  function applyRefinement(refinement: (typeof QUERY_REFINEMENTS)[number]) {
    const places = SEARCH_SETS[0];
    setSetIndex(0);
    setSelectedId(refinement.resultId);
    setCompareIds([refinement.resultId, places.results.find((result) => result.id !== refinement.resultId)?.id ?? "frame"]);
    setPriority("overall");
    setQuery(refinement.query);
    setQueryIsSeeded(false);
    setDemoQuery(refinement.query);
    setDemoIntent(refinement.intent);
  }

  function choosePriority(nextPriority: Priority) {
    const recommendedId = activeSet.priorityPicks[nextPriority];
    setPriority(nextPriority);
    setSelectedId(recommendedId);
    setCompareIds((current) => current.includes(recommendedId) ? current : [recommendedId, current[0]].filter(Boolean).slice(0, 2));
  }

  function openResult(result: Result) {
    router.push(`/search?q=${encodeURIComponent(`${demoQuery} ${result.name}`)}`);
  }

  function focusHeroSearch(value: string) {
    updateQuery(value, true);
    scrollToTop();
    window.requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.crossing-search input')?.focus());
  }

  return (
    <div className="crossing-home">
      <section className="crossing-hero">
        {/* Decorations live in their own clipping layer so the hero itself can
            overflow — the search-suggestions dropdown must escape it. */}
        <div className="crossing-hero-bg" aria-hidden="true">
          <div className="crossing-hero-photo" />
          <div className="crossing-hero-orbit" />
        </div>
        <div className="crossing-hero-copy">
          <div className="crossing-kicker"><span className="crossing-kicker-dot" />One search bar. Any kind of decision.</div>
          <h1>Find what<br /><em>holds up.</em></h1>
          <p>Search a service, place, product, or problem. See the options, the tradeoffs, and what actually holds up.</p>
        </div>

        <CrossingSearch
          query={query}
          queryIsSeeded={queryIsSeeded}
          isSubmitting={isSubmitting}
          onQueryChange={updateQuery}
          onChooseSuggestion={chooseSuggestion}
          onSubmit={submitSearch}
        />
      </section>

      <section className="crossing-stage-section" aria-labelledby="stage-title">
        <div className="crossing-section-heading">
          <div><span className="crossing-overline">What one search gives you</span><h2 id="stage-title">Look past the list.</h2></div>
          <p>Change the example, move through the results, check the sources, or compare two.</p>
        </div>

        <CrossingProductDemo
          activeSet={activeSet}
          demoQuery={demoQuery}
          setIndex={setIndex}
          selected={selected}
          onSwitchSet={switchSet}
          onSelect={setSelectedId}
          onOpenResult={openResult}
          searchSets={SEARCH_SETS}
        />
        <p className="crossing-demo-disclaimer">
          Interactive preview with example data — nothing here is saved to your account.
        </p>
      </section>

      <section className="crossing-possibilities" aria-labelledby="possibilities-title">
        <div className="crossing-section-heading compact">
          <div><span className="crossing-overline">Start broad. Add what matters.</span><h2 id="possibilities-title">Ask like a person.</h2></div>
          <p>Crossing reads the whole request. Make it more specific and the shortlist changes with it.</p>
        </div>

        <div className="crossing-query-story">
          <div className="crossing-query-steps" role="group" aria-label="Natural language search examples">
            {QUERY_REFINEMENTS.map((refinement, index) => (
              <button
                key={refinement.query}
                type="button"
                className={demoQuery === refinement.query ? "active" : ""}
                aria-pressed={demoQuery === refinement.query}
                onClick={() => applyRefinement(refinement)}
              >
                <span>0{index + 1}</span><small>{refinement.label}</small><strong>“{refinement.query}”</strong><ArrowRight size={17} />
              </button>
            ))}
          </div>
          <div className="crossing-interpretation-card" aria-live="polite">
            <span>What matters in this search</span>
            <p>{demoQuery}</p>
            <div>{demoIntent.map((intent) => <strong key={intent}>{intent}</strong>)}</div>
            <footer><span>Current pick</span><b>{selected.name}</b><em>{selected.score}</em></footer>
          </div>
        </div>

        <div className="crossing-category-cards">
          {CATEGORY_CARDS.map((card, index) => (
            <button key={card.kicker} type="button" className="crossing-category-card" onClick={() => focusHeroSearch(card.query)}>
              <div className="crossing-category-photo" style={{ backgroundImage: `url(${card.image})` }}><span>0{index + 1}</span></div>
              <div className="crossing-category-copy"><span>{card.kicker}</span><h3>{card.title}</h3><p>“{card.query}”</p><ArrowRight size={20} /></div>
            </button>
          ))}
        </div>
      </section>

      <section className="crossing-compare-section" aria-labelledby="compare-title">
        <div className="crossing-compare-copy">
          <span className="crossing-overline">Side by side</span>
          <h2 id="compare-title">Keep the tradeoffs visible.</h2>
          <p>Change what matters most. The recommendation moves, while the reason and the compromise stay in view.</p>
          <div className="crossing-priority-controls" role="group" aria-label="Recommendation priority">
            {PRIORITIES.map((item) => (
              <button key={item.id} type="button" aria-pressed={priority === item.id} className={priority === item.id ? "active" : ""} onClick={() => choosePriority(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="crossing-priority-result" aria-live="polite"><span>Recommended now</span><strong>{selected.name}</strong><p>{selected.caveat}</p></div>
        </div>

        <div className="crossing-compare-window">
          <div className="crossing-compare-window-head"><span>Current comparison</span><span>{activeSet.label}</span></div>
          <div className="crossing-compare-grid">
            <div className="crossing-compare-labels"><span>Score</span>{selected.facts.map(([label]) => <span key={label}>{label}</span>)}</div>
            {compared.map((result) => (
              <div className={`crossing-compare-column ${result.id === selected.id ? "recommended" : ""}`} key={result.id}>
                <h3>{result.name}{result.id === selected.id ? <small>Pick</small> : null}</h3>
                <strong className="crossing-compare-score">{result.score}</strong>
                {result.facts.map(([label, value]) => <span key={label}>{value}</span>)}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="crossing-closing">
        <div className="crossing-closing-meta"><span><MapPin size={15} />where you are</span><span><Clock3 size={15} />when you need it</span><span><Star size={15} />what matters to you</span></div>
        <h2>Start with a question.</h2>
        <p>Tell Crossing what you need and what would make it a good fit.</p>
        <div className="crossing-closing-actions">
          <button type="button" onClick={() => focusHeroSearch(activeSet.query)}>Search Crossing <ArrowRight size={20} /></button>
          <Link href="/register">Create an account</Link>
        </div>
      </section>
    </div>
  );
}
