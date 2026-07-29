import { X } from "lucide-react";
import type { RankedResult } from "@/features/search/response";
import { bestFor, priceSummary, primaryTradeoff } from "./result-presentation";
import { SEARCH_LANGUAGE } from "./search-language";
import styles from "./search-results.module.css";

export function ResultComparison({
  items,
  onRemove,
}: {
  items: RankedResult[];
  onRemove: (id: string) => void;
}) {
  if (items.length < 2) return null;

  return (
    <section className={styles.comparisonSection} aria-labelledby="comparison-title">
      <div className={styles.comparisonHeading}>
        <div>
          <span>Side by side</span>
          <h2 id="comparison-title">{SEARCH_LANGUAGE.comparison.heading}</h2>
        </div>
        <p>{SEARCH_LANGUAGE.comparison.introduction}</p>
      </div>
      <div className={styles.comparisonTableWrap}>
        <table className={styles.comparisonTable}>
          <thead>
            <tr>
              <th scope="col">What matters</th>
              {items.map((item) => (
                <th scope="col" key={item.entityId}>
                  <span>{item.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(item.entityId)}
                    aria-label={`Remove ${item.name} from comparison`}
                  >
                    <X size={14} aria-hidden />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Best for</th>
              {items.map((item) => <td key={item.entityId}>{bestFor(item)}</td>)}
            </tr>
            <tr>
              <th scope="row">Pricing</th>
              {items.map((item) => <td key={item.entityId}>{priceSummary(item)}</td>)}
            </tr>
            <tr>
              <th scope="row">Independent reviews</th>
              {items.map((item) => (
                <td key={item.entityId}>
                  {item.reviewSummary?.rating == null
                    ? SEARCH_LANGUAGE.reviews.missing
                    : `${item.reviewSummary.rating.toFixed(1)}/5 · ${item.reviewSummary.reviewCount.toLocaleString()}`}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Main tradeoff</th>
              {items.map((item) => <td key={item.entityId}>{primaryTradeoff(item)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
