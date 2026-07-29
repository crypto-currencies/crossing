import type { ReactNode } from "react";
import { Compass, SearchX, TriangleAlert, WifiOff } from "lucide-react";
import styles from "./search-results.module.css";

type EmptyStateTone = "clarify" | "unsupported" | "empty" | "error" | "provider";

type Props = {
  tone: EmptyStateTone;
  title: string;
  body: string;
  children?: ReactNode;
};

const ICONS = {
  clarify: Compass,
  unsupported: Compass,
  empty: SearchX,
  error: TriangleAlert,
  provider: WifiOff,
};

export function SearchEmptyState({ tone, title, body, children }: Props) {
  const Icon = ICONS[tone];
  return (
    <section className={styles.emptyState} aria-labelledby={`search-state-${tone}`}>
      <span className={styles.emptyStateIcon} aria-hidden>
        <Icon size={22} />
      </span>
      <div>
        <h2 id={`search-state-${tone}`}>{title}</h2>
        <p>{body}</p>
      </div>
      {children ? <div className={styles.emptyStateActions}>{children}</div> : null}
    </section>
  );
}
