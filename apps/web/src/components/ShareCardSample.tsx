import { useTranslation } from 'react-i18next';
import { ShareCard } from './ShareCard';

const empty = (...ids: string[]) => ids.map((id) => ({ id, title: '', coverUrl: null }));

// Figma 27:38 · "Tarjeta para compartir · Clásica", the sample shown on the sign-in screen.
// Built at its desktop size (324 × 576) and scaled down on small screens.
export function ShareCardSample() {
  const { t } = useTranslation();
  return (
    <ShareCard
      name="@jorge"
      initial="J"
      avatarUrl={null}
      totals={[
        { value: 48, label: t('card.complete') },
        { value: 12, label: t('card.dramasSeen') },
      ]}
      picks={[
        { label: t('card.anime'), covers: empty('a', 'b') },
        { label: t('card.dramas'), covers: empty('c', 'd') },
      ]}
      url="acrux.app/@jorge"
      qr
      hidden
    />
  );
}
