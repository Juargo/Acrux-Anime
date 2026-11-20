// A request to a source of the catalog (MyAnimeList, TVmaze) that did not answer with data.
export class SourceError extends Error {
  constructor(
    // null when the request itself failed or timed out.
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'SourceError';
  }

  // The source is refusing requests: every caller stops asking for a while (S7).
  get blocked(): boolean {
    return this.status === 403 || this.status === 429;
  }
}
