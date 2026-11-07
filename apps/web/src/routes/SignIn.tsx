import { useTranslation } from 'react-i18next';
import { Logo } from '../components/Logo';
import { ShareCardSample } from '../components/ShareCardSample';

// Figma M01 (28:2) and D01 (32:487), without the age checkbox (P-07 stays open).
// `notice` says what just happened, such as the account being deleted (#38).
export function SignIn(props: {
  onContinue: () => void;
  busy: boolean;
  failed: boolean;
  notice?: string | undefined;
}) {
  const { t } = useTranslation();
  return (
    <main className="sign-in">
      <section className="sign-in__intro">
        <Logo />
        {props.notice && (
          <p className="privacy__status" role="status">
            {props.notice}
          </p>
        )}
        <h1 className="sign-in__title">{t('signIn.title')}</h1>
        <p className="sign-in__lead">
          {t('signIn.lead')}
          <span className="sign-in__lead-extra"> {t('signIn.leadExtra')}</span>
        </p>
        <div className="sign-in__card sign-in__card--inline">
          <ShareCardSample />
        </div>
        <div className="sign-in__actions">
          <button
            className="button button--primary"
            type="button"
            onClick={props.onContinue}
            disabled={props.busy}
          >
            {props.busy ? t('signIn.opening') : t('signIn.continue')}
          </button>
          {props.failed && (
            <p className="sign-in__error" role="alert">
              {t('signIn.failed')}
            </p>
          )}
          <p className="sign-in__note">
            {t('signIn.privacyBefore')}{' '}
            <a href="https://acruxanime.com/privacidad" target="_blank" rel="noreferrer">
              {t('signIn.privacyLink')}
            </a>
          </p>
        </div>
      </section>
      <div className="sign-in__card sign-in__card--aside">
        <img className="sign-in__glow" src="/icons/brillo.svg" alt="" width={520} height={520} />
        <ShareCardSample />
      </div>
    </main>
  );
}
