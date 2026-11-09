import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import type { CardTheme, Profile } from '../profile-api';
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
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const titleId = useId();
  const query = search.trim().toLowerCase();
  const rows = query ? watching.filter((row) => row.title.toLowerCase().includes(query)) : watching;
  const full = chosen.length >= MAX_COVERS;

  return (
    <section className="card-step" aria-labelledby={titleId}>
      <h1 className="card-step__title" id={titleId}>
        {t('card.askTitle')}
      </h1>
      <p className="card-step__text">{t('card.askText')}</p>
      <input
        className="card-step__search"
        type="search"
        aria-label={t('card.search')}
        placeholder={t('card.search')}
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
          {t('card.skip')}
        </button>
        <button className="button button--primary" type="button" onClick={props.onContinue}>
          {t('card.continue', { count: chosen.length })}
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
  const { t } = useTranslation();
  if (props.state === 'done') {
    return (
      <p className="privacy__status" role="status">
        {t('card.madePublic')}
      </p>
    );
  }
  return (
    <section className="card-offer" aria-labelledby="card-offer-title">
      <h2 className="card-offer__title" id="card-offer-title">
        {t('card.offerTitle')}
      </h2>
      <p className="card-step__text">{t('card.offerText')}</p>
      {props.state === 'failed' && (
        <p className="counter__error" role="alert">
          {t('card.offerFailed')}
        </p>
      )}
      <div className="card-step__actions">
        <button className="button button--secondary" type="button" onClick={props.onClose}>
          {t('card.notNow')}
        </button>
        <button
          className="button button--primary"
          type="button"
          disabled={props.state === 'saving'}
          onClick={props.onAccept}
        >
          {t('card.makePublic')}
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
const THEMES: CardTheme[] = ['clasica', 'neon'];

/** Presentational: the "Estilo" chips (Figma M07, D20); Plus themes carry a lock for free users. */
function CardStyles(props: {
  selected: CardTheme;
  locked: boolean;
  onSelect: (theme: CardTheme) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="card-styles">
      <legend className="visually-hidden">{t('card.styles')}</legend>
      {THEMES.map((theme) => {
        const lock = props.locked && theme !== 'clasica';
        return (
          <label key={theme} className="card-styles__chip">
            <input
              className="visually-hidden"
              type="radio"
              name="card-theme"
              value={theme}
              checked={props.selected === theme}
              aria-label={
                lock ? t('card.lockedTheme', { theme: t(`card.theme.${theme}`) }) : undefined
              }
              onChange={() => props.onSelect(theme)}
            />
            {lock && <span aria-hidden="true">🔒 </span>}
            {t(`card.theme.${theme}`)}
          </label>
        );
      })}
    </fieldset>
  );
}

/** Presentational: Figma M20 (sheet) and D20 (bar): the theme a free user tries is Plus's. */
function PlusThemeOffer(props: { theme: CardTheme; onKeepClassic: () => void }) {
  const { t } = useTranslation();
  const titleId = useId();
  const name = t(`card.theme.${props.theme}`);
  return (
    <section className="card-plus-offer" aria-labelledby={titleId}>
      <span className="card-plus-offer__badge">{t('card.plusBadge')}</span>
      <h2 className="card-plus-offer__title" id={titleId}>
        {t('card.plusTitle', { theme: name })}
      </h2>
      <p className="card-plus-offer__text">{t('card.plusText')}</p>
      <Link className="button button--primary" to="/perfil/plus" state={{ theme: props.theme }}>
        {t('card.seePlus')}
      </Link>
      <button className="button button--ghost" type="button" onClick={props.onKeepClassic}>
        {t('card.keepClassic')}
      </button>
    </section>
  );
}

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
  const { t } = useTranslation();
  const [profile, saveProfile] = useOwnProfile({ initial, getToken, fetchFn });
  // null: no offer; open while the first card's offer waits for an answer (@CA-RF30-02).
  const [offer, setOffer] = useState<'open' | 'saving' | 'done' | 'failed' | null>(null);
  const [mode] = useCounterMode(counterMode);
  const marked = useMarkedFranchises({ client, getToken, fetchFn, crawl: true });
  const { marks, franchises, known, ready } = marked;
  const list = useMemo(
    () =>
      marks && ready ? myList(franchises, marks, known, mode, new Date().toISOString(), t) : null,
    [marks, franchises, known, ready, mode, t],
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
    ? shareCardContent({ list, mode, profile, chosen: step === 'preview' ? chosen : null, t })
    : null;

  // RF-52: the saved theme (always clasica without Plus) and a Plus theme a free user tries.
  const isPlus = profile.plan === 'plus';
  const savedTheme = isPlus ? (profile.cardTheme ?? 'clasica') : 'clasica';
  const [trying, setTrying] = useState<CardTheme | null>(null);
  const shownTheme = trying ?? savedTheme;
  const offersThemes = isPlus || profile.plusAvailable === true;

  function selectTheme(theme: CardTheme) {
    if (theme === 'clasica' || isPlus) {
      setTrying(null);
      if (theme !== savedTheme) saveProfile({ cardTheme: theme }).catch(() => {});
      return;
    }
    setTrying(theme);
  }

  const cardRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<Blob | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [sharing, setSharing] = useState(false);
  const generatedRef = useRef(onCardGenerated);
  generatedRef.current = onCardGenerated;
  // A new image whenever what the card shows changes.
  // The watermarked preview is never exported (RF-52), so there is no image while trying.
  const contentKey = content && !trying ? JSON.stringify({ content, theme: shownTheme }) : null;
  const coverCount = content?.covers.length ?? 0;

  useEffect(() => {
    setImage(null);
    if (step !== 'preview' || !contentKey || !cardRef.current) return;
    let cancelled = false;
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
        <p>{t('card.loadFailed')}</p>
        <button className="button button--secondary" type="button" onClick={marked.retry}>
          {t('card.retry')}
        </button>
      </div>
    );
  }
  if (!list || !content) {
    return (
      <p className="catalog__state" role="status">
        {t('card.loading')}
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
            {t('card.back')}
          </button>
        )}
        <h1 className="card-preview__title" id="card-preview-title">
          {t('card.title')}
        </h1>
      </div>
      <figure className="card-preview__card" aria-label={t('card.preview')}>
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
          theme={shownTheme}
          watermark={trying ? t('card.watermark') : null}
        />
      </figure>
      {offersThemes && <CardStyles selected={shownTheme} locked={!isPlus} onSelect={selectTheme} />}
      {trying && <PlusThemeOffer theme={trying} onKeepClassic={() => setTrying(null)} />}
      {failed ? (
        <div className="catalog__notice" role="alert">
          <p>{t('card.imageFailed')}</p>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
          >
            {t('card.retry')}
          </button>
        </div>
      ) : (
        !image &&
        !trying && (
          <p className="catalog__state" role="status">
            {t('card.preparing')}
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
          {t('card.share')}
        </button>
        <button
          className="button button--secondary"
          type="button"
          disabled={!image || sharing}
          onClick={() => send(true)}
        >
          {t('card.download')}
        </button>
      </div>
      {offer && (
        <FirstShareOffer state={offer} onAccept={makePublic} onClose={() => setOffer(null)} />
      )}
      <Link className="card-preview__privacy" to="/privacidad" state={{ from: '/tarjeta' }}>
        {t('card.whoSees')}{' '}
        <span>{t(profile.listVisibility === 'public' ? 'card.public' : 'card.private')} ›</span>
      </Link>
    </section>
  );
}
