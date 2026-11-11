// Client for the user's marks (#33, ADR-0023). Marks live only in the Acrux API.

export interface MarkDto {
  animeId: number;
  malId: number | null;
  status: 'seen' | 'watching';
  markedAt: string;
}

export interface MarkBatch {
  // null removes the marks of these entries.
  status: 'seen' | 'watching' | null;
  entries: { animeId: number; malId?: number | null }[];
}

export type MarksErrorKind = 'signed-out' | 'unavailable' | 'failed';

export class MarksError extends Error {
  constructor(
    readonly kind: MarksErrorKind,
    readonly requestId?: string,
  ) {
    super(`Marks request ${kind}`);
    this.name = 'MarksError';
  }
}

type GetToken = () => Promise<string | null>;

// The largest page the API serves.
const PAGE_SIZE = 1000;

async function call(
  getToken: GetToken,
  path: string,
  init: RequestInit,
  fetchFn: typeof fetch,
): Promise<unknown> {
  const token = await getToken();
  if (!token) throw new MarksError('signed-out');
  const headers = { Authorization: `Bearer ${token}`, ...(init.headers as Record<string, string>) };
  let response: Response;
  try {
    response = await fetchFn(path, { ...init, headers });
  } catch {
    throw new MarksError('unavailable');
  }
  if (response.status === 401) throw new MarksError('signed-out');
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as { requestId?: string };
    throw new MarksError('failed', problem.requestId);
  }
  if (response.status === 204) return undefined;
  return response.json();
}

export async function fetchMarks(
  getToken: GetToken,
  fetchFn: typeof fetch = fetch,
): Promise<MarkDto[]> {
  const marks: MarkDto[] = [];
  let cursor: string | null = null;
  // The API pages by animeId (#35); the counter and the list need every mark.
  do {
    const path: string = `/api/v1/me/marks?limit=${PAGE_SIZE}${cursor ? `&cursor=${cursor}` : ''}`;
    const body = (await call(getToken, path, {}, fetchFn)) as {
      items: MarkDto[];
      nextCursor: string | null;
    };
    marks.push(...body.items);
    // The cursor only moves forward (animeId order); anything else would page forever.
    if (body.nextCursor !== null && cursor !== null && Number(body.nextCursor) <= Number(cursor)) {
      throw new MarksError('failed');
    }
    cursor = body.nextCursor;
  } while (cursor);
  return marks;
}

// RDI-31: a whole core in one transaction.
export async function saveMarks(
  getToken: GetToken,
  batch: MarkBatch,
  fetchFn: typeof fetch = fetch,
): Promise<MarkDto[]> {
  const body = (await call(
    getToken,
    '/api/v1/me/marks:batch',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    },
    fetchFn,
  )) as { items: MarkDto[] };
  return body.items;
}

// RF-20: one entry at a time from the franchise detail.
export async function putMark(
  getToken: GetToken,
  animeId: number,
  mark: { status: 'seen' | 'watching'; malId?: number | null },
  fetchFn: typeof fetch = fetch,
): Promise<MarkDto> {
  return (await call(
    getToken,
    `/api/v1/me/marks/${animeId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mark),
    },
    fetchFn,
  )) as MarkDto;
}

// The API answers 204 whether or not the entry was marked.
export async function deleteMark(
  getToken: GetToken,
  animeId: number,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  await call(getToken, `/api/v1/me/marks/${animeId}`, { method: 'DELETE' }, fetchFn);
}
