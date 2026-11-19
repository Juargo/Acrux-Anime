import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FORMAT_FILTERS,
  formatFilterLabel,
  type GenreOption,
  genreLabel,
} from '../catalog-source/catalog';

export interface Filters {
  genres: string[];
  formats: string[];
}

const toggle = (values: string[], value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

/**
 * Presentational: the filter sheet of Figma M34 (49:3894). Changes stay in a draft until
 * "Ver resultados", so trying options costs no catalog requests.
 */
export function FilterSheet(props: {
  initial: Filters;
  genres: GenreOption[] | undefined;
  onApply: (filters: Filters) => void;
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

        <h3 className="sheet__label">{t('filters.genre')}</h3>
        <div className="chips">
          {genres === undefined && (
            <span className="sheet__hint">{t('filters.loadingGenres')}</span>
          )}
          {genres?.map((genre) => (
            <button
              key={genre.value}
              type="button"
              className="chip"
              aria-pressed={draft.genres.includes(genre.value)}
              onClick={() => setDraft({ ...draft, genres: toggle(draft.genres, genre.value) })}
            >
              {genreLabel(genre.value, t)}
            </button>
          ))}
        </div>

        <h3 className="sheet__label">{t('filters.format')}</h3>
        <div className="chips">
          {FORMAT_FILTERS.map((format) => (
            <button
              key={format.value}
              type="button"
              className="chip"
              aria-pressed={draft.formats.includes(format.value)}
              onClick={() => setDraft({ ...draft, formats: toggle(draft.formats, format.value) })}
            >
              {formatFilterLabel(format.value, t)}
            </button>
          ))}
        </div>

        <p className="sheet__hint">{t('filters.sagaHint')}</p>

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
