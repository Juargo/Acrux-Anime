import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ERAS, eraOf, toggleYear, yearRange } from './eras';

interface EraLevelsProps {
  // The years of one era at most: all of them, or the ones picked inside it.
  years: readonly number[];
  currentYear: number;
  // A search covers every year (ADR-0017), so the years wait until the search is cleared.
  disabled: boolean;
  onChange: (years: number[]) => void;
}

/**
 * Presentational: the eras as the levels of a path, oldest first (board M2). A stop takes its
 * whole era; the stop of the era in view leaves every era.
 */
export function EraRail({ years, currentYear, disabled, onChange }: EraLevelsProps) {
  const { t } = useTranslation();
  const taken = eraOf(years[0], currentYear)?.key;
  return (
    <ol className="world__eras">
      {ERAS.map((era, index) => (
        <li key={era.key}>
          <button
            type="button"
            className="world__era"
            disabled={disabled}
            aria-pressed={taken === era.key}
            aria-label={t('worlds.eraDoor', {
              name: t(`eras.${era.key}`),
              from: String(era.first),
              to: era.last === null ? t('eras.today') : String(era.last),
            })}
            onClick={() =>
              onChange(taken === era.key ? [] : yearRange(era.first, era.last ?? currentYear))
            }
          >
            <span className="world__era-level">{index + 1}</span>
            <span className="world__era-year">{era.first}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/**
 * Presentational: the years of the era in view, in one row. Counts are the franchises of each
 * year; without them the chips show no numbers. Nothing while no era is taken.
 */
export function EraYears({
  years,
  counts,
  currentYear,
  disabled,
  onChange,
}: EraLevelsProps & {
  // Franchises per year; undefined while loading or after a failure.
  counts: Readonly<Record<number, number>> | undefined;
}) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const compact = useMemo(
    () => new Intl.NumberFormat(i18n.language, { notation: 'compact' }),
    [i18n.language],
  );
  const era = eraOf(years[0], currentYear);
  if (!era) return null;
  const whole = years.length === era.years.length;

  return (
    <section className="era-years" aria-labelledby={titleId}>
      <div className="era-years__heading">
        <h2 className="level-title" id={titleId}>
          {t(`eras.${era.key}`)}
        </h2>
        <span className="era-years__range">
          {era.first}–{era.last === null ? t('eras.today') : era.last}
        </span>
      </div>
      <ul className="level-row">
        <li>
          <button
            type="button"
            className="chip chip--level"
            disabled={disabled}
            aria-pressed={whole}
            onClick={() => onChange(era.years)}
          >
            {t('eras.all')}
          </button>
        </li>
        {era.years.map((year) => {
          const franchises = counts?.[year] ?? 0;
          return (
            <li key={year}>
              <button
                type="button"
                className="chip chip--level"
                disabled={disabled}
                aria-pressed={!whole && years.includes(year)}
                aria-label={
                  franchises > 0
                    ? t('eras.yearFranchises', { year: String(year), count: franchises })
                    : String(year)
                }
                onClick={() => onChange(toggleYear(years, era.years, year))}
              >
                {year}
                {year === currentYear && (
                  <span className="era-years__dot" data-testid="current-year" aria-hidden="true" />
                )}
                {franchises > 0 && (
                  <span className="chip__count">{compact.format(franchises)}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
