import type { TFunction } from 'i18next';
import type { CounterMode } from '../counter/use-total-counter';
import { i18n } from '../i18n';
import type { DramaRow } from '../my-list/drama-rows';
import type { MyList } from '../my-list/items';
import type { Profile } from '../profile-api';

// The card has room for four covers in a row: two anime and two dramas (RF-30).
export const MAX_ANIME = 2;
export const MAX_DRAMAS = 2;

export interface CardCover {
  id: string;
  title: string;
  coverUrl: string | null;
}

// One figure of the summary: "48 ANIMES COMPLETOS".
export interface CardTotal {
  value: number;
  label: string;
}

// The covers under one heading of the card: "ANIME" or "DRAMAS".
export interface CardPicks {
  label: string;
  covers: CardCover[];
}

// One row of the picker under the card: something in the list that the card can show.
export interface CardChoice extends CardCover {
  detail: string;
  // In Viendo: what the card shows until something is chosen.
  watching: boolean;
}

// What the share card shows (RF-30): how much its owner has seen, who shares it and the covers
// they chose to show.
export interface ShareCardContent {
  totals: CardTotal[];
  name: string;
  initial: string;
  avatarUrl: string | null;
  avatarPreset: Profile['avatarPreset'];
  picks: CardPicks[];
  // The earned badges, only while the owner is Plus (RF-55).
  badges: string[];
}

/** The anime the card can show: the rows of "Mi lista", Viendo first and then the seen ones. */
export function animeChoices(list: MyList): CardChoice[] {
  const choices = new Map<string, CardChoice>();
  for (const [rows, watching] of [
    [list.watching, true],
    [list.seen, false],
  ] as const) {
    for (const { id, title, coverUrl, detail } of rows) {
      if (!choices.has(id)) choices.set(id, { id, title, coverUrl, detail, watching });
    }
  }
  return [...choices.values()];
}

/** The dramas the card can show: every marked one, in the order of "Mi lista". */
export function dramaChoices(rows: readonly DramaRow[], t: TFunction = i18n.t): CardChoice[] {
  return rows.map(({ drama, mark }) => ({
    id: `drama-${drama.id}`,
    title: drama.title,
    coverUrl: drama.coverUrl,
    detail: [drama.origin && t(`dramas.origins.${drama.origin}`), drama.year]
      .filter(Boolean)
      .join(' · '),
    watching: mark.status === 'watching',
  }));
}

// Until something is chosen, the card answers "what are you watching now?".
export function defaultChoice(choices: readonly CardChoice[], max: number): string[] {
  return choices
    .filter((choice) => choice.watching)
    .slice(0, max)
    .map((choice) => choice.id);
}

const covers = (choices: readonly CardChoice[], chosen: readonly string[], max: number) =>
  choices
    .filter((choice) => chosen.includes(choice.id))
    .slice(0, max)
    .map(({ id, title, coverUrl }) => ({ id, title, coverUrl }));

/**
 * The content of the card: the anime total as "Mi lista" counts it (RNF-42), the seen dramas
 * once one is marked (null before that), and the chosen anime and dramas in the order of the
 * list, at most two of each.
 */
export function shareCardContent(input: {
  list: MyList;
  mode: CounterMode;
  profile: Pick<Profile, 'displayName' | 'avatarUrl'> &
    Partial<Pick<Profile, 'avatarPreset' | 'plan' | 'badges'>>;
  anime: readonly CardChoice[];
  dramas: readonly CardChoice[];
  dramasSeen: number | null;
  chosenAnime: readonly string[];
  chosenDramas: readonly string[];
  t?: TFunction;
}): ShareCardContent {
  const { list, mode, profile, t = i18n.t } = input;
  const name = profile.displayName.trim();
  const picks: CardPicks[] = [
    { label: t('card.anime'), covers: covers(input.anime, input.chosenAnime, MAX_ANIME) },
    { label: t('card.dramas'), covers: covers(input.dramas, input.chosenDramas, MAX_DRAMAS) },
  ];
  return {
    totals: [
      {
        value: mode === 'franchise' ? list.stats.complete : list.stats.seenEntries,
        label: t(mode === 'franchise' ? 'card.complete' : 'card.seenEntries'),
      },
      ...(input.dramasSeen === null
        ? []
        : [{ value: input.dramasSeen, label: t('card.dramasSeen') }]),
    ],
    name: name || t('card.noName'),
    initial: name.charAt(0).toUpperCase() || '?',
    avatarUrl: profile.avatarUrl,
    avatarPreset: profile.avatarPreset ?? null,
    badges: profile.plan === 'plus' ? (profile.badges ?? []) : [],
    picks: picks.filter((group) => group.covers.length > 0),
  };
}
