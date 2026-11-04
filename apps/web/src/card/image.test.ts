import { toBlob } from 'html-to-image';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardImage } from './image';

vi.mock('html-to-image', () => ({ toBlob: vi.fn() }));

const node = {} as HTMLElement;
const png = new Blob(['png'], { type: 'image/png' });

afterEach(() => vi.clearAllMocks());

describe('cardImage', () => {
  it('renders the 324 × 576 card as a 1080 × 1920 PNG, fetching images without a referrer', async () => {
    vi.mocked(toBlob).mockResolvedValue(png);

    await expect(cardImage(node)).resolves.toBe(png);

    expect(toBlob).toHaveBeenCalledWith(node, {
      width: 324,
      height: 576,
      pixelRatio: 1080 / 324,
      cacheBust: false,
      fetchRequestInit: { mode: 'cors', referrerPolicy: 'no-referrer' },
    });
  });

  it('fetches the images again on a retry, past the failures html-to-image keeps', async () => {
    vi.mocked(toBlob).mockResolvedValue(png);

    await cardImage(node, { retry: true });

    expect(vi.mocked(toBlob).mock.calls[0]?.[1]).toMatchObject({ cacheBust: true });
  });

  it('fails when the image comes out empty', async () => {
    vi.mocked(toBlob).mockResolvedValue(null);
    await expect(cardImage(node)).rejects.toThrow('The card image is empty');
  });
});
