import { useTranslation } from 'react-i18next';

export const MAL_URL = 'https://myanimelist.net';

/**
 * Credit to the data source at the foot of every screen that shows catalog data (ADR-0043):
 * MyAnimeList asks for credit wherever its data is used. It only names the source (RES-24).
 */
export function DataCredit() {
  const { t } = useTranslation();
  return (
    <p className="data-credit">
      {t('app.dataCredit')}{' '}
      <a href={MAL_URL} target="_blank" rel="noreferrer">
        MyAnimeList
      </a>
    </p>
  );
}
