import { webSpanish } from '@acrux/i18n';
import type { TFunction } from 'i18next';
import { z } from 'zod';
import { i18n } from '../i18n';
import type { AniListClient } from './client';

// Catalog browsing (ADR-0017, ADR-0024 rule 7): AniList filters by name or year, genre and
// format on its side. Each hit brings its relations one hop away, so the grid can show one
// item per franchise without extra requests.

export const CATALOG_PAGE_SIZE = 50;

// RF-11: TV, movies, OVAs, ONAs and specials; never music.
const CATALOG_FORMATS = ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA'] as const;
type CatalogFormat = (typeof CATALOG_FORMATS)[number];

type FilterValue = keyof typeof webSpanish.formatFilters;

export interface FormatFilter {
  value: FilterValue;
  // In the current language.
  readonly label: string;
  formats: readonly CatalogFormat[];
}

const formatFilter = (value: FilterValue, formats: readonly CatalogFormat[]): FormatFilter => ({
  value,
  formats,
  get label() {
    return formatFilterLabel(value);
  },
});

// The filter sheet options of Figma M34.
export const FORMAT_FILTERS: readonly FormatFilter[] = [
  formatFilter('TV', ['TV', 'TV_SHORT']),
  formatFilter('MOVIE', ['MOVIE']),
  formatFilter('OVA', ['OVA']),
  formatFilter('ONA', ['ONA']),
  formatFilter('SPECIAL', ['SPECIAL']),
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

export const MEDIA_FIELDS = `
  id
  idMal
  type
  format
  isAdult
  title { romaji english native }
  coverImage { large }
  startDate { year month day }
`;

export const CATALOG_PAGE = `
  query CatalogPage(
    $page: Int
    $perPage: Int
    $search: String
    $seasonYear: Int
    $genres: [String]
    $formats: [MediaFormat]
    $sort: [MediaSort]
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(
        type: ANIME
        isAdult: false
        search: $search
        seasonYear: $seasonYear
        genre_in: $genres
        format_in: $formats
        sort: $sort
      ) {
        ${MEDIA_FIELDS}
        relations {
          edges {
            relationType(version: 2)
            node { ${MEDIA_FIELDS} }
          }
        }
      }
    }
  }
`;

// GenreCollection takes no isAdult argument; the adult genre is dropped below.
export const GENRES = 'query Genres { GenreCollection }';

const relatedMediaSchema = z.object({
  id: z.number().int(),
  idMal: z.number().int().nullable(),
  type: z.string().nullable(),
  format: z.string().nullable(),
  isAdult: z.boolean().nullable(),
  title: z.object({
    romaji: z.string().nullable(),
    english: z.string().nullable(),
    native: z.string().nullable(),
  }),
  coverImage: z.object({ large: z.url({ protocol: /^https$/ }).nullable() }).nullable(),
  startDate: z.object({
    year: z.number().int().nullable(),
    month: z.number().int().nullable(),
    day: z.number().int().nullable(),
  }),
});

export const catalogMediaSchema = relatedMediaSchema.extend({
  relations: z.object({
    edges: z.array(z.object({ relationType: z.string(), node: relatedMediaSchema })),
  }),
});

export type RelatedMedia = z.infer<typeof relatedMediaSchema>;
export type CatalogMedia = z.infer<typeof catalogMediaSchema>;

const catalogPageSchema = z.object({
  Page: z.object({
    pageInfo: z.object({ hasNextPage: z.boolean().nullable() }),
    media: z.array(catalogMediaSchema),
  }),
});

export interface CatalogPage {
  media: CatalogMedia[];
  nextPage: number | null;
}

// Name and year are exclusive browse modes (ADR-0017): a search covers every year.
export function catalogVariables(query: CatalogQuery, page: number) {
  const search = query.search.trim();
  const formats = FORMAT_FILTERS.filter((filter) => query.formats.includes(filter.value)).flatMap(
    (filter) => filter.formats,
  );
  return {
    page,
    perPage: CATALOG_PAGE_SIZE,
    search: search === '' ? null : search,
    seasonYear: search === '' ? query.year : null,
    genres: query.genres.length > 0 ? query.genres : null,
    formats: formats.length > 0 ? formats : [...CATALOG_FORMATS],
    sort: search === '' ? ['POPULARITY_DESC'] : ['SEARCH_MATCH', 'POPULARITY_DESC'],
  };
}

export async function fetchCatalogPage(
  client: AniListClient,
  query: CatalogQuery,
  page: number,
): Promise<CatalogPage> {
  const data = await client.request(CATALOG_PAGE, catalogVariables(query, page), catalogPageSchema);
  return {
    media: data.Page.media,
    nextPage: data.Page.pageInfo.hasNextPage ? page + 1 : null,
  };
}

// AniList names genres in English; the app shows the curated names of ADR-0010.
type GenreName = keyof typeof webSpanish.genres;
const isGenreName = (genre: string): genre is GenreName => Object.hasOwn(webSpanish.genres, genre);

export function genreLabel(genre: string, t: TFunction = i18n.t): string {
  return isGenreName(genre) ? t(`genres.${genre}`) : genre;
}

const ADULT_GENRES = new Set(['Hentai']);

const genresSchema = z.object({ GenreCollection: z.array(z.string()) });

export interface GenreOption {
  value: string;
  // In the language of the moment it was fetched; screens show genreLabel(value).
  label: string;
}

export async function fetchGenres(client: AniListClient): Promise<GenreOption[]> {
  const data = await client.request(GENRES, {}, genresSchema);
  return data.GenreCollection.filter((genre) => !ADULT_GENRES.has(genre)).map((genre) => ({
    value: genre,
    label: genreLabel(genre),
  }));
}
