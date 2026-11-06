import { useId, useState } from 'react';
import { Link } from 'react-router';
import { deleteAccount } from '../account-api';
import { useDataDownload } from './use-data-download';

const CONFIRMATION = 'BORRAR';
// RF-06: a session older than this signs in again before deleting.
const REAUTH_AFTER_MS = 24 * 60 * 60 * 1000;

// An unknown or unreadable start time does not block, so a missing field never locks anyone out.
export function sessionIsStale(startedAt: string | undefined, now: Date): boolean {
  if (!startedAt) return false;
  const started = new Date(startedAt).getTime();
  return Number.isFinite(started) && now.getTime() - started > REAUTH_AFTER_MS;
}

/**
 * Container: "Borrar tu cuenta" (RF-06, Figma M19). Deletes only after typing BORRAR; a
 * session older than 24 hours signs in again first. The Plus warning arrives with #50.
 */
export function DeleteAccountScreen({
  getToken,
  fetchFn,
  sessionStartedAt,
  now = () => new Date(),
  saveFile,
  onAccountDeleted,
  onReauthenticate,
}: {
  getToken: () => Promise<string | null>;
  fetchFn?: typeof fetch | undefined;
  sessionStartedAt: string | undefined;
  now?: () => Date;
  saveFile?: ((blob: Blob, name: string) => void) | undefined;
  onAccountDeleted: () => void;
  onReauthenticate: () => void;
}) {
  const titleId = useId();
  const inputId = useId();
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const data = useDataDownload({ getToken, fetchFn, saveFile });
  const stale = sessionIsStale(sessionStartedAt, now());

  async function remove() {
    setDeleting(true);
    setDeleteFailed(false);
    try {
      await deleteAccount(getToken, fetchFn);
      onAccountDeleted();
    } catch {
      setDeleteFailed(true);
      setDeleting(false);
    }
  }

  return (
    <section className="privacy delete-account" aria-labelledby={titleId}>
      <Link className="card-preview__back" to="/perfil">
        ‹ Perfil
      </Link>
      <h1 className="card-step__title" id={titleId}>
        Borrar tu cuenta
      </h1>
      <div className="privacy__status delete-account__facts">
        <p className="delete-account__gone">
          Se borra para siempre: tu perfil, tus marcas, tu enlace público y tu plan.
        </p>
        <p className="delete-account__kept">No se toca: tu lista de AniList.</p>
        <p className="delete-account__note">
          Las tarjetas que ya compartiste no se pueden recuperar.
        </p>
      </div>
      <button
        className="button button--secondary"
        type="button"
        disabled={data.downloading}
        onClick={() => void data.download()}
      >
        <span aria-hidden="true">⤓&nbsp;</span>
        Descargar mis datos antes
      </button>
      {data.failed && (
        <p className="counter__error" role="alert">
          No pudimos descargar tus datos. Vuelve a intentarlo.
        </p>
      )}
      {stale ? (
        <div className="delete-account__reauth">
          <p>Por seguridad, vuelve a iniciar sesión antes de borrar tu cuenta.</p>
          <button className="button button--secondary" type="button" onClick={onReauthenticate}>
            Volver a iniciar sesión
          </button>
        </div>
      ) : (
        <form
          className="delete-account__form"
          onSubmit={(event) => {
            event.preventDefault();
            if (typed.trim() === CONFIRMATION && !deleting) void remove();
          }}
        >
          <label className="profile-editor__label" htmlFor={inputId}>
            Escribe {CONFIRMATION} para confirmar
          </label>
          <input
            id={inputId}
            className="card-step__search delete-account__input"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
          {deleteFailed && (
            <p className="counter__error" role="alert">
              No pudimos terminar de borrar tu cuenta. Vuelve a intentarlo.
            </p>
          )}
          <button
            className="button button--danger"
            type="submit"
            disabled={typed.trim() !== CONFIRMATION || deleting}
          >
            Borrar mi cuenta para siempre
          </button>
        </form>
      )}
    </section>
  );
}
