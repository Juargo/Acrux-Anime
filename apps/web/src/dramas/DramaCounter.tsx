import { useTranslation } from 'react-i18next';
import { useDramaMarkList } from './use-drama-marks';

/**
 * The counter of the drama section (#154): the dramas marked as seen, apart from the anime
 * counter, which it replaces at the top of /dramas. Watching does not count.
 */
export function DramaCounter(props: {
  getToken: () => Promise<string | null>;
  fetchFn?: typeof fetch | undefined;
}) {
  const { t } = useTranslation();
  const marks = useDramaMarkList(props).data;
  const seen = marks?.filter((mark) => mark.status === 'seen').length;
  return (
    <section className="counter" aria-label={t('dramas.counter.label')}>
      <p className="counter__total" aria-live="polite" aria-busy={seen === undefined}>
        {seen === undefined
          ? t('dramas.counter.unknown')
          : t('dramas.counter.total', { count: seen })}
      </p>
      <p className="counter__unit">{t('dramas.counter.unit')}</p>
    </section>
  );
}
