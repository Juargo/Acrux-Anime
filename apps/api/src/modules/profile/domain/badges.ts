// The badges earned by milestones (RF-55), in catalog order. apps/web/src/badges/catalog.ts
// computes them from the seen titles; the API only checks the ids, as it does with the counter.
export const BADGE_IDS = [
  'titles_10',
  'titles_50',
  'titles_100',
  'titles_250',
  'hours_50',
  'hours_200',
  'hours_500',
  'genres_5',
  'genres_10',
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

const isBadge = (value: string): value is BadgeId =>
  (BADGE_IDS as readonly string[]).includes(value);

// Catalog order, and only known ids: the column is text, so anything else is dropped on read.
export const inCatalogOrder = (ids: readonly string[]): BadgeId[] =>
  BADGE_IDS.filter((id) => ids.includes(id) && isBadge(id));
