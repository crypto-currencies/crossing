import { CircleDollarSign } from "lucide-react";
import type { RankedResult } from "@/features/search/response";
import { priceSummary } from "./result-presentation";
import styles from "./search-results.module.css";

export function ResultPriceSummary({ item }: { item: RankedResult }) {
  return (
    <span className={styles.priceMetric}>
      <CircleDollarSign size={14} aria-hidden />
      {priceSummary(item)}
    </span>
  );
}
