import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { startCheckout } from '../billing-api';
import { useOwnProfile } from '../profile/use-own-profile';
import { fetchMe, type Profile } from '../profile-api';

const BENEFITS = ['themes', 'stats', 'wrapped', 'badges'] as const;

// Lemon Squeezy confirms the order by webhook a few seconds after the buyer comes back.
const DEFAULT_POLLING = { intervalMs: 2000, attempts: 30 };

type Confirmation = 'waiting' | 'confirmed' | 'pending';

/**
 * Container: Acrux Plus (epic #50, RF-50, RF-57). Figma M21–M24, adapted to the one-time
 * lifetime payment of ADR-0036: one offer, no renewal, no cancellation and no grace period.
 * The plan always comes from /me, which reads the database; this screen never decides it.
 */
export function PlusScreen({
  initial,
  getToken,
  fetchFn,
  openCheckout = (url) => window.location.assign(url),
  polling = DEFAULT_POLLING,
  onCheckoutStarted,
  onPurchased,
}: {
  initial: Profile;
  getToken: () => Promise<string | null>;
  fetchFn?: typeof fetch | undefined;
  openCheckout?: ((url: string) => void) | undefined;
  polling?: { intervalMs: number; attempts: number } | undefined;
  onCheckoutStarted?: (() => void) | undefined;
  onPurchased?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const [profile, , replace] = useOwnProfile({ initial, getToken, fetchFn });
  const [params] = useSearchParams();
  const returned = params.get('compra') === 'lista';
  const [confirmation, setConfirmation] = useState<Confirmation | null>(
    returned && profile.plan !== 'plus' ? 'waiting' : null,
  );
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);
  const purchased = useRef(onPurchased);
  purchased.current = onPurchased;

  // Back from the checkout: ask /me until the webhook has granted Plus, or give up politely.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per return from the checkout.
  useEffect(() => {
    if (confirmation !== 'waiting') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let left = polling.attempts;
    const poll = async () => {
      const me = await fetchMe(getToken, fetchFn).catch(() => null);
      if (cancelled) return;
      if (me?.status === 'ok' && me.profile.plan === 'plus') {
        replace(me.profile);
        setConfirmation('confirmed');
        purchased.current?.();
        return;
      }
      left -= 1;
      if (left <= 0) setConfirmation('pending');
      else timer = setTimeout(() => void poll(), polling.intervalMs);
    };
    timer = setTimeout(() => void poll(), polling.intervalMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  async function buy() {
    setStarting(true);
    setFailed(false);
    try {
      const url = await startCheckout(getToken, fetchFn);
      onCheckoutStarted?.();
      openCheckout(url);
    } catch {
      setFailed(true);
      setStarting(false);
    }
  }

  if (confirmation === 'confirmed') {
    return (
      <section className="privacy plus plus--welcome" aria-labelledby={titleId}>
        <p className="plus__star" aria-hidden="true">
          ✦
        </p>
        <h1 className="card-step__title" id={titleId}>
          {t('plus.welcomeTitle')}
        </h1>
        <p className="plus__lede">{t('plus.welcomeText')}</p>
        <Link className="button button--primary" to="/tarjeta">
          {t('plus.seeCard')}
        </Link>
      </section>
    );
  }

  return (
    <section className="privacy plus" aria-labelledby={titleId}>
      <Link className="card-preview__back" to="/perfil">
        {t('app.backToProfile')}
      </Link>
      <h1 className="card-step__title" id={titleId}>
        {t('plus.title')}
      </h1>

      {confirmation === 'waiting' && (
        <p className="privacy__status" role="status">
          {t('plus.confirming')}
        </p>
      )}
      {confirmation === 'pending' && (
        <div className="privacy__status plus__notice" role="status">
          <strong>{t('plus.pendingTitle')}</strong>
          <p>{t('plus.pendingText')}</p>
        </div>
      )}

      {profile.plan === 'plus' ? (
        <div className="privacy__status plus__plan">
          <p className="plus__plan-name">
            <strong>{t('plus.lifetime')}</strong>
            <span className="plus__badge">{t('plus.active')}</span>
          </p>
          <p>{t('plus.activeText')}</p>
        </div>
      ) : (
        <>
          <p className="plus__lede">{t('plus.tagline')}</p>
          <ul className="plus__benefits">
            {BENEFITS.map((benefit) => (
              <li key={benefit}>{t(`plus.benefits.${benefit}`)}</li>
            ))}
          </ul>
          {profile.plusAvailable ? (
            <>
              <p className="plus__price">{t('plus.oneTime')}</p>
              <p className="plus__note">{t('plus.basicsFree')}</p>
              {failed && (
                <div className="plus__error" role="alert">
                  <strong>{t('plus.failedTitle')}</strong>
                  <p>{t('plus.failedText')}</p>
                  <button
                    className="button button--primary"
                    type="button"
                    disabled={starting}
                    onClick={() => void buy()}
                  >
                    {t('plus.retry')}
                  </button>
                </div>
              )}
              {!failed && (
                <button
                  className="button button--primary plus__buy"
                  type="button"
                  disabled={starting}
                  onClick={() => void buy()}
                >
                  {t('plus.buy')}
                </button>
              )}
              <p className="plus__note">{t('plus.secure')}</p>
            </>
          ) : (
            <p className="plus__note">{t('plus.soon')}</p>
          )}
        </>
      )}
    </section>
  );
}
