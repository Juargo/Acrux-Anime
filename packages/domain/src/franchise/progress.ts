import type { Franchise, Mark } from './types';

// RF-26: Viendo > Vista > Parcial > Sin marcar.
export type FranchiseState = 'watching' | 'seen' | 'partial' | 'unmarked';

export interface FranchiseProgress {
  state: FranchiseState;
  // "3/5 temporadas": seen core entries over released core entries.
  seenCore: number;
  releasedCore: number;
  // Counts for the franchise counter (RDI-32).
  complete: boolean;
  // Complete, with core entries released or added after the user's latest mark.
  hasNewEntries: boolean;
}

const time = (iso: string) => Date.parse(iso);

/**
 * State and progress of one franchise for one user. The total never goes down (DD-03, RDI-34,
 * RF-60): a franchise is complete when every core entry that joined it before the user's latest
 * mark in its core is seen, so a new season or a curator correction afterwards does not undo it.
 * Extras never change the state (RF-15).
 */
export function franchiseProgress(
  franchise: Franchise,
  marks: readonly Mark[],
  now: string,
): FranchiseProgress {
  const coreIds = new Set(franchise.core.map((member) => member.id));
  const coreMarks = marks.filter((mark) => coreIds.has(mark.animeId));
  const seen = new Set(
    coreMarks.filter((mark) => mark.status === 'seen').map((mark) => mark.animeId),
  );
  const joinedBy = (limit: number) =>
    franchise.core.filter((member) => member.joinedAt !== null && time(member.joinedAt) <= limit);

  const released = joinedBy(time(now));
  const releasedCore = new Set([...released.map((member) => member.id), ...seen]).size;
  // Only seen marks move the cutoff: starting a season released afterwards must not undo it.
  const cutoff = Math.max(
    ...coreMarks.filter((mark) => mark.status === 'seen').map((mark) => time(mark.markedAt)),
  );
  const complete = seen.size > 0 && joinedBy(cutoff).every((member) => seen.has(member.id));

  let state: FranchiseState = 'unmarked';
  if (coreMarks.some((mark) => mark.status === 'watching')) state = 'watching';
  else if (complete) state = 'seen';
  else if (seen.size > 0) state = 'partial';

  return {
    state,
    seenCore: seen.size,
    releasedCore,
    complete,
    hasNewEntries: complete && released.some((member) => !seen.has(member.id)),
  };
}

/** Franchise counter (RDI-32): franchises whose core is complete. */
export function countCompleteFranchises(
  franchises: readonly Franchise[],
  marks: readonly Mark[],
  now: string,
): number {
  return franchises.filter((franchise) => franchiseProgress(franchise, marks, now).complete).length;
}

/**
 * Entry counter (RDI-32): every seen entry of any format, once. It reads the marks alone, so an
 * entry merged or removed from the catalog still counts (RDI-34).
 */
export function countSeenEntries(marks: readonly Mark[]): number {
  return new Set(marks.filter((mark) => mark.status === 'seen').map((mark) => mark.animeId)).size;
}
