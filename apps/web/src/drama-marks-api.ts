// Client for the drama marks of the user (#154). One mark covers the whole show; they live in
// their own routes, apart from the anime marks.
import { callMarksApi, MarksError } from './marks-api';

export interface DramaMarkDto {
  dramaId: number;
  status: 'seen' | 'watching';
  markedAt: string;
}

type GetToken = () => Promise<string | null>;

const PATH = '/api/v1/me/drama-marks';
// The largest page the API serves.
const PAGE_SIZE = 1000;

export async function fetchDramaMarks(
  getToken: GetToken,
  fetchFn: typeof fetch = fetch,
): Promise<DramaMarkDto[]> {
  const marks: DramaMarkDto[] = [];
  let cursor: string | null = null;
  // The API pages by dramaId; the cards and the counter need every mark.
  do {
    const path: string = `${PATH}?limit=${PAGE_SIZE}${cursor ? `&cursor=${cursor}` : ''}`;
    const body = (await callMarksApi(getToken, path, {}, fetchFn)) as {
      items: DramaMarkDto[];
      nextCursor?: string | null;
    };
    marks.push(...body.items);
    const next = body.nextCursor ?? null;
    // The cursor only moves forward (dramaId order); anything else would page forever.
    if (next !== null && cursor !== null && Number(next) <= Number(cursor)) {
      throw new MarksError('failed');
    }
    cursor = next;
  } while (cursor);
  return marks;
}

export async function putDramaMark(
  getToken: GetToken,
  dramaId: number,
  mark: { status: 'seen' | 'watching' },
  fetchFn: typeof fetch = fetch,
): Promise<DramaMarkDto> {
  return (await callMarksApi(
    getToken,
    `${PATH}/${dramaId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mark),
    },
    fetchFn,
  )) as DramaMarkDto;
}

// The API answers 204 whether or not the drama was marked.
export async function deleteDramaMark(
  getToken: GetToken,
  dramaId: number,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  await callMarksApi(getToken, `${PATH}/${dramaId}`, { method: 'DELETE' }, fetchFn);
}
