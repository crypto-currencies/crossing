import { SlidersHorizontal } from "lucide-react";
import { SEARCH_LANGUAGE } from "./search-language";
import styles from "./search-results.module.css";

export type ActivePreference = {
  id: string;
  label: string;
};

type Props = {
  categoryName: string;
  preferences: ActivePreference[];
  compareCount: number;
  onRefine: () => void;
};

export function SearchRefinementBar({
  categoryName,
  preferences,
  compareCount,
  onRefine,
}: Props) {
  return (
    <div className={styles.refinementBar} aria-label="Search preferences">
      <div className={styles.preferenceScroller}>
        <span className={styles.categoryChip}>{categoryName}</span>
        {preferences.map((preference) => (
          <span key={preference.id} className={styles.preferenceChip}>
            {preference.label}
          </span>
        ))}
        {preferences.length === 0 ? (
          <span className={styles.noPreferences}>No extra preferences</span>
        ) : null}
      </div>
      <div className={styles.refinementActions}>
        {compareCount > 0 ? <span>{compareCount} selected to compare</span> : null}
        <button type="button" onClick={onRefine}>
          <SlidersHorizontal size={15} aria-hidden />
          {SEARCH_LANGUAGE.search.refine}
        </button>
      </div>
    </div>
  );
}
