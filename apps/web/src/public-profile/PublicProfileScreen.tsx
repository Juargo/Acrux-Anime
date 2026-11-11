import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useConsent } from '../analytics/AnalyticsContext';
import { errorMessage } from '../api-errors';
import type { CatalogClient } from '../catalog-source/client';
import { defaultClient } from '../catalog-source/hooks';
import { Avatar } from '../components/Avatar';
import { BadgeRow } from '../components/BadgeRow';
import { Logo } from '../components/Logo';
import { useCrawledFranchises } from '../counter/use-marked-franchises';
import { type ListRow, myList } from '../my-list/items';
import {
  fetchPublicMarks,
  fetchPublicProfile,
  isHandle,
  type PublicProfile,
  PublicProfileError,
} from './api';

// ADR-0030: no personal data in the properties, so not the handle either.
export type PublicProfileViewedEvent = { listVisibility: PublicProfile['listVisibility'] };

// Figma M14: up to six of the most recent complete sagas (L5 of odd/tasks/perfil-publico.md).
const RECENT_SAGAS = 6;
const STORE_KEY = ['catalog', 'public-franchises'] as const;

// The message of the API code that failed (ADR-0023), when it has one.
const codeMessage = (error: unknown) =>
  errorMessage(error instanceof PublicProfileError ? error.code : undefined);

function CallToAction() {
  const { t } = useTranslation();
  return (
    <aside className="public-profile__cta">
      <p>{t('publicProfile.ctaQuestion')}</p>
      <Link className="button button--primary" to="/">
        {t('publicProfile.ctaLink')}
      </Link>
    </aside>
  );
}

function Covers(props: { title: string; rows: ListRow[]; empty: string }) {
  return (
    <section className="public-profile__section" aria-label={props.title}>
      <h2 className="public-profile__label">{props.title}</h2>
      {props.rows.length === 0 ? (
        <p className="public-profile__empty">{props.empty}</p>
      ) : (
        <ul className="public-profile__covers">
          {props.rows.map((row) => (
            <li key={row.id} className="public-profile__cover">
              {row.coverUrl ? (
                <img src={row.coverUrl} alt={row.title} width={110} height={156} />
              ) : (
                <span className="public-profile__cover-empty" role="img" aria-label={row.title} />
              )}
              <span className="public-profile__cover-title">{row.title}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Presentational: the public list of Figma M14, from the owner's marks. */
function PublicList(props: {
  profile: PublicProfile;
  client: CatalogClient;
  fetchFn: typeof fetch;
}) {
  const { profile, client, fetchFn } = props;
  const { t } = useTranslation();
  const marks = useQuery({
    queryKey: ['public-profile', profile.handle, 'marks'],
    queryFn: () => fetchPublicMarks(profile.handle, fetchFn),
  });
  const crawled = useCrawledFranchises({
    client,
    marks: marks.data ?? undefined,
    crawl: true,
    storeKey: STORE_KEY,
    fetchFn,
  });
  const { franchises, known, ready } = crawled;
  const list = useMemo(
    () =>
      marks.data && ready
        ? myList(franchises, marks.data, known, 'franchise', new Date().toISOString())
        : null,
    [marks.data, franchises, known, ready],
  );

  if (marks.isError || crawled.failed) {
    return (
      <div className="catalog__notice" role="alert">
        <p>{codeMessage(marks.error) ?? t('publicProfile.listFailed')}</p>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => (marks.isError ? void marks.refetch() : crawled.retry())}
        >
          {t('app.retry')}
        </button>
      </div>
    );
  }
  // Made private since the summary loaded (RF-42): nothing of the list is shown.
  if (marks.data === null) return <PrivateNotice name={profile.displayName} />;
  if (!list) {
    return (
      <p className="catalog__state" role="status">
        {t('publicProfile.listLoading')}
      </p>
    );
  }
  const name = profile.displayName.trim() || t('publicProfile.someone');
  return (
    <>
      <Covers
        title={t('publicProfile.watching')}
        rows={list.watching}
        empty={t('publicProfile.watchingEmpty', { name })}
      />
      <Covers
        title={t('publicProfile.recent')}
        rows={list.seen.slice(0, RECENT_SAGAS)}
        empty={t('publicProfile.recentEmpty')}
      />
    </>
  );
}

function PrivateNotice({ name }: { name: string }) {
  const { t } = useTranslation();
  return (
    <div className="public-profile__private">
      <span className="public-profile__lock" aria-hidden="true">
        🔒
      </span>
      <p className="public-profile__private-title">
        {t('app.privateList', { name: name.trim() || t('publicProfile.someone') })}
      </p>
      <p className="public-profile__private-text">{t('publicProfile.privateText')}</p>
    </div>
  );
}

function Header() {
  const { t } = useTranslation();
  return (
    <header className="public-profile__bar">
      <Logo />
      <Link className="button button--secondary" to="/">
        {t('publicProfile.createCard')}
      </Link>
    </header>
  );
}

/**
 * Container: the public profile by link (RF-40 to RF-42, Figma M14/M15), without a session.
 * Private lists show only the summary; unknown handles show "Perfil no disponible".
 */
export function PublicProfileScreen({
  handle,
  client = defaultClient,
  fetchFn = fetch,
  onViewed,
}: {
  handle: string;
  client?: CatalogClient | undefined;
  fetchFn?: typeof fetch | undefined;
  onViewed?: ((event: PublicProfileViewedEvent) => void) | undefined;
}) {
  const { t } = useTranslation();
  const valid = isHandle(handle);
  const profile = useQuery({
    queryKey: ['public-profile', handle],
    queryFn: () => fetchPublicProfile(handle, fetchFn),
    enabled: valid,
  });
  const data = profile.data;
  const viewedRef = useRef(onViewed);
  viewedRef.current = onViewed;
  const sentRef = useRef(false);
  const listVisibility = data?.listVisibility;
  // A first-time visitor accepts analytics after the page loads: the visit is counted then,
  // once per page view (#46). Without analytics in the tree, it is counted on load.
  const consent = useConsent();

  useEffect(() => {
    if (!listVisibility || sentRef.current) return;
    if (consent !== undefined && consent !== 'granted') return;
    sentRef.current = true;
    viewedRef.current?.({ listVisibility });
  }, [listVisibility, consent]);

  useEffect(() => {
    document.title = data
      ? t('publicProfile.documentTitle', {
          name: data.displayName.trim() || t('app.noName'),
          handle: data.handle,
        })
      : 'Acrux';
    // The next screen must not keep someone's name in the title (analytics sends it, #46).
    return () => {
      document.title = 'Acrux';
    };
  }, [data, t]);

  let body: React.ReactNode;
  if (!valid || data === null) {
    body = (
      <section className="public-profile__missing">
        <h1>{t('publicProfile.missingTitle')}</h1>
        <p>{t('publicProfile.missingText')}</p>
      </section>
    );
  } else if (profile.isError) {
    body = (
      <div className="catalog__notice" role="alert">
        <p>{codeMessage(profile.error) ?? t('publicProfile.failed')}</p>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => void profile.refetch()}
        >
          {t('app.retry')}
        </button>
      </div>
    );
  } else if (!data) {
    body = (
      <p className="catalog__state" role="status">
        {t('publicProfile.loading')}
      </p>
    );
  } else {
    const name = data.displayName.trim() || t('app.noName');
    body = (
      <>
        <section className="public-profile__summary">
          <Avatar
            name={name}
            avatarUrl={data.avatarUrl}
            avatarPreset={data.avatarPreset}
            size={96}
            className="public-profile__avatar"
            decorative={!data.avatarUrl && !data.avatarPreset}
          />
          <h1 className="public-profile__name">{name}</h1>
          <p className="public-profile__handle">@{data.handle}</p>
          <BadgeRow ids={data.badges ?? []} className="public-profile__badges" />
          {data.shownTotal !== null && (
            <p className="public-profile__total">
              <span className="public-profile__count">{data.shownTotal}</span>
              <span className="public-profile__label">
                {t(data.shownMode === 'entry' ? 'app.total.entry' : 'app.total.franchise')}
              </span>
            </p>
          )}
        </section>
        {data.listVisibility === 'public' ? (
          <PublicList profile={data} client={client} fetchFn={fetchFn} />
        ) : (
          <PrivateNotice name={data.displayName} />
        )}
      </>
    );
  }

  return (
    <main className="public-profile">
      <Header />
      {body}
      <CallToAction />
    </main>
  );
}
