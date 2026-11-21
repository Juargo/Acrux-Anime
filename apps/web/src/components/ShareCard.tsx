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
  // The anime half and, once a drama is marked, the dramas half: the large figure with its
  // label, the seen total tagged under it (null when it is the large figure) and the poster (a
  // null cover URL draws an empty one; no poster when nothing is chosen).
  blocks: {
    value: number | string;
    label: string;
    seen: string | null;
    cover: { id: string; title: string; coverUrl: string | null } | null;
  }[];
  url: string;
  // The QR to the public profile (RF-32): a URL draws it, true draws the sample's placeholder.
  qr?: string | boolean;
  // The owner's badges (RF-55); the caller passes them only for Plus.
  badges?: readonly string[];
  hidden?: boolean;
}

// A figure of three digits or more is drawn smaller, to fit beside its poster.
function countClass(value: number | string) {
  const digits = String(value).length;
  return `share-card__count${digits > 3 ? ' share-card__count--longer' : digits > 2 ? ' share-card__count--long' : ''}`;
}

/**
 * Presentational: the share card at 324 × 576 (9:16, RNF-51): two colour fields split by a
 * diagonal, the anime poster and its figures on the first, the drama's on the second. Alone,
 * the anime half takes the whole card. The image of the card is rendered from this node
 * (card/image.ts).
 */
export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  {
    name,
    initial,
    avatarUrl,
    avatarPreset = null,
    blocks,
    badges = [],
    url,
    qr = false,
    hidden = false,
  },
  ref,
) {
  return (
    <div
      className={`share-card${blocks.length === 1 ? ' share-card--solo' : ''}`}
      ref={ref}
      aria-hidden={hidden || undefined}
    >
      <span className="share-card__field" />
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
      {blocks.map((block, index) => (
        <div
          key={block.label}
          className={`share-card__block share-card__block--${index === 0 ? 'first' : 'second'}`}
        >
          {block.cover && (
            <span className="share-card__poster">
              <span className="share-card__slab" />
              {block.cover.coverUrl ? (
                <img
                  className="share-card__cover"
                  src={block.cover.coverUrl}
                  alt={block.cover.title}
                />
              ) : (
                <span className="share-card__cover" />
              )}
            </span>
          )}
          <div className="share-card__figure">
            <span className={countClass(block.value)}>{block.value}</span>
            <div className="share-card__meta">
              <span className="share-card__label">{block.label}</span>
              {block.seen && (
                <span className="share-card__seen">
                  <svg aria-hidden="true" width="9" height="8" viewBox="0 0 15 13">
                    <path
                      d="M2 7L5.8 10.6L13 2.2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {block.seen}
                </span>
              )}
              {index === 0 && <BadgeRow ids={badges} className="share-card__badges" />}
            </div>
          </div>
        </div>
      ))}
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
