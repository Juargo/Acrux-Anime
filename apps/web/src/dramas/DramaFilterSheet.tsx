import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { genreLabel } from '../catalog-source/catalog';
import { ORIGINS, type Origin } from '../drama-source/client';

export interface DramaFilters {
  origin: Origin | undefined;
  genres: string[];
}

const toggle = (values: string[], value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

/**
 * Presentational: the filter sheet of the dramas. One country at most, or all of them, and any
 * genres. Changes stay in a draft until "Ver resultados", so trying options costs no requests.
 */
export function DramaFilterSheet(props: {
  initial: DramaFilters;
  genres: string[] | undefined;
  onApply: (filters: DramaFilters) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const { genres, onApply, onClear, onClose } = props;
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(props.initial);
  const titleId = useId();

  // Focus goes into the sheet and, when it closes, back to whatever opened it.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop">
      <button
        className="sheet-backdrop__close"
        type="button"
        aria-label={t('filters.close')}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 className="sheet__title" id={titleId}>
          {t('filters.title')}
        </h2>

        <h3 className="sheet__label">{t('dramas.origin')}</h3>
        <div className="chips">
          <button
            type="button"
            className="chip"
            aria-pressed={draft.origin === undefined}
            onClick={() => setDraft({ ...draft, origin: undefined })}
          >
            {t('dramas.origins.all')}
          </button>
          {ORIGINS.map((origin) => (
            <button
              key={origin}
              type="button"
              className="chip"
              aria-pressed={draft.origin === origin}
              onClick={() => setDraft({ ...draft, origin })}
            >
              {t(`dramas.origins.${origin}`)}
            </button>
          ))}
        </div>

        <h3 className="sheet__label">{t('filters.genre')}</h3>
        <div className="chips">
          {genres === undefined && (
            <span className="sheet__hint">{t('filters.loadingGenres')}</span>
          )}
          {genres?.map((genre) => (
            <button
              key={genre}
              type="button"
              className="chip"
              aria-pressed={draft.genres.includes(genre)}
              onClick={() => setDraft({ ...draft, genres: toggle(draft.genres, genre) })}
            >
              {genreLabel(genre, t)}
            </button>
          ))}
        </div>

        <div className="sheet__actions">
          <button className="button button--ghost" type="button" onClick={onClear}>
            {t('filters.clear')}
          </button>
          <button className="button button--primary" type="button" onClick={() => onApply(draft)}>
            {t('filters.apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
