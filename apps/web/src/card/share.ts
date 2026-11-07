import { i18n } from '../i18n';

export const CARD_FILE_NAME = 'acrux-tarjeta.png';

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

function download(
  blob: Blob,
  doc: Document,
  urls: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>,
) {
  const href = urls.createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = href;
  anchor.download = CARD_FILE_NAME;
  anchor.click();
  // Revoked later: some browsers cancel a download whose URL is revoked at once.
  setTimeout(() => urls.revokeObjectURL(href), 1000);
}

/**
 * RF-31: the card goes to the browser's share sheet when it can share files (Web Share API);
 * otherwise, when asked to, or when sharing fails, the PNG is downloaded. Closing the sheet
 * downloads nothing.
 */
export async function shareOrDownload(
  blob: Blob,
  options: {
    nav?: Navigator;
    doc?: Document;
    urls?: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
    download?: boolean;
  } = {},
): Promise<ShareOutcome> {
  const { nav = navigator, doc = document, urls = URL } = options;
  if (!options.download) {
    const file = new File([blob], CARD_FILE_NAME, { type: 'image/png' });
    const data: ShareData = { files: [file], title: i18n.t('card.shareTitle') };
    if (nav.canShare?.(data) && nav.share) {
      try {
        await nav.share(data);
        return 'shared';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      }
    }
  }
  download(blob, doc, urls);
  return 'downloaded';
}
