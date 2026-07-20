import { GitCompareArrows } from "lucide-react";
import { WindowShell } from "./window-shell";
import { SCENE_PLACES, PRICE_LABEL } from "../scene-data";
import { cn } from "@/lib/utils";

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}

const METRICS = [
  { key: "wifi", label: "Wifi" },
  { key: "seating", label: "Seating" },
] as const;

export function ComparisonWindow({ selectedId, onSelect, className }: Props) {
  return (
    <WindowShell icon={GitCompareArrows} title="Compare" subtitle="Coffee shops, side by side" className={className}>
      <div className="grid grid-cols-3 gap-2">
        {SCENE_PLACES.map((place) => {
          const active = place.id === selectedId;
          return (
            <button
              key={place.id}
              type="button"
              onClick={() => onSelect(place.id)}
              aria-pressed={active}
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-2.5 text-left transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60",
                active
                  ? "border-sky-500/40 bg-sky-500/10"
                  : "border-[var(--border-subtle)] hover:border-[var(--border-default)]"
              )}
            >
              <p className="t-caption truncate text-[var(--text-primary)]">{place.name.split(" ")[0]}</p>
              {METRICS.map((m) => (
                <div key={m.key}>
                  <div className="mb-1 flex justify-between">
                    <span className="text-[10px] text-[var(--text-tertiary)]">{m.label}</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white-100/10">
                    <div
                      className={cn("h-full rounded-full", active ? "bg-sky-500" : "bg-black-400")}
                      style={{ width: `${place.metrics[m.key]}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="t-caption mt-0.5 text-[var(--text-secondary)]">{PRICE_LABEL[place.metrics.price]}</p>
            </button>
          );
        })}
      </div>
    </WindowShell>
  );
}
