import { webSpanish } from '@acrux/i18n';
import type { TFunction } from 'i18next';
import { i18n } from '../i18n';
import type { BrowsePage, BrowseParams, CatalogClient } from './client';

// Catalog browsing (ADR-0017, ADR-0043): our API filters by name or year, genre and format.
// Each page brings the neighbours one hop away that it lacks, so the grid can show one item
// per franchise without extra requests.

type FilterValue = keyof typeof webSpanish.formatFilters;

export interface FormatFilter {
  // Also the format name the API takes (TV, MOVIE, OVA, ONA, SPECIAL).
  value: FilterValue;
  // In the current language.
  readonly label: string;
}

const formatFilter = (value: FilterValue): FormatFilter => ({
  value,
  get label() {
    return formatFilterLabel(value);
  },
});

// The filter sheet options of Figma M34. RF-11: never music.
export const FORMAT_FILTERS: readonly FormatFilter[] = [
  formatFilter('TV'),
  formatFilter('MOVIE'),
  formatFilter('OVA'),
  formatFilter('ONA'),
  formatFilter('SPECIAL'),
];

export function formatFilterLabel(value: FilterValue, t: TFunction = i18n.t): string {
  return t(`formatFilters.${value}`);
}

type FormatName = keyof typeof webSpanish.formats;
const isFormatName = (format: string): format is FormatName =>
  Object.hasOwn(webSpanish.formats, format);

// Figma M09 names formats short: "TV · 24 ep. · 2020", "Película · 2021".
export function formatLabel(format: string, t: TFunction = i18n.t): string {
  return isFormatName(format) ? t(`formats.${format}`) : format;
}

export interface CatalogQuery {
  search: string;
  year: number;
  genres: string[];
  // FormatFilter values.
  formats: string[];
}

// Name and year are exclusive browse modes (ADR-0017): a search covers every year. No formats
// means all of them, which the API also reads as "none given".
export function browseParams(query: CatalogQuery): BrowseParams {
  const search = query.search.trim();
  return {
    ...(search === '' ? { year: query.year } : { search }),
    genres: query.genres,
    formats: FORMAT_FILTERS.filter((filter) => query.formats.includes(filter.value)).map(
      (filter) => filter.value,
    ),
  };
}

export function fetchCatalogPage(
  client: CatalogClient,
  query: CatalogQuery,
  page: number,
): Promise<BrowsePage> {
  return client.browse(browseParams(query), page);
}

// The catalog names genres in English; the app shows the curated names of ADR-0010.
type GenreName = keyof typeof webSpanish.genres;
const isGenreName = (genre: string): genre is GenreName => Object.hasOwn(webSpanish.genres, genre);

export function genreLabel(genre: string, t: TFunction = i18n.t): string {
  return isGenreName(genre) ? t(`genres.${genre}`) : genre;
}

// The API never serves adult titles; this keeps the adult genre out of the filter anyway.
const ADULT_GENRES = new Set(['Hentai']);

export interface GenreOption {
  value: string;
  // In the language of the moment it was fetched; screens show genreLabel(value).
  label: string;
}

export async function fetchGenres(client: CatalogClient): Promise<GenreOption[]> {
  const genres = await client.genres();
  return genres
    .filter((genre) => !ADULT_GENRES.has(genre))
    .map((genre) => ({ value: genre, label: genreLabel(genre) }));
}
