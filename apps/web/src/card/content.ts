import type { TFunction } from 'i18next';
import type { CounterMode } from '../counter/use-total-counter';
import { i18n } from '../i18n';
import type { ListRow, MyList } from '../my-list/items';
import type { Profile } from '../profile-api';

// The card of Figma M07 has room for three covers under "VIENDO AHORA".
export const MAX_COVERS = 3;

export interface CardCover {
  id: string;
  title: string;
  coverUrl: string | null;
}

// What the share card shows (RF-30): the total as the counter counts it, who shares it and
// the covers of what they are watching.
export interface ShareCardContent {
  total: number;
  label: string;
  name: string;
  initial: string;
  avatarUrl: string | null;
  avatarPreset: Profile['avatarPreset'];
  covers: CardCover[];
}

// The step "¿Qué estás viendo ahora?" (M05) starts with the first franchises in Viendo checked.
export function defaultChoice(watching: ListRow[]): string[] {
  return watching.slice(0, MAX_COVERS).map((row) => row.id);
}

/**
 * The content of the card: the same figures as "Mi lista" (RNF-42) and, from the franchises in
 * Viendo, the chosen ones in the order of the list (the default choice when null), at most three.
 */
export function shareCardContent(input: {
  list: MyList;
  mode: CounterMode;
  profile: Pick<Profile, 'displayName' | 'avatarUrl'> & Partial<Pick<Profile, 'avatarPreset'>>;
  chosen: string[] | null;
  t?: TFunction;
}): ShareCardContent {
  const { list, mode, profile, t = i18n.t } = input;
  const chosen = new Set(input.chosen ?? defaultChoice(list.watching));
  const name = profile.displayName.trim();
  return {
    total: mode === 'franchise' ? list.stats.complete : list.stats.seenEntries,
    label: t(mode === 'franchise' ? 'card.complete' : 'card.seenEntries'),
    name: name || t('card.noName'),
    initial: name.charAt(0).toUpperCase() || '?',
    avatarUrl: profile.avatarUrl,
    avatarPreset: profile.avatarPreset ?? null,
    covers: list.watching
      .filter((row) => chosen.has(row.id))
      .slice(0, MAX_COVERS)
      .map(({ id, title, coverUrl }) => ({ id, title, coverUrl })),
  };
}
