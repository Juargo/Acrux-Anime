import { toBlob } from 'html-to-image';

// 1080 × 1920, the size of a story (RNF-51), from the 324 × 576 card.
export const CARD_WIDTH = 1080;
const CARD_NODE = { width: 324, height: 576 };

/**
 * Renders the card in the browser (ADR-0024: the cover CDN and Google's avatars answer with
 * CORS, so the canvas stays readable). The images are fetched without a referrer, as the
 * avatar is shown. html-to-image keeps a failed image for the whole page, so a retry fetches
 * the images again.
 */
export async function cardImage(
  node: HTMLElement,
  options: { retry?: boolean } = {},
): Promise<Blob> {
  const blob = await toBlob(node, {
    // Explicit, as the measured size of the bordered card rounds down a pixel.
    ...CARD_NODE,
    pixelRatio: CARD_WIDTH / CARD_NODE.width,
    cacheBust: options.retry ?? false,
    fetchRequestInit: { mode: 'cors', referrerPolicy: 'no-referrer' },
  });
  if (!blob) throw new Error('The card image is empty');
  return blob;
}
