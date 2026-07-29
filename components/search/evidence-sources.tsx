import { ExternalLink, FileCheck2, MessagesSquare, Newspaper, Star } from "lucide-react";
import type { RankedResult, ReviewAttribution, SourceSummary } from "@/features/search/response";
import { checkedDate } from "./result-presentation";
import {
  SEARCH_LANGUAGE,
  sourceFactLabel,
  sourceKindLabel,
} from "./search-language";
import styles from "./search-results.module.css";

type DisplaySource = {
  label: string;
  url: string;
  kind: SourceSummary["kind"];
  retrievedAt: string;
  attribution?: ReviewAttribution;
};

export function EvidenceSources({ item }: { item: RankedResult }) {
  const sources = displaySources(item);

  if (sources.length === 0) {
    return <p className={styles.detailMuted}>{SEARCH_LANGUAGE.sources.missing}</p>;
  }

  return (
    <div className={styles.sourceList}>
      {sources.map((source) => {
        const attribution = source.attribution;
        const rating =
          attribution?.rating != null && attribution.ratingScale
            ? `${attribution.rating.toFixed(1)}/${attribution.ratingScale}`
            : null;

        return (
          <article className={styles.sourceRow} key={`${source.kind}-${source.url}`}>
            <span className={styles.sourceIcon} aria-hidden>
              {source.kind === "official" ? (
                <FileCheck2 size={16} />
              ) : source.kind === "editorial" ? (
                <Newspaper size={16} />
              ) : (
                <MessagesSquare size={16} />
              )}
            </span>
            <span className={styles.sourceCopy}>
              <strong>{source.label}</strong>
              <small>
                {sourceKindLabel(source.kind)} · Checked {checkedDate(source.retrievedAt)}
              </small>
              {attribution?.requiredText ? <small>{attribution.requiredText}</small> : null}
            </span>
            {rating ? (
              <span className={styles.sourceRating}>
                <Star size={13} fill="currentColor" aria-hidden />
                {rating}
                {attribution && attribution.reviewCount > 0
                  ? ` · ${attribution.reviewCount.toLocaleString()}`
                  : ""}
              </span>
            ) : (
              <span className={styles.sourceFact}>
                {sourceFactLabel(source.kind)}
              </span>
            )}
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${source.label} source for ${item.name} in a new tab`}
            >
              Open source <ExternalLink size={13} aria-hidden />
            </a>
          </article>
        );
      })}
    </div>
  );
}

function displaySources(item: RankedResult): DisplaySource[] {
  const attributionByUrl = new Map(
    (item.reviewSummary?.attributions ?? []).map((attribution) => [attribution.sourceUrl, attribution]),
  );
  const sources: DisplaySource[] = item.sourceSummaries.map((source) => ({
    ...source,
    ...(attributionByUrl.get(source.url) ? { attribution: attributionByUrl.get(source.url) } : {}),
  }));
  const knownUrls = new Set(sources.map((source) => source.url));

  for (const attribution of item.reviewSummary?.attributions ?? []) {
    if (knownUrls.has(attribution.sourceUrl)) continue;
    sources.push({
      label: attribution.providerName,
      url: attribution.sourceUrl,
      kind: "independent",
      retrievedAt: attribution.retrievedAt,
      attribution,
    });
  }

  return sources;
}
