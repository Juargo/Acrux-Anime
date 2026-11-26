import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ERAS, type EraKey, yearRange as range } from './eras';

// One row per decade; the first and the last rows are cut at the edges of the era.
function decadesOf(first: number, last: number) {
  const rows: { decade: number; years: number[] }[] = [];
  for (let decade = Math.floor(first / 10) * 10; decade <= last; decade += 10) {
    rows.push({ decade, years: range(Math.max(decade, first), Math.min(decade + 9, last)) });
  }
  return rows;
}

const ascending = (years: Iterable<number>) => [...years].sort((a, b) => a - b);

/**
 * Presentational: picks the years a franchise first released in, grouped by era and decade
 * (S1). Counts are the franchises of each year (S2); without them the chips show no numbers.
 */
export function EraFilter(props: {
  years: readonly number[];
  // Franchises per year; undefined while loading or after a failure.
  counts: Readonly<Record<number, number>> | undefined;
  currentYear: number;
  // A search covers every year (ADR-0017), so the years wait until the search is cleared.
  disabled: boolean;
  onChange: (years: number[]) => void;
}) {
  const { years, counts, currentYear, disabled, onChange } = props;
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState<EraKey | null>(null);
  const baseId = useId();
  const compact = useMemo(
    () => new Intl.NumberFormat(i18n.language, { notation: 'compact' }),
    [i18n.language],
  );
  const selected = useMemo(() => new Set(years), [years]);

  const eras = ERAS.map((era) => {
    const last = era.last ?? currentYear;
    const endLabel = era.last === null ? t('eras.today') : String(era.last);
    return {
      key: era.key,
      first: era.first,
      last,
      years: range(era.first, last),
      name: t(`eras.${era.key}`),
      range: `${era.first}–${endLabel}`,
      // Panel title: spaces around the dash.
      title: t('eras.panelTitle', {
        name: t(`eras.${era.key}`),
        from: String(era.first),
        to: endLabel,
      }),
    };
  });
  const openEra = eras.find((era) => era.key === open);

  const toggle = (year: number) =>
    onChange(ascending(selected.has(year) ? years.filter((it) => it !== year) : [...years, year]));

  return (
    <div className="era-filter">
      <h2 className="era-filter__heading">{t('eras.heading')}</h2>
      <div className="chips">
        {eras.map((era) => {
          const count = era.years.filter((year) => selected.has(year)).length;
          const label = [
            era.name,
            era.range,
            ...(count > 0 ? [t('eras.selectedYears', { count })] : []),
          ].join(', ');
          return (
            <button
              key={era.key}
              type="button"
              className="chip era-filter__era"
              disabled={disabled}
              aria-label={label}
              aria-pressed={count > 0}
              aria-expanded={open === era.key}
              aria-controls={open === era.key ? `${baseId}-panel` : undefined}
              onClick={() => setOpen(open === era.key ? null : era.key)}
            >
              <span>{era.name}</span>
              <span className="era-filter__range">{era.range}</span>
              {count > 0 && (
                <span className="era-filter__badge" aria-hidden="true">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {openEra && (
        <fieldset
          className="era-filter__panel"
          id={`${baseId}-panel`}
          aria-labelledby={`${baseId}-title`}
        >
          <div className="era-filter__panel-header">
            <h3 className="era-filter__panel-title" id={`${baseId}-title`}>
              {openEra.title}
            </h3>
            <div className="era-filter__actions">
              <button
                type="button"
                className="era-filter__link"
                disabled={disabled}
                onClick={() => onChange(ascending(new Set([...years, ...openEra.years])))}
              >
                {t('eras.all')}
              </button>
              <button
                type="button"
                className="era-filter__link"
                disabled={disabled}
                onClick={() => onChange(years.filter((year) => !openEra.years.includes(year)))}
              >
                {t('eras.none')}
              </button>
              <button
                type="button"
                className="era-filter__link"
                disabled={disabled}
                onClick={() => onChange([])}
              >
                {t('eras.clear')}
              </button>
            </div>
          </div>
          {decadesOf(openEra.first, openEra.last).map((row) => (
            <div className="era-filter__decade" key={row.decade}>
              <span className="era-filter__decade-label">
                {t('eras.decade', { decade: String(row.decade) })}
              </span>
              <ul className="era-filter__years">
                {row.years.map((year) => {
                  const franchises = counts?.[year] ?? 0;
                  return (
                    <li key={year}>
                      <button
                        type="button"
                        className={`chip era-filter__year${franchises > 0 ? ' era-filter__year--has' : ''}`}
                        disabled={disabled}
                        aria-pressed={selected.has(year)}
                        aria-label={
                          franchises > 0
                            ? t('eras.yearFranchises', { year: String(year), count: franchises })
                            : String(year)
                        }
                        onClick={() => toggle(year)}
                      >
                        {year}
                        {year === currentYear && (
                          <span
                            className="era-filter__dot"
                            data-testid="current-year"
                            aria-hidden="true"
                          />
                        )}
                        {franchises > 0 && (
                          <span className="era-filter__count">{compact.format(franchises)}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </fieldset>
      )}
    </div>
  );
}
