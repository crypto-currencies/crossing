export interface ScenePlace {
  id: string;
  name: string;
  location: string;
  category: string;
  score: number;
  reviews: number;
  sourceCount: number;
  tags: string[];
  reason: string;
  caveat: string;
  metrics: { wifi: number; noise: number; seating: number; price: 1 | 2 | 3 };
}

export const SCENE_QUERY = "best coffee shops for working";

export const SCENE_PLACES: ScenePlace[] = [
  {
    id: "blue-bottle",
    name: "Blue Bottle Coffee",
    location: "Downtown",
    category: "Coffee shop",
    score: 9.2,
    reviews: 412,
    sourceCount: 4,
    tags: ["Fast wifi", "Quiet after 2pm"],
    reason: "Fast wifi and plenty of outlets, with seating that stays open past the morning rush.",
    caveat: "Gets loud on weekend mornings.",
    metrics: { wifi: 95, noise: 70, seating: 85, price: 2 },
  },
  {
    id: "ritual",
    name: "Ritual Coffee Roasters",
    location: "Mission District",
    category: "Coffee shop",
    score: 8.7,
    reviews: 288,
    sourceCount: 3,
    tags: ["Great espresso", "Limited seating"],
    reason: "The best espresso in the area, though seats disappear fast after 10am.",
    caveat: "Only a handful of tables.",
    metrics: { wifi: 70, noise: 55, seating: 40, price: 2 },
  },
  {
    id: "sightglass",
    name: "Sightglass Coffee",
    location: "SoMa",
    category: "Coffee shop",
    score: 8.3,
    reviews: 201,
    sourceCount: 3,
    tags: ["Spacious", "A bit pricey"],
    reason: "A big, open room with reliable wifi — just a few dollars more per drink.",
    caveat: "Prices run above average.",
    metrics: { wifi: 80, noise: 60, seating: 90, price: 3 },
  },
];

export const PRICE_LABEL: Record<1 | 2 | 3, string> = { 1: "$", 2: "$$", 3: "$$$" };

export function findPlace(id: string): ScenePlace {
  return SCENE_PLACES.find((p) => p.id === id) ?? SCENE_PLACES[0];
}
