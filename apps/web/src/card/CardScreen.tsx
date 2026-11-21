import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AdSlot } from '../ads/AdSlot';
import type { CatalogClient } from '../catalog-source/client';
import { defaultClient } from '../catalog-source/hooks';
import { DataCredit } from '../components/DataCredit';
import { ShareCard } from '../components/ShareCard';
import { TvmazeCredit } from '../components/TvmazeCredit';
import { useCounterMode } from '../counter/use-counter-mode';
import { useMarkedFranchises } from '../counter/use-marked-franchises';
import type { CounterMode } from '../counter/use-total-counter';
import type { DramaClient } from '../drama-source/client';
import { defaultDramaClient, useDramasByIds } from '../drama-source/hooks';
import { useDramaMarkList } from '../dramas/use-drama-marks';
import { dramaRows } from '../my-list/drama-rows';
import { myList } from '../my-list/items';
import type { ListMadePublicEvent } from '../profile/PrivacyScreen';
import { useOwnProfile } from '../profile/use-own-profile';
import type { Profile } from '../profile-api';
import {
  animeChoices,
  type CardChoice,
  defaultChoice,
  dramaChoices,
  MAX_ANIME,
  MAX_DRAMAS,
  shareCardContent,
} from './content';
import { cardImage } from './image';
import { shareOrDownload } from './share';

// The events of the measurement plan (ADR-0030), with no personal data; sent with PostHog (#46).
export type CardGeneratedEvent = { mode: CounterMode; covers: number };
export type CardSharedEvent = { method: 'share' | 'download' };

/** Presentational: one group of the picker, "Anime · 1 de 2", with a checkbox per row. */
function ChoiceGroup(props: {
  legend: string;
  choices: CardChoice[];
  chosen: string[];
  max: number;
  onToggle: (id: string) => void;
  // Shown instead of the rows: nothing marked, nothing matching the search, or not loaded.
  empty: ReactNode;
}) {
  const { choices, chosen } = props;
  // With room for one, choosing another replaces it, so no row is ever closed.
  const full = props.max > 1 && chosen.length >= props.max;
  return (
    <fieldset className="card-picker__group">
      <legend className="card-picker__legend">{props.legend}</legend>
      {choices.length === 0 ? (
        <p className="card-picker__empty">{props.empty}</p>
      ) : (
        <ul className="card-step__rows">
          {choices.map((choice) => {
            const checked = chosen.includes(choice.id);
            return (
              <li key={choice.id}>
                <label className="card-choice">
                  {choice.coverUrl ? (
                    <img
                      className="list-row__cover"
                      src={choice.coverUrl}
                      alt=""
                      width={40}
                      height={56}
                      loading="lazy"
                    />
                  ) : (
                    <span className="list-row__cover" />
                  )}
                  <span className="list-row__text">
                    <span className="list-row__title">{choice.title}</span>
                    <span className="list-row__detail">{choice.detail}</span>
                  </span>
                  <input
                    className="card-choice__box"
                    type="checkbox"
                    aria-label={choice.title}
                    checked={checked}
                    disabled={!checked && full}
                    onChange={() => props.onToggle(choice.id)}
                  />
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}

/**
 * Presentational: under the card, what it shows from "Mi lista": one anime and one drama, what
 * the user is watching or wants to recommend (RF-30).
 */
function CardPicker(props: {
  anime: CardChoice[];
  dramas: CardChoice[];
  chosenAnime: string[];
  chosenDramas: string[];
  dramasFailed: boolean;
  onToggleAnime: (id: string) => void;
  onToggleDrama: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const titleId = useId();
  const query = search.trim().toLowerCase();
  const matching = (choices: CardChoice[]) =>
    query ? choices.filter((choice) => choice.title.toLowerCase().includes(query)) : choices;
  const noMatches = t('card.noMatches');

  return (
    <section className="card-picker" aria-labelledby={titleId}>
      <h2 className="card-picker__title" id={titleId}>
        {t('card.pickTitle')}
      </h2>
      <p className="card-step__text">{t('card.pickText')}</p>
      {props.anime.length + props.dramas.length > 0 && (
        <input
          className="card-step__search"
          type="search"
          aria-label={t('card.search')}
          placeholder={t('card.search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      )}
      <ChoiceGroup
        legend={t('card.pickAnime', {
          chosen: String(props.chosenAnime.length),
          max: String(MAX_ANIME),
        })}
        choices={matching(props.anime)}
        chosen={props.chosenAnime}
        max={MAX_ANIME}
        onToggle={props.onToggleAnime}
        empty={
          props.anime.length > 0 ? (
            noMatches
          ) : (
            <>
              {t('card.noAnime')} <Link to="/">{t('card.exploreAnime')}</Link>
            </>
          )
        }
      />
      <ChoiceGroup
        legend={t('card.pickDramas', {
          chosen: String(props.chosenDramas.length),
          max: String(MAX_DRAMAS),
        })}
        choices={matching(props.dramas)}
        chosen={props.chosenDramas}
        max={MAX_DRAMAS}
        onToggle={props.onToggleDrama}
        empty={
          props.dramasFailed ? (
            t('card.dramasFailed')
          ) : props.dramas.length > 0 ? (
            noMatches
          ) : (
            <>
              {t('card.noDramas')} <Link to="/dramas">{t('card.exploreDramas')}</Link>
            </>
          )
        }
      />
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
 * Container: "Tarjeta" (RF-30, RF-31, Figma M07). Opens on the 9:16 card, makes its PNG at once
 * (so the share sheet opens within the tap) and shares or downloads it; under the card, the
 * user chooses the anime and dramas of their list that it shows.
 */
export function CardScreen({
  getToken,
  client = defaultClient,
  dramaClient = defaultDramaClient,
  fetchFn = fetch,
  counterMode,
  profile: initial,
  onCardGenerated,
  onCardShared,
  onListMadePublic,
}: {
  getToken: () => Promise<string | null>;
  client?: CatalogClient | undefined;
  dramaClient?: DramaClient | undefined;
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
  const { marks, franchises, known } = marked;
  const list = useMemo(
    () =>
      marks && marked.ready
        ? myList(franchises, marks, known, mode, new Date().toISOString(), t)
        : null,
    [marks, franchises, known, marked.ready, mode, t],
  );
  // The dramas are an extra of the card: when they cannot be loaded, it goes without them.
  const dramaMarks = useDramaMarkList({ getToken, fetchFn });
  const dramaIds = useMemo(
    () => (dramaMarks.data ?? []).map((mark) => mark.dramaId),
    [dramaMarks.data],
  );
  const dramaCatalog = useDramasByIds(dramaIds, dramaClient);
  const dramasSettled =
    dramaMarks.isError ||
    (dramaMarks.data !== undefined &&
      (dramaIds.length === 0 || dramaCatalog.data !== undefined || dramaCatalog.isError));
  const dramasFailed = dramaMarks.isError || (dramaCatalog.isError && !dramaCatalog.data);
  const anime = useMemo(() => (list ? animeChoices(list) : []), [list]);
  const dramas = useMemo(
    () => dramaChoices(dramaRows(dramaMarks.data ?? [], dramaCatalog.data ?? []), t),
    [dramaMarks.data, dramaCatalog.data, t],
  );
  // null: what the user is watching, until they choose.
  const [pickedAnime, setPickedAnime] = useState<string[] | null>(null);
  const [pickedDramas, setPickedDramas] = useState<string[] | null>(null);
  // Only what is still in the list counts against the limit.
  const chosenAnime = (pickedAnime ?? defaultChoice(anime, MAX_ANIME)).filter((id) =>
    anime.some((choice) => choice.id === id),
  );
  const chosenDramas = (pickedDramas ?? defaultChoice(dramas, MAX_DRAMAS)).filter((id) =>
    dramas.some((choice) => choice.id === id),
  );
  // Past the limit, the newest choice takes the place of the oldest.
  const toggled = (chosen: string[], id: string, max: number) =>
    chosen.includes(id) ? chosen.filter((other) => other !== id) : [...chosen, id].slice(-max);
  const ready = list !== null && dramasSettled;

  const content =
    list && ready
      ? shareCardContent({
          list,
          mode,
          profile,
          anime,
          dramas,
          // The seen dramas join the summary once one is marked.
          dramasSeen: dramaMarks.data?.length
            ? dramaMarks.data.filter((mark) => mark.status === 'seen').length
            : null,
          dramasWatching: (dramaMarks.data ?? []).filter((mark) => mark.status === 'watching')
            .length,
          chosenAnime,
          chosenDramas,
          t,
        })
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
  const coverCount = content?.blocks.filter((block) => block.cover).length ?? 0;

  useEffect(() => {
    if (!contentKey || !cardRef.current) return;
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
  }, [contentKey, coverCount, mode, attempt]);

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
  return (
    <section className="card-preview" aria-labelledby="card-preview-title">
      <div className="card-preview__bar">
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
          blocks={content.blocks}
          badges={content.badges}
          url={`${window.location.host}/@${profile.handle}`}
          qr={`${window.location.origin}/@${profile.handle}`}
        />
      </figure>
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
        !image && (
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
      <CardPicker
        anime={anime}
        dramas={dramas}
        chosenAnime={chosenAnime}
        chosenDramas={chosenDramas}
        dramasFailed={dramasFailed}
        onToggleAnime={(id) => setPickedAnime(toggled(chosenAnime, id, MAX_ANIME))}
        onToggleDrama={(id) => setPickedDramas(toggled(chosenDramas, id, MAX_DRAMAS))}
      />
      {/* RF-58, ADR-0038: outside the card, so never in the shared image (RF-33). */}
      <AdSlot />
      <Link className="card-preview__privacy" to="/privacidad" state={{ from: '/tarjeta' }}>
        {t('card.whoSees')}{' '}
        <span>{t(profile.listVisibility === 'public' ? 'card.public' : 'card.private')} ›</span>
      </Link>
      <DataCredit />
      {dramas.length > 0 && <TvmazeCredit />}
    </section>
  );
}
