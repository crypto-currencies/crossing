"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { WindowShell } from "./window-shell";
import { SCENE_PLACES } from "../scene-data";
import { cn } from "@/lib/utils";

const TABS = ["All", "Saved"] as const;

interface Props {
  className?: string;
}

export function CollectionWindow({ className }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [saved, setSaved] = useState<string[]>(["blue-bottle", "sightglass"]);

  function toggleSaved(id: string) {
    setSaved((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  const visible = tab === "Saved" ? SCENE_PLACES.filter((p) => saved.includes(p.id)) : SCENE_PLACES;

  return (
    <WindowShell icon={Bookmark} title="Coffee shops for studying" subtitle="A saved collection" className={className}>
      <div className="mb-3 flex gap-1 rounded-full bg-black-600 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={cn(
              "flex-1 rounded-full py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60",
              tab === t ? "bg-sky-500 text-black-950" : "text-[var(--text-tertiary)]"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-1">
        {visible.map((place) => {
          const isSaved = saved.includes(place.id);
          return (
            <li key={place.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-white-100/5">
              <span className="t-body-sm truncate text-[var(--text-primary)]">{place.name}</span>
              <button
                type="button"
                onClick={() => toggleSaved(place.id)}
                aria-label={isSaved ? `Remove ${place.name} from saved` : `Save ${place.name}`}
                aria-pressed={isSaved}
                className="shrink-0 rounded text-[var(--text-tertiary)] transition-colors duration-150 hover:text-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
              >
                {isSaved ? <BookmarkCheck size={16} className="text-sky-400" /> : <Bookmark size={16} />}
              </button>
            </li>
          );
        })}
        {visible.length === 0 && <p className="t-caption px-2 py-3 text-center">Nothing saved yet.</p>}
      </ul>
    </WindowShell>
  );
}
