"use client";

import { useState } from "react";
import {
  Bookmark,
  Check,
  ExternalLink,
  Link2,
  ListChecks,
  Share2,
  Sparkles,
} from "lucide-react";
import type { RankedResult } from "@/features/search/response";
import { EvidenceSources } from "./evidence-sources";
import { ResultPriceSummary } from "./result-price-summary";
import { ResultReviewSummary } from "./result-review-summary";
import { ResultTradeoffs } from "./result-tradeoffs";
import {
  pricingVerificationCopy,
  reviewNoteCopy,
  saveActionCopy,
  SEARCH_LANGUAGE,
  type SaveState,
} from "./search-language";
import styles from "./search-results.module.css";

type Props = {
  item: RankedResult;
  comparisonAbove?: RankedResult;
  isAuthenticated: boolean;
  saveState: SaveState;
  onSave: () => void;
};

export function ExpandedResultDetails({
  item,
  comparisonAbove,
  isAuthenticated,
  saveState,
  onSave,
}: Props) {
  const [shareLabel, setShareLabel] = useState("Share");
  const review = item.reviewSummary;

  async function shareResult() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.name, text: `See why Crossing recommends ${item.name}.`, url });
        setShareLabel("Shared");
      } else {
        await navigator.clipboard.writeText(url);
        setShareLabel("Link copied");
      }
    } catch {
      setShareLabel("Share");
    }
  }

  return (
    <div className={styles.expandedInner}>
      <div className={styles.detailGrid}>
        <section className={styles.detailSection} aria-labelledby={`${item.entityId}-why`}>
          <div className={styles.detailSectionHeading}>
            <Sparkles size={16} aria-hidden />
            <h4 id={`${item.entityId}-why`}>Why it stands out</h4>
          </div>
          <p className={styles.detailMuted}>{item.shortReason}</p>
          {review?.praise.length ? (
            <div className={styles.reviewThemes}>
              <span>Common praise</span>
              <ul className={styles.detailList}>
                {review.praise.slice(0, 3).map((praise) => <li key={praise}>{praise}</li>)}
              </ul>
            </div>
          ) : null}
        </section>

        <section className={styles.detailSection} aria-labelledby={`${item.entityId}-strengths`}>
          <div className={styles.detailSectionHeading}>
            <ListChecks size={16} aria-hidden />
            <h4 id={`${item.entityId}-strengths`}>Relevant features</h4>
          </div>
          {item.keyAttributes.length > 0 ? (
            <ul className={styles.strengthList}>
              {item.keyAttributes.map((attribute) => (
                <li key={`${attribute.label}-${attribute.value}`}>
                  <Check size={14} aria-hidden />
                  <span>
                    <strong>{attribute.label}</strong>: {attribute.value}
                    {!attribute.verified ? " · Not confirmed by a linked source" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.detailMuted}>More product details weren’t available.</p>
          )}
        </section>

        <ResultTradeoffs item={item} />
      </div>

      <div className={styles.detailSummary}>
        <section aria-labelledby={`${item.entityId}-pricing`}>
          <h4 id={`${item.entityId}-pricing`}>{SEARCH_LANGUAGE.pricing.heading}</h4>
          <ResultPriceSummary item={item} />
          <p>{pricingVerificationCopy(item)}</p>
        </section>
        <section aria-labelledby={`${item.entityId}-reviews`}>
          <h4 id={`${item.entityId}-reviews`}>{SEARCH_LANGUAGE.reviews.heading}</h4>
          <ResultReviewSummary item={item} />
          <p>{reviewNoteCopy(item)}</p>
        </section>
        <section aria-labelledby={`${item.entityId}-comparison`}>
          <h4 id={`${item.entityId}-comparison`}>How it compares</h4>
          <p className={styles.comparisonCopy}>
            {comparisonAbove
              ? `${item.name} is the next closest match after ${comparisonAbove.name}.`
              : "This is the strongest match for what you asked for."}
          </p>
        </section>
      </div>

      {review?.complaints.length ? (
        <section className={styles.complaintsSection} aria-labelledby={`${item.entityId}-complaints`}>
          <h4 id={`${item.entityId}-complaints`}>Common complaints</h4>
          <ul className={styles.detailList}>
            {review.complaints.slice(0, 4).map((complaint) => <li key={complaint}>{complaint}</li>)}
          </ul>
        </section>
      ) : null}

      <section className={styles.sourcesSection} aria-labelledby={`${item.entityId}-sources`}>
        <div className={styles.sourcesHeading}>
          <div>
            <h4 id={`${item.entityId}-sources`}>{SEARCH_LANGUAGE.sources.heading}</h4>
            <p>{SEARCH_LANGUAGE.sources.introduction}</p>
          </div>
          <span>{item.sourceSummaries.length} linked {item.sourceSummaries.length === 1 ? "source" : "sources"}</span>
        </div>
        <EvidenceSources item={item} />
      </section>

      <div className={styles.detailActions}>
        {item.url ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.primaryAction}>
            Visit official site <ExternalLink size={15} aria-hidden />
          </a>
        ) : null}
        <button type="button" onClick={onSave} disabled={saveState === "saving" || saveState === "saved"}>
          <Bookmark size={15} fill={saveState === "saved" ? "currentColor" : "none"} aria-hidden />
          {saveActionCopy(saveState, isAuthenticated)}
        </button>
        <button type="button" onClick={shareResult}>
          {shareLabel === "Link copied" ? <Link2 size={15} aria-hidden /> : <Share2 size={15} aria-hidden />}
          {shareLabel}
        </button>
        {saveState === "error" ? (
          <span className={styles.saveError} role="status">
            {SEARCH_LANGUAGE.save.error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
