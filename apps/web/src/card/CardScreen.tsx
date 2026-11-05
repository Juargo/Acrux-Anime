import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { AniListClient } from '../anilist/client';
import { defaultClient } from '../anilist/hooks';
import { ShareCard } from '../components/ShareCard';
import { useCounterMode } from '../counter/use-counter-mode';
import { useMarkedFranchises } from '../counter/use-marked-franchises';
import type { CounterMode } from '../counter/use-total-counter';
import { type ListRow, myList } from '../my-list/items';
import type { ListMadePublicEvent } from '../profile/PrivacyScreen';
import { ProfileEditor } from '../profile/ProfileEditor';
import { useOwnProfile } from '../profile/use-own-profile';
import type { Profile } from '../profile-api';
import { defaultChoice, MAX_COVERS, shareCardContent } from './content';
import { cardImage } from './image';
import { shareOrDownload } from './share';

// The events of the measurement plan (ADR-0030), with no personal data; sent with PostHog (#46).
export type CardGeneratedEvent = { mode: CounterMode; covers: number };
export type CardSharedEvent = { method: 'share' | 'download' };

/** Presentational: Figma M05, "¿Qué estás viendo ahora?" over the franchises in Viendo. */
function WatchingStep(props: {
  watching: ListRow[];
  chosen: string[];
  onToggle: (id: string) => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  const { watching, chosen, onToggle } = props;
  const [search, setSearch] = useState('');
  const titleId = useId();
  const query = search.trim().toLowerCase();
  const rows = query ? watching.filter((row) => row.title.toLowerCase().includes(query)) : watching;
  const full = chosen.length >= MAX_COVERS;

  return (
    <section className="card-step" aria-labelledby={titleId}>
      <h1 className="card-step__title" id={titleId}>
        ¿Qué estás viendo ahora?
      </h1>
      <p className="card-step__text">Aparecerá en tu tarjeta. Es opcional.</p>
      <input
        className="card-step__search"
        type="search"
        aria-label="Buscar anime"
        placeholder="Buscar anime"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <ul className="card-step__rows">
        {rows.map((row) => {
          const checked = chosen.includes(row.id);
          return (
            <li key={row.id}>
              <label className="card-choice">
                {row.coverUrl ? (
                  <img
                    className="list-row__cover"
                    src={row.coverUrl}
                    alt=""
                    width={40}
                    height={56}
                  />
                ) : (
                  <span className="list-row__cover" />
                )}
                <span className="list-row__text">
                  <span className="list-row__title">{row.title}</span>
                  <span className="list-row__detail">{row.detail}</span>
                </span>
                <input
                  className="card-choice__box"
                  type="checkbox"
                  aria-label={row.title}
                  checked={checked}
                  disabled={!checked && full}
                  onChange={() => onToggle(row.id)}
                />
              </label>
            </li>
          );
        })}
      </ul>
      <div className="card-step__actions">
        <button className="button button--secondary" type="button" onClick={props.onSkip}>
          Saltar
        </button>
        <button className="button button--primary" type="button" onClick={props.onContinue}>
          Continuar ({chosen.length})
        </button>
      </div>
    </section>
  );
}

/** Presentational: the offer after the first card shared with a private list (#36, ADR-0028). */
function FirstShareOffer(props: {
  state: 'open' | 'saving' | 'done' | 'failed';
  onAccept: () => void;
  onClose: () => void;
}) {
  if (props.state === 'done') {
    return (
      <p className="privacy__status" role="status">
        Listo, tu lista es pública.
      </p>
    );
  }
  return (
    <section className="card-offer" aria-labelledby="card-offer-title">
      <h2 className="card-offer__title" id="card-offer-title">
        ¿Hacemos pública tu lista?
      </h2>
      <p className="card-step__text">
        Así, quien escanee tu QR verá lo que estás viendo y tus sagas más recientes.
      </p>
      {props.state === 'failed' && (
        <p className="counter__error" role="alert">
          No pudimos guardar. Vuelve a intentarlo.
        </p>
      )}
      <div className="card-step__actions">
        <button className="button button--secondary" type="button" onClick={props.onClose}>
          Ahora no
        </button>
        <button
          className="button button--primary"
          type="button"
          disabled={props.state === 'saving'}
          onClick={props.onAccept}
        >
          Hacer pública
        </button>
      </div>
    </section>
  );
}

/**
 * Container: "Tarjeta" (RF-30, RF-31, Figma M05 and M07). Asks what the user is watching, then
 * renders the 9:16 card, makes its PNG at once (so the share sheet opens within the tap) and
 * shares or downloads it.
 */
export function CardScreen({
  getToken,
  client = defaultClient,
  fetchFn = fetch,
  counterMode,
  profile: initial,
  onCardGenerated,
  onCardShared,
  onListMadePublic,
}: {
  getToken: () => Promise<string | null>;
  client?: AniListClient | undefined;
  fetchFn?: typeof fetch | undefined;
  counterMode: CounterMode;
  profile: Profile;
  onCardGenerated?: ((event: CardGeneratedEvent) => void) | undefined;
  onCardShared?: ((event: CardSharedEvent) => void) | undefined;
  onListMadePublic?: ((event: ListMadePublicEvent) => void) | undefined;
}) {
  const [profile, saveProfile] = useOwnProfile({ initial, getToken, fetchFn });
  // null: no offer; open while the first card's offer waits for an answer (@CA-RF30-02).
  const [offer, setOffer] = useState<'open' | 'saving' | 'done' | 'failed' | null>(null);
  const [mode] = useCounterMode(counterMode);
  const marked = useMarkedFranchises({ client, getToken, fetchFn, crawl: true });
  const { marks, franchises, known, ready } = marked;
  const list = useMemo(
    () =>
      marks && ready ? myList(franchises, marks, known, mode, new Date().toISOString()) : null,
    [marks, franchises, known, ready, mode],
  );
  // null: the default choice ("Saltar" or not asked yet).
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [asking, setAsking] = useState(true);
  // Before the first card, the name and avatar it will show (#39, Figma M06, RN-M1).
  const [identityDone, setIdentityDone] = useState(false);
  const navigate = useNavigate();
  const watching = list?.watching ?? [];
  const step = !list
    ? 'ask'
    : asking && watching.length > 0
      ? 'ask'
      : !profile.cardShared && !identityDone
        ? 'identity'
        : 'preview';

  const content = list
    ? shareCardContent({ list, mode, profile, chosen: step === 'preview' ? chosen : null })
    : null;

  const cardRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<Blob | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [sharing, setSharing] = useState(false);
  const generatedRef = useRef(onCardGenerated);
  generatedRef.current = onCardGenerated;
  // A new image whenever what the card shows changes.
  const contentKey = content ? JSON.stringify(content) : null;
  const coverCount = content?.covers.length ?? 0;

  useEffect(() => {
    if (step !== 'preview' || !contentKey || !cardRef.current) return;
    let cancelled = false;
    setImage(null);
    setFailed(false);
    cardImage(cardRef.current, { retry: attempt > 0 }).then(
      (blob) => {
        if (cancelled) return;
        setImage(blob);
        generatedRef.current?.({ mode, covers: coverCount });
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [step, contentKey, coverCount, mode, attempt]);

  async function send(download: boolean) {
    if (!image) return;
    setSharing(true);
    try {
      const outcome = await shareOrDownload(image, { download });
      if (outcome !== 'cancelled') {
        onCardShared?.({ method: outcome === 'shared' ? 'share' : 'download' });
        if (!profile.cardShared) {
          // The first card: with a private list, the QR would only show the total (#36).
          if (profile.listVisibility === 'private') setOffer('open');
          saveProfile({ cardShared: true }).catch(() => {});
        }
      }
    } finally {
      setSharing(false);
    }
  }

  async function makePublic() {
    setOffer('saving');
    try {
      await saveProfile({ listVisibility: 'public' });
      setOffer('done');
      onListMadePublic?.({ source: 'first_share' });
    } catch {
      setOffer('failed');
    }
  }

  if (marked.failed) {
    return (
      <div className="catalog__notice" role="alert">
        <p>No pudimos cargar tu lista. Vuelve a intentarlo.</p>
        <button className="button button--secondary" type="button" onClick={marked.retry}>
          Reintentar
        </button>
      </div>
    );
  }
  if (!list || !content) {
    return (
      <p className="catalog__state" role="status">
        Cargando tu tarjeta…
      </p>
    );
  }
  if (step === 'identity') {
    return (
      <ProfileEditor
        profile={profile}
        getToken={getToken}
        fetchFn={fetchFn}
        onBack={() => (watching.length > 0 ? setAsking(true) : navigate('/'))}
        onDone={() => setIdentityDone(true)}
      />
    );
  }
  if (step === 'ask') {
    const current = chosen ?? defaultChoice(watching);
    return (
      <WatchingStep
        watching={watching}
        chosen={current}
        onToggle={(id) =>
          setChosen(current.includes(id) ? current.filter((x) => x !== id) : [...current, id])
        }
        onSkip={() => {
          setChosen(null);
          setAsking(false);
        }}
        onContinue={() => {
          setChosen(current);
          setAsking(false);
        }}
      />
    );
  }

  return (
    <section className="card-preview" aria-labelledby="card-preview-title">
      <div className="card-preview__bar">
        {watching.length > 0 && (
          <button className="card-preview__back" type="button" onClick={() => setAsking(true)}>
            ‹ Volver
          </button>
        )}
        <h1 className="card-preview__title" id="card-preview-title">
          Tu tarjeta
        </h1>
      </div>
      <figure className="card-preview__card" aria-label="Vista previa de tu tarjeta">
        <ShareCard
          ref={cardRef}
          name={content.name}
          initial={content.initial}
          avatarUrl={content.avatarUrl}
          avatarPreset={content.avatarPreset}
          total={content.total}
          label={content.label}
          covers={content.covers}
          url={`${window.location.host}/@${profile.handle}`}
          qr={`${window.location.origin}/@${profile.handle}`}
        />
      </figure>
      {failed ? (
        <div className="catalog__notice" role="alert">
          <p>No pudimos crear la imagen de tu tarjeta. Vuelve a intentarlo.</p>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Reintentar
          </button>
        </div>
      ) : (
        !image && (
          <p className="catalog__state" role="status">
            Preparando tu tarjeta…
          </p>
        )
      )}
      <div className="card-preview__actions">
        <button
          className="button button--primary"
          type="button"
          disabled={!image || sharing}
          onClick={() => send(false)}
        >
          Compartir
        </button>
        <button
          className="button button--secondary"
          type="button"
          disabled={!image || sharing}
          onClick={() => send(true)}
        >
          Descargar imagen
        </button>
      </div>
      {offer && (
        <FirstShareOffer state={offer} onAccept={makePublic} onClose={() => setOffer(null)} />
      )}
      <Link className="card-preview__privacy" to="/privacidad">
        ¿Quién ve tu lista?{' '}
        <span>{profile.listVisibility === 'public' ? 'Pública' : 'Privada'} ›</span>
      </Link>
    </section>
  );
}
