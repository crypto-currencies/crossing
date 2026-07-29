"use client";

import { useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import type { Result, SearchSet } from "./crossing-home-data";
import styles from "./crossing-product-demo.module.css";

type CrossingProductDemoProps = {
  activeSet: SearchSet;
  demoQuery: string;
  setIndex: number;
  selected: Result;
  onSwitchSet: (index: number) => void;
  onSelect: (id: string) => void;
  onOpenResult: (result: Result) => void;
  searchSets: SearchSet[];
};

export function CrossingProductDemo({
  activeSet,
  demoQuery,
  setIndex,
  selected,
  onSwitchSet,
  onSelect,
  onOpenResult,
  searchSets,
}: CrossingProductDemoProps) {
  const [expandedId, setExpandedId] = useState<string | null>(selected.id);

  function toggleResult(result: Result) {
    onSelect(result.id);
    setExpandedId((current) => (current === result.id ? null : result.id));
  }

  return (
    <div className={styles.demo}>
      <div className={styles.windowBar}>
        <div className={styles.windowDots} aria-hidden><span /><span /><span /></div>
        <div className={styles.address}>crossing.to / search</div>
        <div className={styles.windowStatus}><span /> interactive preview</div>
      </div>

      <div className={styles.demoBody}>
        <div className={styles.demoTopbar}>
          <div className={styles.setTabs} role="group" aria-label="Example search types">
            {searchSets.map((item, index) => (
              <button
                key={item.label}
                type="button"
                aria-pressed={index === setIndex}
                className={index === setIndex ? styles.activeTab : ""}
                onClick={() => {
                  onSwitchSet(index);
                  setExpandedId(item.results[0]?.id ?? null);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <span className={styles.previewEvidence}>
            <ShieldCheck size={14} aria-hidden />
            Sources kept in view
          </span>
        </div>

        <div className={styles.queryBar}>
          <Search size={17} aria-hidden />
          <span>{demoQuery}</span>
          <SlidersHorizontal size={16} aria-hidden />
        </div>

        <div className={styles.answerHeading}>
          <div>
            <span>{activeSet.count}</span>
            <h3>Best matches for your search</h3>
            <p>{activeSet.sourceLine}</p>
          </div>
          <span>Closest matches first</span>
        </div>

        <div className={styles.resultList} aria-label={`${activeSet.label} recommendations`}>
          {activeSet.results.map((result, index) => {
            const expanded = result.id === expandedId;
            return (
              <article className={`${styles.resultRow} ${index === 0 ? styles.topResult : ""}`} key={result.id}>
                <div className={styles.collapsedRow}>
                  <span className={styles.rank}>
                    <span aria-hidden>{index + 1}</span>
                    <span className={styles.srOnly}>Rank {index + 1}</span>
                  </span>
                  <span className={styles.resultMark} aria-hidden>{initials(result.name)}</span>
                  <div className={styles.resultIdentity}>
                    <div>
                      <h4>{result.name}</h4>
                      {index === 0 ? <span>Top pick</span> : null}
                    </div>
                    <p>{result.note}</p>
                  </div>
                  <div className={styles.bestFor}>
                    <span>Best for</span>
                    <strong>{result.verdict}</strong>
                  </div>
                  <div className={styles.resultEvidence}>
                    <strong>{result.meta}</strong>
                    <span><Star size={12} fill="currentColor" aria-hidden /> Independent reviews</span>
                  </div>
                  <button
                    type="button"
                    className={styles.expandButton}
                    aria-expanded={expanded}
                    aria-controls={`home-result-${result.id}`}
                    onClick={() => toggleResult(result)}
                  >
                    Details
                    <ChevronDown className={expanded ? styles.rotated : ""} size={15} aria-hidden />
                  </button>
                </div>

                <div
                  id={`home-result-${result.id}`}
                  className={`${styles.expandedPanel} ${expanded ? styles.expandedPanelOpen : ""}`}
                >
                  {expanded ? (
                    <div className={styles.detailContent}>
                      <section>
                        <span>Why it stands out</span>
                        <p>{result.note}</p>
                        <div className={styles.tagList}>
                          {result.tags.map((tag) => <strong key={tag}>{tag}</strong>)}
                        </div>
                      </section>
                      <section>
                        <span>What reviewers say</span>
                        <p>{activeSet.sourceLine}</p>
                        <small>Product pages and independent sources are labeled separately in live results.</small>
                      </section>
                      <section>
                        <span>Keep in mind</span>
                        <p>{result.caveat}</p>
                        <button type="button" onClick={() => onOpenResult(result)}>
                          Search this option <ExternalLink size={14} aria-hidden />
                        </button>
                      </section>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
