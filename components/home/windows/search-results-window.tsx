import { Search } from "lucide-react";
import { WindowShell } from "./window-shell";
import { SCENE_PLACES, SCENE_QUERY, type ScenePlace } from "../scene-data";
import { cn } from "@/lib/utils";

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export function SearchResultsWindow({ selectedId, onSelect, className }: Props) {
  return (
    <WindowShell icon={Search} title="Search" subtitle={`“${SCENE_QUERY}”`} className={className}>
      <ul className="flex flex-col gap-1.5">
        {SCENE_PLACES.map((place: ScenePlace, i) => {
          const active = place.id === selectedId;
          return (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => onSelect(place.id)}
                aria-pressed={active}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60",
                  active ? "bg-sky-500/10 ring-1 ring-inset ring-sky-500/30" : "hover:bg-white-100/5"
                )}
              >
                <span
                  className={cn(
                    "t-mono flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs",
                    active ? "bg-sky-500 text-black-950" : "bg-black-600 text-[var(--text-tertiary)]"
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="t-body-sm block truncate text-[var(--text-primary)]">{place.name}</span>
                  <span className="t-caption block truncate">{place.location}</span>
                </span>
                <span className="t-body-sm shrink-0 text-sky-400">{place.score}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </WindowShell>
  );
}
