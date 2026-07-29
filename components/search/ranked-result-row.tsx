"use client";

import {
  Bookmark,
  Check,
  ChevronDown,
  ExternalLink,
  Leaf,
  Scale,
  ShieldCheck,
} from "lucide-react";
import type { RankedResult } from "@/features/search/response";
import { ExpandedResultDetails } from "./expanded-result-details";
import { ResultPriceSummary } from "./result-price-summary";
import { ResultReviewSummary } from "./result-review-summary";
import {
  bestFor,
  evidenceStrengthLabel,
  primaryReason,
  primaryTradeoff,
  resultInitials,
} from "./result-presentation";
import {
  informationFreshnessCopy,
  saveActionCopy,
  saveAriaLabel,
  SEARCH_LANGUAGE,
  type SaveState,
} from "./search-language";
import styles from "./search-results.module.css";

type Props = {
  item: RankedResult;
  comparisonAbove?: RankedResult;
  expanded: boolean;
  compared: boolean;
  isAuthenticated: boolean;
  saveState: SaveState;
  onToggle: () => void;
  onToggleCompare: () => void;
  onSave: () => void;
};

export function RankedResultRow({
  item,
  comparisonAbove,
  expanded,
  compared,
  isAuthenticated,
  saveState,
  onToggle,
  onToggleCompare,
  onSave,
}: Props) {
  const panelId = `result-details-${item.entityId}`;

  return (
    <article className={`${styles.resultRow} ${item.rank === 1 ? styles.firstResult : ""}`}>
      <div className={styles.collapsedRow}>
        <div className={styles.rankCell}>
          <span aria-hidden>{item.rank}</span>
          <span className={styles.visuallyHidden}>Result {item.rank}</span>
        </div>

        <div className={styles.identityCell}>
          <span className={styles.logoMark} aria-hidden>
            {resultInitials(item.name)}
          </span>
          <div>
            <div className={styles.nameLine}>
              <h3>{item.name}</h3>
              {item.rank === 1 ? (
                <span className={styles.topPick}>
                  <Leaf size={12} aria-hidden />
                  {SEARCH_LANGUAGE.results.topPick}
                </span>
              ) : null}
            </div>
            <p>{primaryReason(item)}</p>
          </div>
        </div>

        <div className={styles.bestForCell}>
          <span>{SEARCH_LANGUAGE.results.bestFor}</span>
          <strong>{bestFor(item)}</strong>
        </div>

        <div className={styles.metricsCell}>
          <ResultPriceSummary item={item} />
          <ResultReviewSummary item={item} />
          <span className={styles.freshnessMetric}>
            <ShieldCheck size={14} aria-hidden />
            {informationFreshnessCopy(item)}
          </span>
        </div>

        <div className={styles.tradeoffCell}>
          <span>
            <Scale size={14} aria-hidden />
            {SEARCH_LANGUAGE.results.tradeoff}
          </span>
          <p>{primaryTradeoff(item)}</p>
          <small>{evidenceStrengthLabel(item)}</small>
        </div>

        <div className={styles.rowActions}>
          <button
            type="button"
            className={`${styles.iconAction} ${compared ? styles.selectedAction : ""}`}
            aria-pressed={compared}
            onClick={onToggleCompare}
          >
            <Check size={15} aria-hidden />
            <span>Compare</span>
          </button>
          <button
            type="button"
            className={`${styles.iconAction} ${saveState === "saved" ? styles.selectedAction : ""}`}
            onClick={onSave}
            disabled={saveState === "saving" || saveState === "saved"}
            aria-label={saveAriaLabel(item, saveState, isAuthenticated)}
          >
            <Bookmark size={15} fill={saveState === "saved" ? "currentColor" : "none"} aria-hidden />
            <span>{saveActionCopy(saveState, isAuthenticated)}</span>
          </button>
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.iconAction}
              aria-label={`Visit ${item.name} official site in a new tab`}
            >
              <ExternalLink size={15} aria-hidden />
              <span>Visit</span>
            </a>
          ) : null}
          <button
            type="button"
            className={styles.expandAction}
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={onToggle}
          >
            {expanded ? "Less" : "Details"}
            <ChevronDown className={expanded ? styles.rotated : ""} size={16} aria-hidden />
          </button>
        </div>
      </div>

      <div id={panelId} className={`${styles.expandedPanel} ${expanded ? styles.expandedPanelOpen : ""}`}>
        {expanded ? (
          <ExpandedResultDetails
            item={item}
            comparisonAbove={comparisonAbove}
            isAuthenticated={isAuthenticated}
            saveState={saveState}
            onSave={onSave}
          />
        ) : null}
      </div>
    </article>
  );
}
