import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AvatarPreset, CardTheme } from '../profile-api';
import { Avatar } from './Avatar';
import { QrCode } from './QrCode';

export interface ShareCardProps {
  // Who shares it: the display name, or "@handle" on the sample.
  name: string;
  initial: string;
  avatarUrl: string | null;
  avatarPreset?: AvatarPreset | null;
  total: number | string;
  label: string;
  // Up to three covers under "VIENDO AHORA"; null draws an empty slot. No section when empty.
  covers: { id: string; title: string; coverUrl: string | null }[];
  url: string;
  // The QR to the public profile (RF-32): a URL draws it, true draws the sample's placeholder.
  qr?: string | boolean;
  hidden?: boolean;
  // RF-52: the theme, and the "VISTA PREVIA" watermark while a free user tries a Plus theme.
  theme?: CardTheme;
  watermark?: string | null;
}

/**
 * Presentational: Figma 27:38 / M07 "Tarjeta para compartir · Clásica" at 324 × 576 (9:16,
 * RNF-51). The image of the card is rendered from this node (card/image.ts).
 */
export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  {
    name,
    initial,
    avatarUrl,
    avatarPreset = null,
    total,
    label,
    covers,
    url,
    qr = false,
    hidden = false,
    theme = 'clasica',
    watermark = null,
  },
  ref,
) {
  const { t } = useTranslation();
  return (
    <div
      className={theme === 'clasica' ? 'share-card' : `share-card share-card--${theme}`}
      ref={ref}
      aria-hidden={hidden || undefined}
    >
      <div className="share-card__user">
        {avatarPreset || avatarUrl ? (
          <Avatar
            name={name}
            avatarUrl={avatarUrl}
            avatarPreset={avatarPreset}
            size={43}
            className="share-card__avatar"
            decorative
          />
        ) : (
          <span className="share-card__avatar">{initial}</span>
        )}
        <span className="share-card__handle">{name}</span>
        <img
          className="share-card__mark"
          src="/icons/marca.svg"
          alt="Acrux"
          width={26.4}
          height={26.4}
        />
      </div>
      <div className="share-card__total">
        <span className="share-card__count">{total}</span>
        <span className="share-card__label">{label}</span>
      </div>
      {covers.length > 0 && (
        <div className="share-card__watching">
          <span className="share-card__label">{t('card.watchingNow')}</span>
          <div className="share-card__covers">
            {covers.map((cover) =>
              cover.coverUrl ? (
                <img
                  key={cover.id}
                  className="share-card__cover"
                  src={cover.coverUrl}
                  alt={cover.title}
                  width={84}
                  height={125}
                />
              ) : (
                <span key={cover.id} className="share-card__cover" />
              ),
            )}
          </div>
        </div>
      )}
      {watermark && (
        <span className="share-card__watermark" aria-hidden="true">
          {watermark}
        </span>
      )}
      <div className="share-card__footer">
        <span className="share-card__url">{url}</span>
        {qr === true && <span className="share-card__qr">QR</span>}
        {typeof qr === 'string' && (
          <span className="share-card__qr">
            <QrCode value={qr} size={40} />
          </span>
        )}
      </div>
    </div>
  );
});
