import { describe, expect, it, vi } from 'vitest';
import { CARD_FILE_NAME, shareOrDownload } from './share';

const blob = new Blob(['png'], { type: 'image/png' });

function fakeDocument() {
  const anchor = { href: '', download: '', click: vi.fn() };
  const doc = { createElement: vi.fn(() => anchor) } as unknown as Document;
  return { doc, anchor };
}

const urls = { createObjectURL: vi.fn(() => 'blob:card'), revokeObjectURL: vi.fn() };

describe('shareOrDownload', () => {
  it('opens the share sheet with the PNG when the browser can share files', async () => {
    const share = vi.fn(async () => undefined);
    const nav = { canShare: vi.fn(() => true), share } as unknown as Navigator;
    const { doc, anchor } = fakeDocument();

    await expect(shareOrDownload(blob, { nav, doc, urls })).resolves.toBe('shared');

    const data = (share.mock.calls[0] as unknown as [ShareData])[0];
    const file = data.files?.[0];
    expect(file?.name).toBe(CARD_FILE_NAME);
    expect(file?.type).toBe('image/png');
    expect(anchor.click).not.toHaveBeenCalled();
  });

  it('downloads the PNG when the browser cannot share files', async () => {
    const nav = { canShare: vi.fn(() => false), share: vi.fn() } as unknown as Navigator;
    const { doc, anchor } = fakeDocument();
    vi.useFakeTimers();

    await expect(shareOrDownload(blob, { nav, doc, urls })).resolves.toBe('downloaded');

    expect(nav.share).not.toHaveBeenCalled();
    expect(anchor).toMatchObject({ href: 'blob:card', download: CARD_FILE_NAME });
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(urls.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(urls.revokeObjectURL).toHaveBeenCalledWith('blob:card');
    vi.useRealTimers();
  });

  it('downloads the PNG when the browser has no Web Share API', async () => {
    const { doc, anchor } = fakeDocument();
    await expect(shareOrDownload(blob, { nav: {} as Navigator, doc, urls })).resolves.toBe(
      'downloaded',
    );
    expect(anchor.click).toHaveBeenCalledOnce();
  });

  it('downloads when asked to, even if the browser can share', async () => {
    const nav = { canShare: vi.fn(() => true), share: vi.fn() } as unknown as Navigator;
    const { doc, anchor } = fakeDocument();

    await expect(shareOrDownload(blob, { nav, doc, urls, download: true })).resolves.toBe(
      'downloaded',
    );
    expect(nav.share).not.toHaveBeenCalled();
    expect(anchor.click).toHaveBeenCalledOnce();
  });

  it('reports a cancelled share sheet without downloading', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('cancelled', 'AbortError');
    });
    const nav = { canShare: () => true, share } as unknown as Navigator;
    const { doc, anchor } = fakeDocument();

    await expect(shareOrDownload(blob, { nav, doc, urls })).resolves.toBe('cancelled');
    expect(anchor.click).not.toHaveBeenCalled();
  });

  it('falls back to the download when sharing fails', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('no gesture', 'NotAllowedError');
    });
    const nav = { canShare: () => true, share } as unknown as Navigator;
    const { doc, anchor } = fakeDocument();

    await expect(shareOrDownload(blob, { nav, doc, urls })).resolves.toBe('downloaded');
    expect(anchor.click).toHaveBeenCalledOnce();
  });
});
