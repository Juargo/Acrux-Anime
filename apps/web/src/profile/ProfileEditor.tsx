import { useId, useState } from 'react';
import { AVATAR_PRESETS, Avatar, PresetArt } from '../components/Avatar';
import type { AvatarPreset, Profile, ProfileChanges } from '../profile-api';
import { useOwnProfile } from './use-own-profile';

// RF-07 and Figma M06 ("5/30"): the API checks the same, trimmed and counted per character.
export const NAME_MAX = 30;
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
  const [failed, setFailed] = useState(false);
  const titleId = useId();
  const inputId = useId();
  const trimmed = name.trim();
  const valid = trimmed.length > 0;

  async function finish() {
    const changes: ProfileChanges = {};
    if (trimmed !== profile.displayName) changes.displayName = trimmed;
    if (preset !== profile.avatarPreset) changes.avatarPreset = preset;
    if (Object.keys(changes).length === 0) {
      onDone();
      return;
    }
    setSaving(true);
    setFailed(false);
    try {
      await save(changes);
      onDone();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="profile-editor" aria-labelledby={titleId}>
      <button className="card-preview__back" type="button" onClick={onBack}>
        ‹ Volver
      </button>
      <h1 className="card-step__title" id={titleId}>
        Así aparecerás en tu tarjeta
      </h1>
      <p className="card-step__text">Solo falta tu foto. Puedes cambiarla después en Ajustes.</p>
      <Avatar
        name={trimmed || profile.displayName}
        avatarUrl={profile.avatarUrl}
        avatarPreset={preset}
        size={88}
        className="profile-editor__avatar"
        decorative
      />
      <fieldset className="profile-editor__avatars">
        <legend className="profile-editor__legend">O elige uno de Acrux</legend>
        {profile.avatarUrl && (
          <label className="profile-editor__choice">
            <input
              type="radio"
              name="avatar"
              aria-label="Tu foto de Google"
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
        {AVATAR_PRESETS.map((key) => (
          <label key={key} className="profile-editor__choice">
            <input
              type="radio"
              name="avatar"
              aria-label={`Avatar ${key}`}
              checked={preset === key}
              onChange={() => setPreset(key)}
            />
            <span className={`avatar avatar--${key}`} aria-hidden="true">
              <PresetArt />
            </span>
          </label>
        ))}
      </fieldset>
      <label className="profile-editor__label" htmlFor={inputId}>
        Nombre visible
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
        <span>{valid ? 'Así te verán en tu tarjeta y tu perfil' : 'Escribe un nombre.'}</span>
        <span>
          {length(trimmed)}/{NAME_MAX}
        </span>
      </p>
      {failed && (
        <p className="counter__error" role="alert">
          No pudimos guardar. Vuelve a intentarlo.
        </p>
      )}
      <button
        className="button button--primary"
        type="button"
        disabled={!valid || saving}
        onClick={() => void finish()}
      >
        Continuar
      </button>
    </section>
  );
}
