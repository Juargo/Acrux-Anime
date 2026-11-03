import { Logo } from '../components/Logo';
import { ShareCardSample } from '../components/ShareCardSample';

// Figma M01 (28:2) and D01 (32:487), without the age checkbox (P-07 stays open).
export function SignIn(props: { onContinue: () => void; busy: boolean; failed: boolean }) {
  return (
    <main className="sign-in">
      <section className="sign-in__intro">
        <Logo />
        <h1 className="sign-in__title">¿Cuántos animes has visto de verdad?</h1>
        <p className="sign-in__lead">
          Marca la saga, no las temporadas, y compártelo en segundos.
          <span className="sign-in__lead-extra">
            {' '}
            Gratis, en español y sin anuncios en tu tarjeta.
          </span>
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
            {props.busy ? 'Abriendo Google…' : 'Continuar con Google'}
          </button>
          {props.failed && (
            <p className="sign-in__error" role="alert">
              No pudimos abrir Google. Vuelve a intentarlo.
            </p>
          )}
          <p className="sign-in__note">
            Al continuar aceptas la{' '}
            <a href="https://acruxanime.com/privacidad" target="_blank" rel="noreferrer">
              política de privacidad
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
