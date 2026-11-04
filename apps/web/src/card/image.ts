import { toBlob } from 'html-to-image';

// 1080 × 1920, the size of a story (RNF-51), from the 324 × 576 card.
export const CARD_WIDTH = 1080;
const CARD_NODE_WIDTH = 324;

/**
 * Renders the card in the browser (ADR-0024: AniList's CDN and Google's avatars answer with
 * CORS, so the canvas stays readable). The images are fetched without a referrer, as the
 * avatar is shown.
 */
export async function cardImage(node: HTMLElement): Promise<Blob> {
  const blob = await toBlob(node, {
    pixelRatio: CARD_WIDTH / CARD_NODE_WIDTH,
    fetchRequestInit: { mode: 'cors', referrerPolicy: 'no-referrer' },
  });
  if (!blob) throw new Error('The card image is empty');
  return blob;
}
