"use client";

import type { RankedResult } from "@/features/search/response";
import { RankedResultRow } from "./ranked-result-row";
import { resultListSummaryCopy, SEARCH_LANGUAGE, type SaveState } from "./search-language";
import styles from "./search-results.module.css";

type Props = {
  items: RankedResult[];
  expandedIds: Set<string>;
  compareIds: Set<string>;
  isAuthenticated: boolean;
  saveStates: Record<string, SaveState>;
  onToggleExpanded: (id: string) => void;
  onToggleCompare: (id: string) => void;
  onSave: (item: RankedResult) => void;
};

export function RankedResultList({
  items,
  expandedIds,
  compareIds,
  isAuthenticated,
  saveStates,
  onToggleExpanded,
  onToggleCompare,
  onSave,
}: Props) {
  return (
    <section aria-labelledby="search-results-title">
      <div className={styles.listHeading}>
        <h2 id="search-results-title">{SEARCH_LANGUAGE.results.listHeading}</h2>
        <p>{resultListSummaryCopy(items.length)}</p>
      </div>
      <div className={styles.resultList}>
        {items.map((item, index) => (
          <RankedResultRow
            key={item.entityId}
            item={item}
            comparisonAbove={index > 0 ? items[index - 1] : undefined}
            expanded={expandedIds.has(item.entityId)}
            compared={compareIds.has(item.entityId)}
            isAuthenticated={isAuthenticated}
            saveState={saveStates[item.entityId] ?? "idle"}
            onToggle={() => onToggleExpanded(item.entityId)}
            onToggleCompare={() => onToggleCompare(item.entityId)}
            onSave={() => onSave(item)}
          />
        ))}
      </div>
    </section>
  );
}
