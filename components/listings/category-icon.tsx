import {
  AppWindow,
  Sparkles,
  Globe,
  Users,
  Gamepad2,
  Server,
  Video,
  Package,
  Layers,
  type LucideIcon,
} from "lucide-react";

/**
 * Category.icon stores a lucide-react icon name (string) so new categories
 * can be added from the database without a code change — this is the
 * lookup table. Add an entry here when seeding a category with a new icon
 * name. Falls back to a generic glyph for anything unmapped rather than
 * rendering nothing.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  AppWindow,
  Sparkles,
  Globe,
  Users,
  Gamepad2,
  Server,
  Video,
  Package,
};

export function resolveCategoryIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Layers;
  return ICON_MAP[name] ?? Layers;
}

// Looked up from a static top-level map (or the static `Layers` fallback), so
// the component identity is stable across renders for a given `name` — safe
// despite the lint rule's static analysis not being able to prove that.
/* eslint-disable react-hooks/static-components */
export function CategoryIcon({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  const Icon = resolveCategoryIcon(name);
  return <Icon className={className} aria-hidden />;
}
/* eslint-enable react-hooks/static-components */
