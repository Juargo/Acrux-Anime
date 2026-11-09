import { type ReactNode, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { formatLabel, genreLabel } from '../anilist/catalog';
import type { AniListClient } from '../anilist/client';
import { useMediaStats } from '../anilist/hooks';
import { anilistErrorMessage } from '../anilist/messages';
import { useMarks } from '../catalog/use-franchise-marks';
import { useOwnProfile } from '../profile/use-own-profile';
import type { Profile } from '../profile-api';
import { computeStats, type Stats } from './compute';

interface StatsScreenProps {
  profile: Profile;
  getToken: () => Promise<string | null>;
  fetchFn?: typeof fetch | undefined;
  client?: AniListClient | undefined;
}

/**
 * Advanced stats (RF-53, epic #50). There is no Figma frame yet, so it reuses the secondary
 * screen layout. Everything is computed in the browser from the seen titles (ADR-0024). A free
 * user sees hours and episodes; genres, decades and formats stay behind Plus and are not even
 * rendered, so the lock shows placeholders instead of their data.
 */
export function StatsScreen({
  profile: initial,
  getToken,
  fetchFn = fetch,
  client,
}: StatsScreenProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const [profile] = useOwnProfile({ initial, getToken, fetchFn });
  const marks = useMarks(getToken, fetchFn);
  const seenIds = useMemo(
    () => (marks.data ?? []).filter((mark) => mark.status === 'seen').map((mark) => mark.anilistId),
    [marks.data],
  );
  const media = useMediaStats(seenIds, client);
  const stats = useMemo(() => (media.data ? computeStats(media.data) : undefined), [media.data]);

  let body: ReactNode;
  if (marks.isError) {
    body = <Failure message={t('stats.marksFailed')} retry={() => void marks.refetch()} />;
  } else if (marks.isPending) {
    body = <p className="stats__status">{t('stats.loading')}</p>;
  } else if (seenIds.length === 0) {
    body = (
      <p className="stats__status">
        {t('stats.empty')} <Link to="/">{t('stats.explore')}</Link>
      </p>
    );
  } else if (media.isError) {
    body = (
      <Failure message={anilistErrorMessage(media.error, t)} retry={() => void media.refetch()} />
    );
  } else if (!stats) {
    body = <p className="stats__status">{t('stats.loading')}</p>;
  } else {
    body = (
      <>
        <Totals stats={stats} />
        {profile.plan === 'plus' ? (
          <Details stats={stats} />
        ) : (
          <Locked plusAvailable={profile.plusAvailable === true} />
        )}
      </>
    );
  }

  return (
    <section className="privacy stats" aria-labelledby={titleId}>
      <Link className="card-preview__back" to="/perfil">
        {t('app.backToProfile')}
      </Link>
      <h1 className="card-step__title" id={titleId}>
        {t('stats.title')}
      </h1>
      {body}
    </section>
  );
}

function Failure({ message, retry }: { message: string; retry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="stats__status">
      <p role="alert">{message}</p>
      <button className="button button--secondary" type="button" onClick={retry}>
        {t('stats.retry')}
      </button>
    </div>
  );
}

function Totals({ stats }: { stats: Stats }) {
  const { t, i18n } = useTranslation();
  const number = new Intl.NumberFormat(i18n.language);
  const totals = [
    { key: 'hours', value: Math.round(stats.minutes / 60) },
    { key: 'episodes', value: stats.episodes },
    { key: 'titles', value: stats.titles },
  ] as const;
  return (
    <>
      <dl className="stats__totals">
        {totals.map(({ key, value }) => (
          <div className="stats__total" key={key}>
            <dt className="stats__label">{t(`stats.totals.${key}`)}</dt>
            <dd className="stats__number">{number.format(value)}</dd>
          </div>
        ))}
      </dl>
      {stats.unknownLength > 0 && (
        <p className="stats__note">{t('stats.unknownLength', { count: stats.unknownLength })}</p>
      )}
    </>
  );
}

function Bars({
  label,
  rows,
}: {
  label: string;
  rows: { key: string; name: string; value: string; share: number }[];
}) {
  const titleId = useId();
  return (
    <div className="stats__group">
      <h2 className="profile__group" id={titleId}>
        {label}
      </h2>
      <ul className="stats__bars" aria-labelledby={titleId}>
        {rows.map((row) => (
          <li className="stats__bar" key={row.key}>
            <span className="stats__name">{row.name}</span>
            <span className="stats__value">{row.value}</span>
            <span className="stats__fill" style={{ width: `${Math.round(row.share * 100)}%` }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Details({ stats }: { stats: Stats }) {
  const { t, i18n } = useTranslation();
  const number = new Intl.NumberFormat(i18n.language);
  const most = (counts: { count: number }[]) => Math.max(1, ...counts.map((row) => row.count));
  const topDecade = most(stats.decades);
  const topFormat = most(stats.formats);
  return (
    <>
      <Bars
        label={t('stats.genres')}
        rows={stats.genres.map((row) => ({
          key: row.genre,
          name: genreLabel(row.genre, t),
          value: t('stats.percent', { value: String(Math.round(row.share * 100)) }),
          share: row.share,
        }))}
      />
      <Bars
        label={t('stats.decades')}
        rows={stats.decades.map((row) => ({
          key: String(row.decade),
          name: t('stats.decade', { decade: String(row.decade) }),
          value: number.format(row.count),
          share: row.count / topDecade,
        }))}
      />
      <Bars
        label={t('stats.formats')}
        rows={stats.formats.map((row) => ({
          key: row.format,
          name: formatLabel(row.format, t),
          value: number.format(row.count),
          share: row.count / topFormat,
        }))}
      />
    </>
  );
}

const PLACEHOLDER_BARS = [0.8, 0.55, 0.35];

function Locked({ plusAvailable }: { plusAvailable: boolean }) {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <section className="stats__locked" aria-labelledby={titleId}>
      <div className="stats__placeholder" aria-hidden="true">
        {PLACEHOLDER_BARS.map((share) => (
          <span className="stats__fill" key={share} style={{ width: `${share * 100}%` }} />
        ))}
      </div>
      <div className="stats__offer">
        <h2 className="stats__offer-title" id={titleId}>
          <span aria-hidden="true">🔒 </span>
          {t('stats.lockedTitle')}
        </h2>
        {plusAvailable ? (
          <Link className="button" to="/perfil/plus">
            {t('stats.seePlus')}
          </Link>
        ) : (
          <p className="stats__note">{t('plus.soon')}</p>
        )}
      </div>
    </section>
  );
}
