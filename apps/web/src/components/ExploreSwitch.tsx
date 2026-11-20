import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

/**
 * The switch at the top of Explorar: the anime catalog at `/` or the dramas at `/dramas`.
 * Two links, so each section has its own address and the back button works.
 */
export function ExploreSwitch() {
  const { t } = useTranslation();
  return (
    <fieldset className="explore-switch">
      <legend className="visually-hidden">{t('exploreSwitch.label')}</legend>
      <NavLink className="explore-switch__link" to="/" end>
        {t('exploreSwitch.anime')}
      </NavLink>
      <NavLink className="explore-switch__link" to="/dramas" end>
        {t('exploreSwitch.dramas')}
      </NavLink>
    </fieldset>
  );
}
