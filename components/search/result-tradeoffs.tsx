import { Scale } from "lucide-react";
import type { RankedResult } from "@/features/search/response";
import { SEARCH_LANGUAGE } from "./search-language";
import styles from "./search-results.module.css";

export function ResultTradeoffs({ item }: { item: RankedResult }) {
  return (
    <section className={styles.detailSection} aria-labelledby={`${item.entityId}-tradeoffs`}>
      <div className={styles.detailSectionHeading}>
        <Scale size={16} aria-hidden />
        <h4 id={`${item.entityId}-tradeoffs`}>Tradeoffs</h4>
      </div>
      {item.tradeoffs.length > 0 ? (
        <ul className={styles.detailList}>
          {item.tradeoffs.map((tradeoff) => (
            <li key={tradeoff}>{tradeoff}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.detailMuted}>{SEARCH_LANGUAGE.results.noTradeoff}.</p>
      )}
    </section>
  );
}
