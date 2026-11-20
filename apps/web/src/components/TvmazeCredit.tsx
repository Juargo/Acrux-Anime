import { useTranslation } from 'react-i18next';

export const TVMAZE_URL = 'https://www.tvmaze.com';
// License of the TVmaze data (ADR-0046); "Acerca de" names it next to the credit.
export const CC_BY_SA_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';

/**
 * Credit to TVmaze at the foot of every screen that shows a drama (ADR-0046): its data is
 * CC BY-SA 4.0 and asks for a link back. Anime screens keep only the MyAnimeList credit.
 */
export function TvmazeCredit() {
  const { t } = useTranslation();
  return (
    <p className="data-credit">
      {t('app.dataCredit')}{' '}
      <a href={TVMAZE_URL} target="_blank" rel="noreferrer">
        TVmaze
      </a>
    </p>
  );
}
