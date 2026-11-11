import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogClient } from '../catalog-source/client';
import { defaultClient } from '../catalog-source/hooks';
import { patchMe, saveCounterMode } from '../profile-api';
import { useCounterMode } from './use-counter-mode';
import { type CounterMode, useTotalCounter } from './use-total-counter';

// ADR-0030: no personal data; the sender arrives with PostHog in the SPA (#46).
export type CounterModeChangedEvent = { mode: CounterMode };

const UNITS = {
  franchise: 'counter.franchiseUnit',
  entry: 'counter.entryUnit',
} as const satisfies Record<CounterMode, string>;

const OPTIONS = [
  { mode: 'franchise', label: 'counter.franchises' },
  { mode: 'entry', label: 'counter.entries' },
] as const satisfies readonly { mode: CounterMode; label: string }[];

// Figma M03 "Catálogo con contador": "48 animes" over "sagas completas".
export function CounterView(props: {
  value: number | undefined;
  mode: CounterMode;
  saving: boolean;
  failed: boolean;
  onModeChange: (mode: CounterMode) => void;
}) {
  const { value, mode } = props;
  const { t } = useTranslation();
  return (
    <section className="counter" aria-label={t('counter.label')}>
      <p className="counter__total" aria-live="polite" aria-busy={value === undefined}>
        {value === undefined ? t('counter.unknown') : t('counter.total', { count: value })}
      </p>
      <p className="counter__unit">{t(UNITS[mode])}</p>
      <fieldset className="segmented counter__switch" aria-label={t('counter.countBy')}>
        {OPTIONS.map((option) => (
          <button
            key={option.mode}
            className="segmented__option"
            type="button"
            aria-pressed={mode === option.mode}
            disabled={props.saving}
            onClick={() => {
              if (mode !== option.mode) props.onModeChange(option.mode);
            }}
          >
            {t(option.label)}
          </button>
        ))}
      </fieldset>
      {props.failed && (
        <p className="counter__error" role="alert">
          {t('counter.saveFailed')}
        </p>
      )}
    </section>
  );
}

/**
 * Container: the total counter at the top of the signed-in layout (RF-24, RF-25). The switch
 * changes at once and is saved in the profile; if saving fails it goes back (RNF-11).
 */
export function TotalCounter({
  initialMode,
  getToken,
  client = defaultClient,
  fetchFn = fetch,
  onCounterModeChanged,
  initialShown = null,
}: {
  initialMode: CounterMode;
  // The total already saved in the profile, so the same one is not saved again.
  initialShown?: { total: number; mode: CounterMode } | null | undefined;
  getToken: () => Promise<string | null>;
  client?: CatalogClient | undefined;
  fetchFn?: typeof fetch | undefined;
  onCounterModeChanged?: ((event: CounterModeChangedEvent) => void) | undefined;
}) {
  const [mode, setMode] = useCounterMode(initialMode);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const value = useTotalCounter({ mode, client, getToken, fetchFn });

  // The public profile and its preview image show the owner's last counter (#37): saved
  // whenever it changes, quietly; a failure is retried on the next change.
  const savedRef = useRef(initialShown);
  useEffect(() => {
    const saved = savedRef.current;
    if (value === undefined || (saved?.total === value && saved.mode === mode)) return;
    savedRef.current = { total: value, mode };
    patchMe(getToken, { shown: { total: value, mode } }, fetchFn).catch(() => {
      savedRef.current = saved;
    });
  }, [value, mode, getToken, fetchFn]);

  async function change(next: CounterMode) {
    const previous = mode;
    setMode(next);
    setSaving(true);
    setFailed(false);
    try {
      await saveCounterMode(getToken, next, fetchFn);
      onCounterModeChanged?.({ mode: next });
    } catch {
      setMode(previous);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <CounterView
      value={value}
      mode={mode}
      saving={saving}
      failed={failed}
      onModeChange={(next) => void change(next)}
    />
  );
}
