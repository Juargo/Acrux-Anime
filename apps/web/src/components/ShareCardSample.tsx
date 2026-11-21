import { useTranslation } from 'react-i18next';
import { ShareCard } from './ShareCard';

// The share card as the sign-in screen shows it: a sample with empty posters.
// Built at its desktop size (324 × 576) and scaled down on small screens.
export function ShareCardSample() {
  const { t } = useTranslation();
  return (
    <ShareCard
      name="@jorge"
      initial="J"
      avatarUrl={null}
      blocks={[
        {
          value: 3,
          label: t('card.animeWatchingMany'),
          seen: t('card.tagComplete', { total: '48' }),
          cover: { id: 'a', title: '', coverUrl: null },
        },
        {
          value: 1,
          label: t('card.dramasWatchingOne'),
          seen: t('card.tagDramasSeen', { total: '12' }),
          cover: { id: 'b', title: '', coverUrl: null },
        },
      ]}
      url="acrux.app/@jorge"
      qr
      hidden
    />
  );
}
