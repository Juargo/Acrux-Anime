import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import type { AniListClient } from '../anilist/client';
import { defaultClient } from '../anilist/hooks';
import { Logo } from '../components/Logo';
import { useCrawledFranchises } from '../counter/use-marked-franchises';
import { type ListRow, myList } from '../my-list/items';
import { fetchPublicMarks, fetchPublicProfile, isHandle, type PublicProfile } from './api';

// ADR-0030: no personal data in the properties, so not the handle either.
export type PublicProfileViewedEvent = { listVisibility: PublicProfile['listVisibility'] };

// Figma M14: up to six of the most recent complete sagas (L5 of odd/tasks/perfil-publico.md).
const RECENT_SAGAS = 6;
const STORE_KEY = ['anilist', 'public-franchises'] as const;

function CallToAction() {
  return (
    <aside className="public-profile__cta">
      <p>¿Y tú, cuántos has visto?</p>
      <Link className="button button--primary" to="/">
        Crea tu tarjeta gratis
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
  client: AniListClient;
  fetchFn: typeof fetch;
}) {
  const { profile, client, fetchFn } = props;
  const marks = useQuery({
    queryKey: ['public-profile', profile.handle, 'marks'],
    queryFn: () => fetchPublicMarks(profile.handle, fetchFn),
  });
  const crawled = useCrawledFranchises({
    client,
    marks: marks.data ?? undefined,
    crawl: true,
    storeKey: STORE_KEY,
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
        <p>No pudimos cargar su lista. Vuelve a intentarlo.</p>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => (marks.isError ? void marks.refetch() : crawled.retry())}
        >
          Reintentar
        </button>
      </div>
    );
  }
  // Made private since the summary loaded (RF-42): nothing of the list is shown.
  if (marks.data === null) return <PrivateNotice name={profile.displayName} />;
  if (!list) {
    return (
      <p className="catalog__state" role="status">
        Cargando su lista…
      </p>
    );
  }
  const name = profile.displayName.trim() || 'Este usuario';
  return (
    <>
      <Covers
        title="VIENDO AHORA"
        rows={list.watching}
        empty={`${name} no está viendo nada ahora.`}
      />
      <Covers
        title="SAGAS MÁS RECIENTES"
        rows={list.seen.slice(0, RECENT_SAGAS)}
        empty="Aún no completó ninguna saga."
      />
    </>
  );
}

function PrivateNotice({ name }: { name: string }) {
  return (
    <div className="public-profile__private">
      <span className="public-profile__lock" aria-hidden="true">
        🔒
      </span>
      <p className="public-profile__private-title">
        {name.trim() || 'Este usuario'} mantiene su lista privada
      </p>
      <p className="public-profile__private-text">Solo se muestra su total.</p>
    </div>
  );
}

function Header() {
  return (
    <header className="public-profile__bar">
      <Logo />
      <Link className="button button--secondary" to="/">
        Crear mi tarjeta
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
  client?: AniListClient | undefined;
  fetchFn?: typeof fetch | undefined;
  onViewed?: ((event: PublicProfileViewedEvent) => void) | undefined;
}) {
  const valid = isHandle(handle);
  const profile = useQuery({
    queryKey: ['public-profile', handle],
    queryFn: () => fetchPublicProfile(handle, fetchFn),
    enabled: valid,
  });
  const data = profile.data;
  const viewedRef = useRef(onViewed);
  viewedRef.current = onViewed;
  const listVisibility = data?.listVisibility;

  useEffect(() => {
    if (listVisibility) viewedRef.current?.({ listVisibility });
  }, [listVisibility]);

  useEffect(() => {
    document.title = data
      ? `${data.displayName.trim() || 'Sin nombre'} (@${data.handle}) · Acrux`
      : 'Acrux';
  }, [data]);

  let body: React.ReactNode;
  if (!valid || data === null) {
    body = (
      <section className="public-profile__missing">
        <h1>Perfil no disponible</h1>
        <p>El enlace no existe o ya no está disponible.</p>
      </section>
    );
  } else if (profile.isError) {
    body = (
      <div className="catalog__notice" role="alert">
        <p>No pudimos cargar este perfil. Vuelve a intentarlo.</p>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => void profile.refetch()}
        >
          Reintentar
        </button>
      </div>
    );
  } else if (!data) {
    body = (
      <p className="catalog__state" role="status">
        Cargando el perfil…
      </p>
    );
  } else {
    const name = data.displayName.trim() || 'Sin nombre';
    body = (
      <>
        <section className="public-profile__summary">
          {data.avatarUrl ? (
            <img
              className="public-profile__avatar"
              src={data.avatarUrl}
              alt={name}
              width={96}
              height={96}
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              className="public-profile__avatar public-profile__avatar--initial"
              aria-hidden="true"
            >
              {name.charAt(0).toUpperCase()}
            </span>
          )}
          <h1 className="public-profile__name">{name}</h1>
          <p className="public-profile__handle">@{data.handle}</p>
          {data.shownTotal !== null && (
            <p className="public-profile__total">
              <span className="public-profile__count">{data.shownTotal}</span>
              <span className="public-profile__label">
                {data.shownMode === 'entry' ? 'ENTRADAS VISTAS' : 'ANIMES COMPLETOS'}
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
