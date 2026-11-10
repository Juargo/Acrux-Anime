import { type ReactNode, useEffect, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { AniListClient } from '../anilist/client';
import { useMediaStats } from '../anilist/hooks';
import { anilistErrorMessage } from '../anilist/messages';
import { useMarks } from '../catalog/use-franchise-marks';
import { BadgeMark } from '../components/BadgeRow';
import { useOwnProfile } from '../profile/use-own-profile';
import type { Profile } from '../profile-api';
import { computeStats } from '../stats/compute';
import { type BadgeProgress, badgeProgress } from './catalog';

interface BadgesScreenProps {
  profile: Profile;
  getToken: () => Promise<string | null>;
  fetchFn?: typeof fetch | undefined;
  client?: AniListClient | undefined;
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

/**
 * Badges by milestones (RF-55, epic #50). There is no Figma frame yet, so it reuses the
 * secondary screen layout. Everyone earns them from the seen titles (the same stats as RF-53),
 * and the earned ones are saved for everyone; only Plus shows them on the public profile and
 * the card, so a purchase shows them at once.
 */
export function BadgesScreen({
  profile: initial,
  getToken,
  fetchFn = fetch,
  client,
}: BadgesScreenProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const [profile, save] = useOwnProfile({ initial, getToken, fetchFn });
  const marks = useMarks(getToken, fetchFn);
  const seenIds = useMemo(
    () => (marks.data ?? []).filter((mark) => mark.status === 'seen').map((mark) => mark.anilistId),
    [marks.data],
  );
  const media = useMediaStats(seenIds, client);
  const progress = useMemo(
    () => (media.data ? badgeProgress(computeStats(media.data)) : undefined),
    [media.data],
  );
  const earned = useMemo(
    () => progress?.filter((badge) => badge.earned).map((badge) => badge.id),
    [progress],
  );
  const stored = profile.badges ?? [];

  // Saved like the counter (ADR-0024): the browser computes them and the API checks the ids.
  // A failed save is retried on the next visit, so it shows nothing.
  useEffect(() => {
    if (earned && !sameList(earned, stored)) void save({ badges: earned }).catch(() => {});
  }, [earned, stored, save]);

  let body: ReactNode;
  if (marks.isError) {
    body = <Failure message={t('stats.marksFailed')} retry={() => void marks.refetch()} />;
  } else if (marks.isPending) {
    body = <p className="stats__status">{t('badges.loading')}</p>;
  } else if (seenIds.length === 0) {
    body = (
      <p className="stats__status">
        {t('badges.empty')} <Link to="/">{t('stats.explore')}</Link>
      </p>
    );
  } else if (media.isError) {
    body = (
      <Failure message={anilistErrorMessage(media.error, t)} retry={() => void media.refetch()} />
    );
  } else if (!progress || !earned) {
    body = <p className="stats__status">{t('badges.loading')}</p>;
  } else {
    body = (
      <>
        <p className="stats__note">
          {t('badges.count', { earned: String(earned.length), total: String(progress.length) })}
        </p>
        <BadgeList progress={progress} />
        <ShowOff plan={profile.plan} plusAvailable={profile.plusAvailable === true} />
      </>
    );
  }

  return (
    <section className="privacy stats" aria-labelledby={titleId}>
      <Link className="card-preview__back" to="/perfil">
        {t('app.backToProfile')}
      </Link>
      <h1 className="card-step__title" id={titleId}>
        {t('badges.title')}
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

function BadgeList({ progress }: { progress: BadgeProgress[] }) {
  const { t, i18n } = useTranslation();
  const number = new Intl.NumberFormat(i18n.language);
  return (
    <ul className="badges" aria-label={t('badges.list')}>
      {progress.map((badge) => {
        const name = t(`badges.name.${badge.kind}`, { goal: number.format(badge.goal) });
        return (
          <li
            key={badge.id}
            className={`badges__item${badge.earned ? ' badges__item--earned' : ''}`}
            aria-label={name}
          >
            <BadgeMark kind={badge.kind} earned={badge.earned} />
            <span className="badges__name">{name}</span>
            <span className="badges__state">
              {badge.earned
                ? t('badges.earned')
                : t('badges.progress', {
                    value: number.format(badge.value),
                    goal: number.format(badge.goal),
                  })}
            </span>
            {!badge.earned && (
              <span
                className="stats__fill"
                style={{ width: `${Math.round((badge.value / badge.goal) * 100)}%` }}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ShowOff({ plan, plusAvailable }: { plan: Profile['plan']; plusAvailable: boolean }) {
  const { t } = useTranslation();
  if (plan === 'plus') return <p className="stats__note">{t('badges.plusNote')}</p>;
  return (
    <div className="stats__offer">
      <p className="stats__note">{t('badges.freeNote')}</p>
      {plusAvailable ? (
        <Link className="button" to="/perfil/plus">
          {t('plus.seePlus')}
        </Link>
      ) : (
        <p className="stats__note">{t('plus.soon')}</p>
      )}
    </div>
  );
}
