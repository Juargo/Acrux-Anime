import { useEffect, useId, useRef, useState } from 'react';
import { FORMAT_FILTERS, type GenreOption } from '../anilist/catalog';

export interface Filters {
  year: number;
  genres: string[];
  formats: string[];
}

const FIRST_YEAR = 1917;

const toggle = (values: string[], value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

/**
 * Presentational: the filter sheet of Figma M34 (49:3894). Changes stay in a draft until
 * "Ver resultados", so trying options costs no AniList requests.
 */
export function FilterSheet(props: {
  initial: Filters;
  currentYear: number;
  // A search covers every year (ADR-0017), so the year waits until the search is cleared.
  searching: boolean;
  genres: GenreOption[] | undefined;
  onApply: (filters: Filters) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const { currentYear, searching, genres, onApply, onClear, onClose } = props;
  const dialogRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(props.initial);
  const titleId = useId();
  const yearId = useId();
  const years = Array.from({ length: currentYear - FIRST_YEAR + 1 }, (_, i) => currentYear - i);

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
        aria-label="Cerrar filtros"
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
          Filtrar
        </h2>

        <label className="sheet__label" htmlFor={yearId}>
          Año de estreno
        </label>
        <select
          id={yearId}
          disabled={searching}
          className="sheet__select"
          value={draft.year}
          onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) })}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        {searching && <p className="sheet__hint">La búsqueda cubre todos los años.</p>}

        <h3 className="sheet__label">Género</h3>
        <div className="chips">
          {genres === undefined && <span className="sheet__hint">Cargando géneros…</span>}
          {genres?.map((genre) => (
            <button
              key={genre.value}
              type="button"
              className="chip"
              aria-pressed={draft.genres.includes(genre.value)}
              onClick={() => setDraft({ ...draft, genres: toggle(draft.genres, genre.value) })}
            >
              {genre.label}
            </button>
          ))}
        </div>

        <h3 className="sheet__label">Tipo</h3>
        <div className="chips">
          {FORMAT_FILTERS.map((format) => (
            <button
              key={format.value}
              type="button"
              className="chip"
              aria-pressed={draft.formats.includes(format.value)}
              onClick={() => setDraft({ ...draft, formats: toggle(draft.formats, format.value) })}
            >
              {format.label}
            </button>
          ))}
        </div>

        <p className="sheet__hint">Una saga aparece si alguna de sus entradas cumple el filtro.</p>

        <div className="sheet__actions">
          <button className="button button--ghost" type="button" onClick={onClear}>
            Limpiar
          </button>
          <button className="button button--primary" type="button" onClick={() => onApply(draft)}>
            Ver resultados
          </button>
        </div>
      </div>
    </div>
  );
}
