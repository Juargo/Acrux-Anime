// The eras of the catalog (S1 of the era filter). The last one has no end: it runs to the
// current year.
export const ERAS = [
  { key: 'pioneers', first: 1917, last: 1959 },
  { key: 'tezuka', first: 1960, last: 1979 },
  { key: 'ovaBoom', first: 1980, last: 1994 },
  { key: 'goldenAge', first: 1995, last: 2005 },
  { key: 'digital', first: 2006, last: 2014 },
  { key: 'streaming', first: 2015, last: null },
] as const;

export type EraKey = (typeof ERAS)[number]['key'];

export const yearRange = (first: number, last: number) =>
  Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index);

/** The years of an era, or none when the key names no era. */
export function eraYears(key: string | null, currentYear: number): number[] {
  const era = ERAS.find((it) => it.key === key);
  return era ? yearRange(era.first, era.last ?? currentYear) : [];
}

/** The era a year belongs to, with its years up to the current one. */
export function eraOf(year: number | undefined, currentYear: number) {
  const era = ERAS.find(
    (it) => year !== undefined && year >= it.first && year <= (it.last ?? currentYear),
  );
  return era && { ...era, years: yearRange(era.first, era.last ?? currentYear) };
}

/**
 * The selection after a tap on one year of the era. From the whole era the year narrows it
 * down; an era never stays with no year, so taking the last one off widens it again.
 */
export function toggleYear(selected: readonly number[], era: readonly number[], year: number) {
  if (selected.length === era.length) return [year];
  const next = selected.includes(year)
    ? selected.filter((it) => it !== year)
    : [...selected, year].sort((a, b) => a - b);
  return next.length === 0 ? [...era] : next;
}
