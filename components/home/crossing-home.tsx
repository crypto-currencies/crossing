"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronRight,
  Clock3,
  Command,
  ExternalLink,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
} from "lucide-react";

type Result = {
  id: string;
  name: string;
  meta: string;
  score: string;
  verdict: string;
  note: string;
  tags: string[];
  image: string;
  facts: [string, string][];
};

type SearchSet = {
  label: string;
  query: string;
  count: string;
  sourceLine: string;
  results: Result[];
};

const SEARCH_SETS: SearchSet[] = [
  {
    label: "Places",
    query: "quiet coffee shop with outlets near me",
    count: "12 places",
    sourceLine: "184 reviews · 8 local lists · 23 discussions",
    results: [
      {
        id: "marigold",
        name: "Marigold Coffee",
        meta: "0.4 mi · Nob Hill",
        score: "9.3",
        verdict: "Best fit",
        note: "Long tables, outlets at every bench, and the room stays calm after the morning rush.",
        tags: ["quiet after 10", "many outlets", "good light"],
        image:
          "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=85",
        facts: [
          ["Walk", "8 min"],
          ["Noise", "Low"],
          ["Typical stay", "2.1 hr"],
        ],
      },
      {
        id: "frame",
        name: "Frame Coffee",
        meta: "0.7 mi · Downtown",
        score: "8.8",
        verdict: "Roomiest",
        note: "The most seating of the group, with strong wifi and easy weekday parking.",
        tags: ["spacious", "fast wifi", "parking"],
        image:
          "https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1200&q=85",
        facts: [
          ["Walk", "14 min"],
          ["Noise", "Medium"],
          ["Typical stay", "1.6 hr"],
        ],
      },
      {
        id: "habit",
        name: "Habit Workshop",
        meta: "1.1 mi · Mission",
        score: "8.5",
        verdict: "Best coffee",
        note: "Better espresso than the others, though laptop seating is limited to the back room.",
        tags: ["great espresso", "back room", "limited seats"],
        image:
          "https://images.unsplash.com/photo-1511081692775-05d0f180a065?auto=format&fit=crop&w=1200&q=85",
        facts: [
          ["Walk", "22 min"],
          ["Noise", "Medium"],
          ["Typical stay", "1.2 hr"],
        ],
      },
    ],
  },
  {
    label: "Services",
    query: "same-day bike repair that comes to me",
    count: "9 services",
    sourceLine: "96 reviews · 14 service pages · 11 discussions",
    results: [
      {
        id: "spoke",
        name: "Spoke Mobile Repair",
        meta: "Today · from $65",
        score: "9.1",
        verdict: "Best fit",
        note: "Clear arrival windows, parts quoted before the visit, and the strongest recent feedback.",
        tags: ["same day", "upfront price", "mobile"],
        image:
          "https://images.unsplash.com/photo-1529422643029-d4585747aaf2?auto=format&fit=crop&w=1200&q=85",
        facts: [
          ["Arrival", "2–4 pm"],
          ["Tune-up", "$89"],
          ["Warranty", "30 days"],
        ],
      },
      {
        id: "freewheel",
        name: "Freewheel Workshop",
        meta: "Tomorrow · from $45",
        score: "8.7",
        verdict: "Best value",
        note: "Lower labor rates and excellent wheel work, but pickup is required for larger jobs.",
        tags: ["lower price", "wheel expert", "pickup"],
        image:
          "https://images.unsplash.com/photo-1502744688674-c619d1586c9e?auto=format&fit=crop&w=1200&q=85",
        facts: [
          ["Arrival", "Tomorrow"],
          ["Tune-up", "$69"],
          ["Warranty", "14 days"],
        ],
      },
      {
        id: "chainline",
        name: "Chainline Cycles",
        meta: "Today · from $80",
        score: "8.4",
        verdict: "Fastest",
        note: "The fastest booking in the area, with a higher callout fee and fewer complex repairs.",
        tags: ["90-minute slot", "callout fee", "basic repairs"],
        image:
          "https://images.unsplash.com/photo-1571333250630-f0230c320b6d?auto=format&fit=crop&w=1200&q=85",
        facts: [
          ["Arrival", "90 min"],
          ["Tune-up", "$105"],
          ["Warranty", "30 days"],
        ],
      },
    ],
  },
  {
    label: "Software",
    query: "simple invoicing for a two-person studio",
    count: "18 tools",
    sourceLine: "312 reviews · 7 pricing pages · 36 discussions",
    results: [
      {
        id: "ledgerly",
        name: "Ledgerly",
        meta: "$12/mo · web + mobile",
        score: "9.0",
        verdict: "Best fit",
        note: "Fast invoice setup, sensible recurring billing, and no features the studio has to manage.",
        tags: ["quick setup", "recurring", "simple reports"],
        image:
          "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=85",
        facts: [
          ["Monthly", "$12"],
          ["Seats", "Unlimited"],
          ["Trial", "30 days"],
        ],
      },
      {
        id: "parcel",
        name: "Parcel Books",
        meta: "$9/mo · web",
        score: "8.6",
        verdict: "Lowest price",
        note: "A clean invoice builder at the lowest price, with lighter reporting and no native app.",
        tags: ["low price", "clean templates", "web only"],
        image:
          "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=85",
        facts: [
          ["Monthly", "$9"],
          ["Seats", "3"],
          ["Trial", "14 days"],
        ],
      },
      {
        id: "northstar",
        name: "Northstar Billing",
        meta: "$19/mo · web + desktop",
        score: "8.2",
        verdict: "Most control",
        note: "Deeper reports and estimates for studios that want more control, at the cost of setup time.",
        tags: ["deep reports", "estimates", "more setup"],
        image:
          "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=85",
        facts: [
          ["Monthly", "$19"],
          ["Seats", "5"],
          ["Trial", "14 days"],
        ],
      },
    ],
  },
];

const QUICK_SEARCHES = [
  "a reliable house cleaner",
  "compact camera under $1,000",
  "late-night food nearby",
  "a therapist who takes Aetna",
];

const CATEGORY_CARDS = [
  {
    kicker: "Nearby",
    title: "A place that fits the moment",
    query: "dinner for six, not too loud",
    image:
      "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85",
  },
  {
    kicker: "For hire",
    title: "Someone you can count on",
    query: "electrician available this week",
    image:
      "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=85",
  },
  {
    kicker: "To use",
    title: "The right thing, not fifty tabs",
    query: "noise-canceling headphones for travel",
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=85",
  },
];

export function CrossingHome() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(SEARCH_SETS[0].query);
  const [queryIsSeeded, setQueryIsSeeded] = useState(true);
  const [setIndex, setSetIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(SEARCH_SETS[0].results[0].id);
  const [savedIds, setSavedIds] = useState<string[]>(["marigold"]);
  const [compareIds, setCompareIds] = useState<string[]>(["marigold", "frame"]);

  const activeSet = SEARCH_SETS[setIndex];
  const selected =
    activeSet.results.find((result) => result.id === selectedId) ?? activeSet.results[0];
  const compared = useMemo(
    () => activeSet.results.filter((result) => compareIds.includes(result.id)),
    [activeSet, compareIds],
  );

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const finalQuery = query.trim() || activeSet.query;
    router.push(`/search?q=${encodeURIComponent(finalQuery)}`);
  }

  function switchSet(index: number) {
    const next = SEARCH_SETS[index];
    setSetIndex(index);
    setSelectedId(next.results[0].id);
    setCompareIds(next.results.slice(0, 2).map((result) => result.id));
    setQuery(next.query);
    setQueryIsSeeded(true);
  }

  function seedQuery(value: string, focus = false) {
    setQuery(value);
    setQueryIsSeeded(true);
    if (focus) requestAnimationFrame(() => searchRef.current?.focus());
  }

  function toggleSaved(id: string) {
    setSavedIds((current) =>
      current.includes(id) ? current.filter((savedId) => savedId !== id) : [...current, id],
    );
  }

  function toggleCompare(id: string) {
    setCompareIds((current) => {
      if (current.includes(id)) return current.length > 1 ? current.filter((item) => item !== id) : current;
      return current.length >= 2 ? [current[1], id] : [...current, id];
    });
  }

  return (
    <div className="crossing-home">
      <section className="crossing-hero">
        <div className="crossing-hero-orbit" aria-hidden />
        <div className="crossing-hero-copy">
          <div className="crossing-kicker">
            <span className="crossing-kicker-dot" />
            One search, whatever you need
          </div>
          <h1>
            Find what<br />
            <em>holds up.</em>
          </h1>
          <p>
            Search a service, place, product, or problem. See the options, the tradeoffs, and what
            people consistently point to.
          </p>
        </div>

        <div className="crossing-search-wrap">
          <form className="crossing-search" onSubmit={submitSearch}>
            <Search aria-hidden size={25} />
            <input
              ref={searchRef}
              value={query}
              onFocus={() => {
                if (queryIsSeeded) {
                  setQuery("");
                  setQueryIsSeeded(false);
                }
              }}
              onChange={(event) => {
                setQuery(event.target.value);
                setQueryIsSeeded(false);
              }}
              aria-label="Search Crossing"
              placeholder="What are you looking for?"
            />
            <button type="button" className="crossing-command" onClick={() => searchRef.current?.focus()}>
              <Command size={13} /> K
            </button>
            <button type="submit" className="crossing-search-submit">
              Search <ArrowRight size={18} />
            </button>
          </form>

          <div className="crossing-quick-searches" aria-label="Example searches">
            <span>Try</span>
            {QUICK_SEARCHES.map((item) => (
              <button key={item} type="button" onClick={() => seedQuery(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="crossing-stage-section" aria-labelledby="stage-title">
        <div className="crossing-section-heading">
          <div>
            <span className="crossing-overline">A search, opened up</span>
            <h2 id="stage-title">Look past the list.</h2>
          </div>
          <p>Pick an example, move through the results, save one, or compare two.</p>
        </div>

        <div className="crossing-demo">
          <div className="crossing-window-bar">
            <div className="crossing-window-dots" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <div className="crossing-window-address">crossing.to / search</div>
            <div className="crossing-window-status"><span /> example view</div>
          </div>

          <div className="crossing-demo-body">
            <aside className="crossing-demo-rail">
              <div className="crossing-mini-mark">C</div>
              <p>Search type</p>
              <div className="crossing-set-tabs">
                {SEARCH_SETS.map((item, index) => (
                  <button
                    key={item.label}
                    type="button"
                    className={index === setIndex ? "active" : ""}
                    onClick={() => switchSet(index)}
                  >
                    <span>{item.label}</span>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
              <div className="crossing-rail-note">
                <Sparkles size={15} />
                <span>Change the example to rebuild this view.</span>
              </div>
            </aside>

            <div className="crossing-results-pane">
              <div className="crossing-query-line">
                <Search size={17} />
                <span>{activeSet.query}</span>
                <SlidersHorizontal size={16} />
              </div>
              <div className="crossing-results-meta">
                <span>{activeSet.count}</span>
                <span>{activeSet.sourceLine}</span>
              </div>
              <div className="crossing-result-list">
                {activeSet.results.map((result, index) => {
                  const isSelected = result.id === selected.id;
                  const isCompared = compareIds.includes(result.id);
                  return (
                    <article
                      key={result.id}
                      className={`crossing-result-card ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedId(result.id)}
                    >
                      <div
                        className="crossing-result-image"
                        style={{ backgroundImage: `url(${result.image})` }}
                        role="img"
                        aria-label={`${result.name} preview`}
                      >
                        <span>0{index + 1}</span>
                      </div>
                      <div className="crossing-result-main">
                        <div className="crossing-result-topline">
                          <div>
                            <h3>{result.name}</h3>
                            <p>{result.meta}</p>
                          </div>
                          <strong>{result.score}</strong>
                        </div>
                        <p className="crossing-result-note">{result.note}</p>
                        <div className="crossing-result-actions">
                          <button
                            type="button"
                            className={isCompared ? "on" : ""}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleCompare(result.id);
                            }}
                          >
                            <span>{isCompared && <Check size={11} />}</span> Compare
                          </button>
                          <button
                            type="button"
                            aria-label={savedIds.includes(result.id) ? `Unsave ${result.name}` : `Save ${result.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleSaved(result.id);
                            }}
                          >
                            {savedIds.includes(result.id) ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                            {savedIds.includes(result.id) ? "Saved" : "Save"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <aside className="crossing-inspector">
              <div className="crossing-inspector-head">
                <span>{selected.verdict}</span>
                <strong>{selected.score}</strong>
              </div>
              <h3>{selected.name}</h3>
              <p>{selected.note}</p>
              <div className="crossing-tags">
                {selected.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
              <div className="crossing-facts">
                {selected.facts.map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <div className="crossing-why">
                <span>Why this one</span>
                <p>It matches the full search, not just the category. Repeated positives count more than a single loud review.</p>
              </div>
              <button type="button" className="crossing-open-button">
                Open result <ExternalLink size={15} />
              </button>
            </aside>
          </div>
        </div>
      </section>

      <section className="crossing-possibilities" aria-labelledby="possibilities-title">
        <div className="crossing-section-heading compact">
          <div>
            <span className="crossing-overline">Start anywhere</span>
            <h2 id="possibilities-title">Ask like a person.</h2>
          </div>
          <p>No category tree to learn. Add the details that matter to you.</p>
        </div>
        <div className="crossing-category-cards">
          {CATEGORY_CARDS.map((card, index) => (
            <button
              key={card.kicker}
              type="button"
              className="crossing-category-card"
              onClick={() => {
                seedQuery(card.query);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <div className="crossing-category-photo" style={{ backgroundImage: `url(${card.image})` }}>
                <span>0{index + 1}</span>
              </div>
              <div className="crossing-category-copy">
                <span>{card.kicker}</span>
                <h3>{card.title}</h3>
                <p>“{card.query}”</p>
                <ArrowRight size={20} />
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="crossing-compare-section" aria-labelledby="compare-title">
        <div className="crossing-compare-copy">
          <span className="crossing-overline">Side by side</span>
          <h2 id="compare-title">Keep the tradeoffs visible.</h2>
          <p>
            Crossing pulls the deciding details into one view. Select any two results above and the
            comparison changes with them.
          </p>
        </div>
        <div className="crossing-compare-window">
          <div className="crossing-compare-window-head">
            <span>Current comparison</span>
            <span>{activeSet.label}</span>
          </div>
          <div className="crossing-compare-grid">
            <div className="crossing-compare-labels">
              <span>Score</span>
              {selected.facts.map(([label]) => <span key={label}>{label}</span>)}
              <span>Save</span>
            </div>
            {compared.map((result) => (
              <div className="crossing-compare-column" key={result.id}>
                <h3>{result.name}</h3>
                <strong className="crossing-compare-score">{result.score}</strong>
                {result.facts.map(([, value]) => <span key={value}>{value}</span>)}
                <button type="button" onClick={() => toggleSaved(result.id)}>
                  {savedIds.includes(result.id) ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                  {savedIds.includes(result.id) ? "Saved" : "Save"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="crossing-closing">
        <div className="crossing-closing-meta">
          <span><MapPin size={15} /> where you are</span>
          <span><Clock3 size={15} /> when you need it</span>
          <span><Star size={15} /> what matters to you</span>
        </div>
        <h2>What are you trying to find?</h2>
        <button type="button" onClick={() => { seedQuery(activeSet.query, true); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          Search Crossing <ArrowRight size={20} />
        </button>
      </section>
    </div>
  );
}
