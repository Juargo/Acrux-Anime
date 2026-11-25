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
