import { Star } from "lucide-react";
import type { RankedResult } from "@/features/search/response";
import { SEARCH_LANGUAGE } from "./search-language";
import styles from "./search-results.module.css";

export function ResultReviewSummary({ item }: { item: RankedResult }) {
  const summary = item.reviewSummary;

  if (!summary || summary.rating == null) {
    return (
      <span className={styles.mutedMetric}>
        <Star size={14} aria-hidden />
        {SEARCH_LANGUAGE.reviews.missing}
      </span>
    );
  }

  return (
    <span
      className={styles.reviewMetric}
      aria-label={`${summary.rating.toFixed(1)} out of 5 from ${summary.reviewCount.toLocaleString()} independent reviews`}
    >
      <Star size={14} fill="currentColor" aria-hidden />
      <strong>{summary.rating.toFixed(1)}</strong>
      <span>{summary.reviewCount.toLocaleString()} reviews</span>
    </span>
  );
}
