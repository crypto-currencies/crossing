import { Trophy } from "lucide-react";
import { WindowShell } from "./window-shell";
import { SCENE_PLACES, findPlace } from "../scene-data";
import { cn } from "@/lib/utils";

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export function RankedAnswerWindow({ selectedId, onSelect, className }: Props) {
  const place = findPlace(selectedId);
  const alternatives = SCENE_PLACES.filter((p) => p.id !== selectedId);

  return (
    <WindowShell icon={Trophy} title="Ranked answer" subtitle="The one worth choosing" className={className}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="t-heading text-[var(--text-primary)]">{place.name}</p>
            <p className="t-body-sm text-[var(--text-secondary)]">{place.location}</p>
          </div>
          <p className="t-display-md shrink-0 text-sky-400">{place.score}</p>
        </div>

        <p className="t-body-sm text-[var(--text-secondary)]">{place.reason}</p>

        <div className="flex flex-wrap gap-1.5">
          {place.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400"
            >
              {tag}
            </span>
          ))}
        </div>

        <p className="t-caption">
          {place.reviews.toLocaleString()} reviews across {place.sourceCount} sources · {place.caveat}
        </p>

        <div className="border-t border-[var(--border-subtle)] pt-3">
          <p className="t-caption mb-2">Also considered</p>
          <div className="flex flex-wrap gap-2">
            {alternatives.map((alt) => (
              <button
                key={alt.id}
                type="button"
                onClick={() => onSelect(alt.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60",
                  "border-[var(--border-default)] text-[var(--text-tertiary)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
                )}
              >
                {alt.name.split(" ")[0]} · {alt.score}
              </button>
            ))}
          </div>
        </div>
      </div>
    </WindowShell>
  );
}
