// Minimal shapes the domain needs from AniList and from the API. The apps map their own
// Zod-validated data into these types; the domain never imports them (ADR-0019).

export type RelationType =
  | 'ADAPTATION'
  | 'PREQUEL'
  | 'SEQUEL'
  | 'PARENT'
  | 'SIDE_STORY'
  | 'CHARACTER'
  | 'SUMMARY'
  | 'ALTERNATIVE'
  | 'SPIN_OFF'
  | 'OTHER'
  | 'SOURCE'
  | 'COMPILATION'
  | 'CONTAINS';

export type MediaType = 'ANIME' | 'MANGA';

export interface Relation {
  type: RelationType;
  id: number;
}

export interface CatalogEntry {
  id: number;
  type: MediaType;
  // AniList format, e.g. TV, MOVIE, OVA, MUSIC; null when AniList does not know it.
  format: string | null;
  title: string;
  // ISO date (YYYY-MM-DD). A partial AniList date maps to its first day; null when unknown.
  startDate: string | null;
  relations: Relation[];
}

export type FranchiseRole = 'core' | 'extra' | 'separate';

// One row of the curator table (franchise_override, ADR-0022).
export interface FranchiseOverride {
  animeId: number;
  // core and extra: the franchise the entry belongs to. separate: the franchise it is related to.
  franchiseRootId: number;
  role: FranchiseRole;
  // ISO timestamp of the last change to the row.
  updatedAt: string;
}

export interface CoreMember {
  id: number;
  // When the entry became part of the franchise: the later of its start date and its curator
  // override; null while it has no start date (not released yet).
  joinedAt: string | null;
}

export interface Franchise {
  rootId: number;
  title: string;
  // Sorted by start date, then id.
  core: CoreMember[];
  extras: number[];
  // Root ids of franchises linked as related (spin-offs, remakes).
  related: number[];
}

export type MarkStatus = 'seen' | 'watching';

export interface Mark {
  animeId: number;
  status: MarkStatus;
  // ISO timestamp.
  markedAt: string;
}
