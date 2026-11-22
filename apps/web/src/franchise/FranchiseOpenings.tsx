import { useTranslation } from 'react-i18next';
import type { Opening } from '../catalog-source/client';
import type { FranchiseEntryDetail } from '../catalog-source/franchise';
import { youtubeSearchUrl } from '../catalog-source/openings';

export type OpeningsState =
  | { status: 'loading' }
  | { status: 'error'; message: string; onRetry: () => void }
  // An entry missing from the map has no known openings yet.
  | { status: 'ready'; byAnime: ReadonlyMap<number, Opening[]> };

/**
 * Presentational: the openings of a franchise, entry by entry in the order of the timeline and,
 * inside an entry, in the order they aired. Each one links to a YouTube search.
 */
export function FranchiseOpenings(props: {
  entries: readonly FranchiseEntryDetail[];
  state: OpeningsState;
}) {
  const { entries, state } = props;
  const { t } = useTranslation();

  if (state.status === 'loading') {
    return (
      <p className="catalog__state" role="status">
        {t('franchise.openingsLoading')}
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="catalog__notice" role="alert">
        <p>{state.message}</p>
        <button className="button button--secondary" type="button" onClick={state.onRetry}>
          {t('franchise.retry')}
        </button>
      </div>
    );
  }

  const groups = entries.flatMap((entry) => {
    const openings = state.byAnime.get(entry.animeId) ?? [];
    return openings.length > 0 ? [{ entry, openings }] : [];
  });
  const unknown = entries.filter((entry) => !state.byAnime.has(entry.animeId)).length;

  if (groups.length === 0) {
    return (
      <p className="catalog__state">
        {t(unknown > 0 ? 'franchise.openingsUnknown' : 'franchise.openingsNone')}
      </p>
    );
  }
  return (
    <>
      {groups.map(({ entry, openings }) => (
        <section className="openings__entry" key={entry.animeId}>
          <h3 className="openings__entry-title">{entry.title}</h3>
          <ol className="openings__list">
            {openings.map((opening, index) => (
              <OpeningRow
                // The same song can open an anime twice, so the position names the row.
                // biome-ignore lint/suspicious/noArrayIndexKey: the list never reorders.
                key={index}
                animeTitle={entry.title}
                opening={opening}
              />
            ))}
          </ol>
        </section>
      ))}
      {unknown > 0 && (
        <p className="openings__note">{t('franchise.openingsMissing', { count: unknown })}</p>
      )}
    </>
  );
}

function OpeningRow({ animeTitle, opening }: { animeTitle: string; opening: Opening }) {
  const { t } = useTranslation();
  const meta = [
    opening.artist,
    opening.episodes ? t('franchise.openingEpisodes', { episodes: opening.episodes }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="opening">
      <span className="opening__text">
        <span className="opening__title">{opening.title}</span>
        {meta && <span className="opening__meta">{meta}</span>}
      </span>
      <a
        className="opening__link"
        href={youtubeSearchUrl(animeTitle, opening)}
        target="_blank"
        rel="noreferrer"
        aria-label={t('franchise.watchOpeningOnYoutube', { title: opening.title })}
      >
        {t('franchise.watchOnYoutube')}
      </a>
    </li>
  );
}
