import { DISPLAY_NAME_MAX, displayNameProblem } from '@acrux/domain';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { errorCode, errorMessage } from '../api-errors';
import { AVATAR_PRESETS, Avatar, PLUS_AVATAR_PRESETS, PresetArt } from '../components/Avatar';
import type { AvatarPreset, Profile, ProfileChanges } from '../profile-api';
import { useOwnProfile } from './use-own-profile';

// RF-07 and Figma M06 ("5/30"): the API checks the same rules (@acrux/domain).
export const NAME_MAX = DISPLAY_NAME_MAX;
const length = (value: string) => [...value].length;

/**
 * Container: "Así aparecerás en tu tarjeta" (RF-07, Figma M06). The name and the avatar the card
 * and the public profile show: Google's photo or a preset Acrux one (no uploads in the beta).
 * Used from Perfil and, before the first card, inside the card flow.
 */
export function ProfileEditor({
  profile: initial,
  getToken,
  fetchFn,
  onBack,
  onDone,
}: {
  profile: Profile;
  getToken: () => Promise<string | null>;
  fetchFn?: typeof fetch | undefined;
  onBack: () => void;
  onDone: () => void;
}) {
  const [profile, save] = useOwnProfile({ initial, getToken, fetchFn });
  const [name, setName] = useState(profile.displayName);
  const [preset, setPreset] = useState<AvatarPreset | null>(profile.avatarPreset);
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();
  // The API code of the failed save (ADR-0023); null while nothing failed.
  const [failure, setFailure] = useState<{ code: string | undefined } | null>(null);
  const titleId = useId();
  const inputId = useId();
  const trimmed = name.trim();
  const problem = displayNameProblem(trimmed);
  const valid = problem === null;
  const isPlus = profile.plan === 'plus';
  const presetChoice = (key: AvatarPreset, locked = false) => (
    <label key={key} className="profile-editor__choice">
      <input
        type="radio"
        name="avatar"
        aria-label={t('profileEditor.preset', { name: t(`avatar.${key}`) })}
        checked={preset === key}
        disabled={locked}
        onChange={() => setPreset(key)}
      />
      <span
        className={`avatar avatar--${key}${locked ? ' profile-editor__locked' : ''}`}
        aria-hidden="true"
      >
        <PresetArt />
      </span>
    </label>
  );

  async function finish() {
    const changes: ProfileChanges = {};
    if (trimmed !== profile.displayName) changes.displayName = trimmed;
    if (preset !== profile.avatarPreset) changes.avatarPreset = preset;
    if (Object.keys(changes).length === 0) {
      onDone();
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      await save(changes);
      onDone();
    } catch (error) {
      setFailure({ code: errorCode(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="profile-editor" aria-labelledby={titleId}>
      <button className="card-preview__back" type="button" onClick={onBack}>
        {t('profileEditor.back')}
      </button>
      <h1 className="card-step__title" id={titleId}>
        {t('profileEditor.title')}
      </h1>
      <p className="card-step__text">{t('profileEditor.text')}</p>
      <Avatar
        name={trimmed || profile.displayName}
        avatarUrl={profile.avatarUrl}
        avatarPreset={preset}
        size={88}
        className="profile-editor__avatar"
        decorative
      />
      <fieldset className="profile-editor__avatars">
        <legend className="profile-editor__legend">{t('profileEditor.pickPreset')}</legend>
        {profile.avatarUrl && (
          <label className="profile-editor__choice">
            <input
              type="radio"
              name="avatar"
              aria-label={t('profileEditor.googlePhoto')}
              checked={preset === null}
              onChange={() => setPreset(null)}
            />
            <img
              className="avatar"
              src={profile.avatarUrl}
              alt=""
              width={44}
              height={44}
              referrerPolicy="no-referrer"
            />
          </label>
        )}
        {AVATAR_PRESETS.map((key) => presetChoice(key))}
      </fieldset>
      {/* RF-55: three more presets for Plus; a free user sees them locked, with the way to Plus. */}
      <fieldset className="profile-editor__avatars profile-editor__avatars--plus">
        <legend className="profile-editor__legend">{t('profileEditor.plusPresets')}</legend>
        {PLUS_AVATAR_PRESETS.map((key) => presetChoice(key, !isPlus))}
        {!isPlus &&
          (profile.plusAvailable ? (
            <Link className="profile-editor__plus" to="/perfil/plus">
              {t('plus.seePlus')}
            </Link>
          ) : (
            <p className="profile-editor__plus">{t('plus.soon')}</p>
          ))}
      </fieldset>
      <label className="profile-editor__label" htmlFor={inputId}>
        {t('profileEditor.nameLabel')}
      </label>
      <input
        id={inputId}
        className="card-step__search"
        type="text"
        autoComplete="nickname"
        value={name}
        onChange={(event) => setName([...event.target.value].slice(0, NAME_MAX).join(''))}
      />
      <p className="profile-editor__hint">
        <span>
          {problem === 'too-long'
            ? t('profileEditor.hints.too-long', { max: String(DISPLAY_NAME_MAX) })
            : problem
              ? t(`profileEditor.hints.${problem}`)
              : t('profileEditor.nameHint')}
        </span>
        <span>
          {length(trimmed)}/{NAME_MAX}
        </span>
      </p>
      {failure && (
        <p className="counter__error" role="alert">
          {errorMessage(failure.code) ?? t('app.saveFailed')}
        </p>
      )}
      <button
        className="button button--primary"
        type="button"
        disabled={!valid || saving}
        onClick={() => void finish()}
      >
        {t('profileEditor.continue')}
      </button>
    </section>
  );
}
