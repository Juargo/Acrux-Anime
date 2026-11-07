import type { FranchiseOverride } from '@acrux/domain';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { AniListClient } from '../anilist/client';
import { defaultClient, useMediaByIds } from '../anilist/hooks';
import { OVERRIDES_KEY, overridesQuery } from '../franchise/use-franchise-overrides';
import {
  FranchiseOverridesError,
  type OverrideErrorKind,
  type OverrideRole,
  saveFranchiseOverride,
} from '../franchise-overrides-api';

const ROLES: readonly OverrideRole[] = ['core', 'extra', 'separate'];
const ANILIST_ID = /^[1-9]\d{0,9}$/;

type Status = { kind: 'saved'; rootId: number } | { kind: 'error'; error: OverrideErrorKind };

/**
 * The curator's corrections of franchise grouping (#42, RF-60). Only a curator sees the form;
 * the API checks the role on every save. Titles come from AniList and are never stored (RDI-15).
 */
export function CuratorScreen({
  curator,
  getToken,
  client = defaultClient,
  fetchFn = fetch,
}: {
  curator: boolean;
  getToken: () => Promise<string | null>;
  client?: AniListClient | undefined;
  fetchFn?: typeof fetch | undefined;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <section className="privacy curator" aria-labelledby={titleId}>
      <Link className="card-preview__back" to="/perfil">
        {t('app.backToProfile')}
      </Link>
      <h1 className="card-step__title" id={titleId}>
        {t('curator.title')}
      </h1>
      {curator ? (
        <CuratorTools getToken={getToken} client={client} fetchFn={fetchFn} />
      ) : (
        <p className="privacy__status">{t('curator.notCurator')}</p>
      )}
    </section>
  );
}

function CuratorTools({
  getToken,
  client,
  fetchFn,
}: {
  getToken: () => Promise<string | null>;
  client: AniListClient;
  fetchFn: typeof fetch;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const overrides = useQuery(overridesQuery(fetchFn));
  const rows = overrides.data ?? [];
  const ids = useMemo(
    () => [...new Set(rows.flatMap((row) => [row.anilistId, row.franchiseRootId]))],
    [rows],
  );
  const media = useMediaByIds(ids, client);
  const titleOf = (id: number) => {
    const found = media.data?.find((item) => item.id === id);
    const title = found?.title.english ?? found?.title.romaji ?? found?.title.native;
    return title ?? t('curator.unknownTitle', { id: String(id) });
  };

  const [entryId, setEntryId] = useState('');
  const [rootId, setRootId] = useState('');
  const [role, setRole] = useState<OverrideRole>('core');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const entryField = useId();
  const rootField = useId();
  const rootHint = useId();
  const listId = useId();

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!ANILIST_ID.test(entryId) || !ANILIST_ID.test(rootId)) {
      setStatus({ kind: 'error', error: 'invalid' });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const saved = await saveFranchiseOverride(
        getToken,
        Number(entryId),
        { franchiseRootId: Number(rootId), role },
        fetchFn,
      );
      // The API's CDN keeps the table five minutes: the curator sees the change at once.
      queryClient.setQueryData<FranchiseOverride[]>(OVERRIDES_KEY, (previous = []) =>
        [...previous.filter((row) => row.anilistId !== saved.anilistId), saved].sort(
          (a, b) => a.anilistId - b.anilistId,
        ),
      );
      setStatus({ kind: 'saved', rootId: saved.franchiseRootId });
    } catch (error) {
      setStatus({
        kind: 'error',
        error: error instanceof FranchiseOverridesError ? error.kind : 'failed',
      });
    } finally {
      setSaving(false);
    }
  }

  function edit(row: FranchiseOverride) {
    setEntryId(String(row.anilistId));
    setRootId(String(row.franchiseRootId));
    setRole(row.role);
    setStatus(null);
  }

  return (
    <>
      <p className="privacy__status">{t('curator.intro')}</p>
      <form className="curator__form" onSubmit={(event) => void save(event)}>
        <label className="profile-editor__label" htmlFor={entryField}>
          {t('curator.entryId')}
        </label>
        <input
          id={entryField}
          className="card-step__search"
          inputMode="numeric"
          autoComplete="off"
          value={entryId}
          onChange={(event) => setEntryId(event.target.value.trim())}
        />
        <label className="profile-editor__label" htmlFor={rootField}>
          {t('curator.rootId')}
        </label>
        <input
          id={rootField}
          className="card-step__search"
          inputMode="numeric"
          autoComplete="off"
          aria-describedby={rootHint}
          value={rootId}
          onChange={(event) => setRootId(event.target.value.trim())}
        />
        <p className="profile-editor__hint" id={rootHint}>
          {t('curator.rootHint')}
        </p>
        <fieldset className="privacy__options">
          <legend className="profile-editor__label">{t('curator.roleLegend')}</legend>
          {ROLES.map((option) => (
            <label key={option} className="privacy__option">
              <input
                type="radio"
                name="role"
                value={option}
                checked={role === option}
                onChange={() => setRole(option)}
              />
              <span className="privacy__option-text">
                <span className="privacy__option-label">{t(`curator.role.${option}`)}</span>
                <span className="privacy__option-detail">{t(`curator.roleHint.${option}`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <button className="button button--primary" type="submit" disabled={saving}>
          {saving ? t('curator.saving') : t('curator.save')}
        </button>
        <p className="profile-editor__hint">{t('curator.noUndo')}</p>
      </form>

      <div aria-live="polite">
        {status?.kind === 'saved' && (
          <p className="privacy__status">
            {t('curator.saved')}{' '}
            <Link to={`/franquicia/${status.rootId}`}>{t('curator.viewFranchise')}</Link>
          </p>
        )}
        {status?.kind === 'error' && (
          <p className="counter__error" role="alert">
            {t(`curator.errors.${status.error}`)}
          </p>
        )}
      </div>

      <h2 className="profile__group" id={listId}>
        {t('curator.list')}
      </h2>
      {overrides.isError ? (
        <div className="catalog__notice" role="alert">
          <p>{t('curator.loadFailed')}</p>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void overrides.refetch()}
          >
            {t('app.retry')}
          </button>
        </div>
      ) : !overrides.isSuccess ? null : rows.length === 0 ? (
        <p className="privacy__status">{t('curator.empty')}</p>
      ) : (
        <ul className="profile__rows" aria-labelledby={listId}>
          {rows.map((row) => (
            <li key={row.anilistId}>
              <button
                className="profile__row"
                type="button"
                aria-label={t('curator.change', { title: titleOf(row.anilistId) })}
                onClick={() => edit(row)}
              >
                <span>
                  <span>{titleOf(row.anilistId)}</span>
                  <br />
                  <small>
                    {t('curator.row', {
                      role: t(`curator.role.${row.role}`),
                      root: titleOf(row.franchiseRootId),
                    })}
                  </small>
                </span>
                <span className="profile__value" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
