import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { deleteAccount } from '../account-api';
import { errorCode, errorMessage } from '../api-errors';
import { useDataDownload } from './use-data-download';

// RF-06: a session older than this signs in again before deleting.
const REAUTH_AFTER_MS = 24 * 60 * 60 * 1000;

// An unknown or unreadable start time does not block, so a missing field never locks anyone out.
export function sessionIsStale(startedAt: string | undefined, now: Date): boolean {
  if (!startedAt) return false;
  const started = new Date(startedAt).getTime();
  return Number.isFinite(started) && now.getTime() - started > REAUTH_AFTER_MS;
}

/**
 * Container: "Borrar tu cuenta" (RF-06, Figma M19). Deletes only after typing BORRAR (DELETE in
 * English); a
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
  const { t } = useTranslation();
  // The word to type is in the user's language (#43).
  const confirmation = t('deleteAccount.confirmWord');
  const titleId = useId();
  const inputId = useId();
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  // The API code of the failed deletion (ADR-0023); null while nothing failed.
  const [deleteFailure, setDeleteFailure] = useState<{ code: string | undefined } | null>(null);
  const data = useDataDownload({ getToken, fetchFn, saveFile });
  const stale = sessionIsStale(sessionStartedAt, now());

  async function remove() {
    setDeleting(true);
    setDeleteFailure(null);
    try {
      await deleteAccount(getToken, fetchFn);
      onAccountDeleted();
    } catch (error) {
      setDeleteFailure({ code: errorCode(error) });
      setDeleting(false);
    }
  }

  return (
    <section className="privacy delete-account" aria-labelledby={titleId}>
      <Link className="card-preview__back" to="/perfil">
        {t('app.backToProfile')}
      </Link>
      <h1 className="card-step__title" id={titleId}>
        {t('deleteAccount.title')}
      </h1>
      <div className="privacy__status delete-account__facts">
        <p className="delete-account__gone">{t('deleteAccount.gone')}</p>
        <p className="delete-account__note">{t('deleteAccount.note')}</p>
      </div>
      <button
        className="button button--secondary"
        type="button"
        disabled={data.downloading}
        onClick={() => void data.download()}
      >
        <span aria-hidden="true">⤓&nbsp;</span>
        {t('deleteAccount.downloadFirst')}
      </button>
      {data.failed && (
        <p className="counter__error" role="alert">
          {errorMessage(data.code) ?? t('app.downloadFailed')}
        </p>
      )}
      {stale ? (
        <div className="delete-account__reauth">
          <p>{t('deleteAccount.reauthText')}</p>
          <button className="button button--secondary" type="button" onClick={onReauthenticate}>
            {t('deleteAccount.reauth')}
          </button>
        </div>
      ) : (
        <form
          className="delete-account__form"
          onSubmit={(event) => {
            event.preventDefault();
            if (typed.trim() === confirmation && !deleting) void remove();
          }}
        >
          <label className="profile-editor__label" htmlFor={inputId}>
            {t('deleteAccount.confirmLabel', { word: confirmation })}
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
          {deleteFailure && (
            <p className="counter__error" role="alert">
              {errorMessage(deleteFailure.code) ?? t('deleteAccount.failed')}
            </p>
          )}
          <button
            className="button button--danger"
            type="submit"
            disabled={typed.trim() !== confirmation || deleting}
          >
            {t('deleteAccount.submit')}
          </button>
        </form>
      )}
    </section>
  );
}
