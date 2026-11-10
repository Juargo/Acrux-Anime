import type { Stats } from '../stats/compute';

// The badges earned by milestones (RF-55), in the order the API keeps them
// (apps/api/src/modules/profile/domain/badges.ts). Values come from the stats of the seen
// titles (RF-53), so only seen marks count.
export type BadgeKind = 'titles' | 'hours' | 'genres';

export interface Badge {
  id: string;
  kind: BadgeKind;
  goal: number;
}

const milestones = (kind: BadgeKind, goals: number[]): Badge[] =>
  goals.map((goal) => ({ id: `${kind}_${goal}`, kind, goal }));

export const BADGES: Badge[] = [
  ...milestones('titles', [10, 50, 100, 250]),
  ...milestones('hours', [50, 200, 500]),
  ...milestones('genres', [5, 10]),
];

const milestoneValue = (kind: BadgeKind, stats: Stats) =>
  kind === 'titles'
    ? stats.titles
    : kind === 'hours'
      ? Math.floor(stats.minutes / 60)
      : stats.genreCount;

export interface BadgeProgress extends Badge {
  // Capped at the goal, for the progress bar.
  value: number;
  earned: boolean;
}

export function badgeProgress(stats: Stats): BadgeProgress[] {
  return BADGES.map((badge) => {
    const value = milestoneValue(badge.kind, stats);
    return { ...badge, value: Math.min(value, badge.goal), earned: value >= badge.goal };
  });
}

export const earnedBadges = (stats: Stats): string[] =>
  badgeProgress(stats)
    .filter((badge) => badge.earned)
    .map((badge) => badge.id);
