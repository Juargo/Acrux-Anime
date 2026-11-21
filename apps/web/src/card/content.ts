import type { TFunction } from 'i18next';
import type { CounterMode } from '../counter/use-total-counter';
import { i18n } from '../i18n';
import type { DramaRow } from '../my-list/drama-rows';
import type { MyList } from '../my-list/items';
import type { Profile } from '../profile-api';

// The card draws its covers as posters: one anime and one drama (RF-30).
export const MAX_ANIME = 1;
export const MAX_DRAMAS = 1;

export interface CardCover {
  id: string;
  title: string;
  coverUrl: string | null;
}

// One half of the card, the anime or the dramas: its large figure ("2 ANIMES VIENDO"), the
// seen total tagged under it ("9 VISTAS") and its poster.
export interface CardBlock {
  value: number;
  label: string;
  seen: string;
  // Null when nothing is chosen.
  cover: CardCover | null;
}

// One row of the picker under the card: something in the list that the card can show.
export interface CardChoice extends CardCover {
  detail: string;
  // In Viendo: what the card shows until something is chosen.
  watching: boolean;
}

// What the share card shows (RF-30): who shares it and, for the anime and for the dramas, how
// much its owner is watching and has seen, with the cover they chose to show.
export interface ShareCardContent {
  blocks: CardBlock[];
  name: string;
  initial: string;
  avatarUrl: string | null;
  avatarPreset: Profile['avatarPreset'];
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

// Until something is chosen, the card answers "what are you watching now?"; with nothing in
// Viendo, it shows the first of the list, so a first card is never left without a poster.
export function defaultChoice(choices: readonly CardChoice[], max: number): string[] {
  const watching = choices.filter((choice) => choice.watching);
  return (watching.length > 0 ? watching : choices).slice(0, max).map((choice) => choice.id);
}

const covers = (choices: readonly CardChoice[], chosen: readonly string[], max: number) =>
  choices
    .filter((choice) => chosen.includes(choice.id))
    .slice(0, max)
    .map(({ id, title, coverUrl }) => ({ id, title, coverUrl }));

// What is being watched leads its half of the card, a zero included, so every card reads alike.
function block(
  watching: { value: number; one: string; many: string },
  seen: string,
  cover: CardCover | undefined,
): CardBlock {
  return {
    value: watching.value,
    label: watching.value === 1 ? watching.one : watching.many,
    seen,
    cover: cover ?? null,
  };
}

/**
 * The content of the card: for the anime, what is in Viendo and the total as "Mi lista" counts
 * it (RNF-42); the same for the dramas once one is marked (`dramasSeen` is null before that);
 * and the chosen anime and drama, one of each at most.
 */
export function shareCardContent(input: {
  list: MyList;
  mode: CounterMode;
  profile: Pick<Profile, 'displayName' | 'avatarUrl'> &
    Partial<Pick<Profile, 'avatarPreset' | 'plan' | 'badges'>>;
  anime: readonly CardChoice[];
  dramas: readonly CardChoice[];
  dramasSeen: number | null;
  dramasWatching: number;
  chosenAnime: readonly string[];
  chosenDramas: readonly string[];
  t?: TFunction;
}): ShareCardContent {
  const { list, mode, profile, t = i18n.t } = input;
  const name = profile.displayName.trim();
  const complete = mode === 'franchise';
  const animeSeen = complete ? list.stats.complete : list.stats.seenEntries;
  const blocks = [
    block(
      {
        value: list.stats.watching,
        one: t('card.animeWatchingOne'),
        many: t('card.animeWatchingMany'),
      },
      t(complete ? 'card.tagComplete' : 'card.tagSeenEntries', { total: String(animeSeen) }),
      covers(input.anime, input.chosenAnime, MAX_ANIME)[0],
    ),
  ];
  if (input.dramasSeen !== null) {
    blocks.push(
      block(
        {
          value: input.dramasWatching,
          one: t('card.dramasWatchingOne'),
          many: t('card.dramasWatchingMany'),
        },
        t('card.tagDramasSeen', { total: String(input.dramasSeen) }),
        covers(input.dramas, input.chosenDramas, MAX_DRAMAS)[0],
      ),
    );
  }
  return {
    blocks,
    name: name || t('card.noName'),
    initial: name.charAt(0).toUpperCase() || '?',
    avatarUrl: profile.avatarUrl,
    avatarPreset: profile.avatarPreset ?? null,
    badges: profile.plan === 'plus' ? (profile.badges ?? []) : [],
  };
}
