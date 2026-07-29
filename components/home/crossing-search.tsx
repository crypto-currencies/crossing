"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Command, LoaderCircle, Search } from "lucide-react";
import { DISCOVERY_SUGGESTIONS, QUICK_SEARCHES, SEARCH_COVERAGE_NOTE } from "./crossing-home-data";

type CrossingSearchProps = {
  query: string;
  queryIsSeeded: boolean;
  isSubmitting: boolean;
  onQueryChange: (value: string, seeded?: boolean) => void;
  onChooseSuggestion: (query: string, setIndex: number) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function CrossingSearch({
  query,
  queryIsSeeded,
  isSubmitting,
  onQueryChange,
  onChooseSuggestion,
  onSubmit,
}: CrossingSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  const suggestions = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length || queryIsSeeded) return DISCOVERY_SUGGESTIONS.slice(0, 4);

    const matches = DISCOVERY_SUGGESTIONS.filter((item) => {
      const haystack = `${item.label} ${item.query}`.toLowerCase();
      return terms.some((term) => haystack.includes(term));
    });
    return (matches.length ? matches : DISCOVERY_SUGGESTIONS).slice(0, 4);
  }, [query, queryIsSeeded]);

  useEffect(() => {
    function focusSearch(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  function chooseSuggestion(index: number) {
    const suggestion = suggestions[index];
    if (!suggestion) return;
    onChooseSuggestion(suggestion.query, suggestion.setIndex);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestion((current) => {
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const next = current + direction;
        if (next < 0) return suggestions.length - 1;
        if (next >= suggestions.length) return 0;
        return next;
      });
      return;
    }

    if (event.key === "Enter" && suggestionsOpen && activeSuggestion >= 0) {
      event.preventDefault();
      chooseSuggestion(activeSuggestion);
    }
  }

  return (
    <div className="crossing-search-wrap">
      <div
        className="crossing-search-stack"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setSuggestionsOpen(false);
            setActiveSuggestion(-1);
          }
        }}
      >
        <form
          className="crossing-search"
          data-state={isSubmitting ? "loading" : suggestionsOpen ? "active" : "idle"}
          aria-busy={isSubmitting}
          onSubmit={onSubmit}
        >
          <Search aria-hidden size={25} />
          <input
            ref={inputRef}
            value={query}
            onFocus={() => {
              if (queryIsSeeded) onQueryChange("", false);
              setSuggestionsOpen(true);
            }}
            onChange={(event) => {
              onQueryChange(event.target.value, false);
              setSuggestionsOpen(true);
              setActiveSuggestion(-1);
            }}
            onKeyDown={handleKeyDown}
            aria-label="Search Crossing"
            aria-autocomplete="list"
            aria-controls="crossing-search-suggestions"
            aria-expanded={suggestionsOpen}
            aria-activedescendant={activeSuggestion >= 0 ? `crossing-suggestion-${activeSuggestion}` : undefined}
            role="combobox"
            autoComplete="off"
            placeholder="What are you looking for?"
          />
          <button type="button" className="crossing-command" onClick={() => inputRef.current?.focus()} aria-label="Focus search">
            <Command size={13} /> K
          </button>
          <button type="submit" className="crossing-search-submit" disabled={isSubmitting}>
            <span>{isSubmitting ? "Searching" : "Search"}</span>
            {isSubmitting ? <LoaderCircle className="crossing-search-spinner" size={18} /> : <ArrowRight size={18} />}
          </button>
        </form>

        {suggestionsOpen ? (
          <div className="crossing-suggestions" id="crossing-search-suggestions" role="listbox" aria-label="Discovery suggestions">
            <div className="crossing-suggestions-label">Suggestions</div>
            {suggestions.map((item, index) => (
              <button
                key={item.query}
                id={`crossing-suggestion-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeSuggestion}
                className={index === activeSuggestion ? "active" : ""}
                onMouseEnter={() => setActiveSuggestion(index)}
                onClick={() => chooseSuggestion(index)}
              >
                <span><Search size={14} />{item.query}</span>
                <small>{item.label}</small>
                <ArrowRight size={14} />
              </button>
            ))}
            <div className="crossing-suggestions-hint"><span>↑↓ move</span><span>Enter select</span><span>Esc close</span></div>
          </div>
        ) : null}
      </div>

      <div className="crossing-quick-searches" aria-label="Example searches">
        <span>Try</span>
        {QUICK_SEARCHES.map((item) => (
          <button key={item} type="button" onClick={() => onQueryChange(item, true)}>
            {item}
          </button>
        ))}
      </div>
      <p className="crossing-coverage-note">{SEARCH_COVERAGE_NOTE}</p>
      <p className="sr-only" aria-live="polite">{isSubmitting ? `Searching for ${query}` : ""}</p>
    </div>
  );
}
