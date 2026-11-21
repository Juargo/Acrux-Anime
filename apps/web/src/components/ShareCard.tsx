import { forwardRef } from 'react';
import type { AvatarPreset } from '../profile-api';
import { Avatar } from './Avatar';
import { BadgeRow } from './BadgeRow';
import { QrCode } from './QrCode';

export interface ShareCardProps {
  // Who shares it: the display name, or "@handle" on the sample.
  name: string;
  initial: string;
  avatarUrl: string | null;
  avatarPreset?: AvatarPreset | null;
  // The summary: one figure alone is drawn large, two share the row.
  totals: { value: number | string; label: string }[];
  // The covers under each heading ("ANIME", "DRAMAS"), four at most in all; a null cover draws
  // an empty slot. No section when empty.
  picks: { label: string; covers: { id: string; title: string; coverUrl: string | null }[] }[];
  url: string;
  // The QR to the public profile (RF-32): a URL draws it, true draws the sample's placeholder.
  qr?: string | boolean;
  // The owner's badges (RF-55); the caller passes them only for Plus.
  badges?: readonly string[];
  hidden?: boolean;
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
    totals,
    picks,
    badges = [],
    url,
    qr = false,
    hidden = false,
  },
  ref,
) {
  // Four covers only fit the row at their small size.
  const coverCount = picks.reduce((count, group) => count + group.covers.length, 0);
  const pair = totals.length > 1;
  const long = pair && totals.some((total) => String(total.value).length > 3);
  const totalsClass = `share-card__totals${pair ? ' share-card__totals--pair' : ''}${
    long ? ' share-card__totals--long' : ''
  }`;
  return (
    <div className="share-card" ref={ref} aria-hidden={hidden || undefined}>
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
      <div className="share-card__summary">
        <div className={totalsClass}>
          {totals.map((total) => (
            <div key={total.label} className="share-card__total">
              <span className="share-card__count">{total.value}</span>
              <span className="share-card__label">{total.label}</span>
            </div>
          ))}
        </div>
        <BadgeRow ids={badges} className="share-card__badges" />
      </div>
      {picks.length > 0 && (
        <div className={`share-card__picks${coverCount > 3 ? ' share-card__picks--tight' : ''}`}>
          {picks.map((group) => (
            <div key={group.label} className="share-card__group">
              <span className="share-card__label">{group.label}</span>
              <div className="share-card__covers">
                {group.covers.map((cover) =>
                  cover.coverUrl ? (
                    <img
                      key={cover.id}
                      className="share-card__cover"
                      src={cover.coverUrl}
                      alt={cover.title}
                    />
                  ) : (
                    <span key={cover.id} className="share-card__cover" />
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
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
