import { isLocale, type Locale, locales } from '@acrux/i18n';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { accountLocale, setLocale } from '../i18n';
import type { Profile, ProfileChanges } from '../profile-api';

const DEVICE = 'device';

/**
 * "Idioma" in Perfil (RF-71, #43): the whole app changes at once, the choice is saved in the
 * account, and it goes back if saving fails. "Idioma del dispositivo" saves null.
 */
export function LanguageRow({
  locale,
  save,
}: {
  locale: Profile['locale'];
  save: (changes: ProfileChanges) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [choice, setChoice] = useState<Locale | null>(locale);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function choose(value: string) {
    const next = isLocale(value) ? value : null;
    const previous = choice;
    setChoice(next);
    setSaving(true);
    setFailed(false);
    await setLocale(accountLocale(next));
    try {
      await save({ locale: next });
    } catch {
      setChoice(previous);
      await setLocale(accountLocale(previous));
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <label className="profile__row" htmlFor={id}>
        <span>{t('language.label')}</span>
        <select
          id={id}
          className="profile__select"
          value={choice ?? DEVICE}
          disabled={saving}
          onChange={(event) => void choose(event.target.value)}
        >
          <option value={DEVICE}>{t('language.device')}</option>
          {locales.map((code) => (
            <option key={code} value={code}>
              {t(`language.${code}`)}
            </option>
          ))}
        </select>
      </label>
      {failed && (
        <p className="counter__error" role="alert">
          {t('language.saveFailed')}
        </p>
      )}
    </>
  );
}
