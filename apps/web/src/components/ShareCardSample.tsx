import { useTranslation } from 'react-i18next';
import { ShareCard } from './ShareCard';

const EMPTY_COVERS = ['a', 'b', 'c'].map((id) => ({ id, title: '', coverUrl: null }));

// Figma 27:38 · "Tarjeta para compartir · Clásica", the sample shown on the sign-in screen.
// Built at its desktop size (324 × 576) and scaled down on small screens.
export function ShareCardSample() {
  const { t } = useTranslation();
  return (
    <ShareCard
      name="@jorge"
      initial="J"
      avatarUrl={null}
      total={48}
      label={t('card.complete')}
      covers={EMPTY_COVERS}
      url="acrux.app/@jorge"
      qr
      hidden
    />
  );
}
