import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

// Figma M03/M12/M16: the bar at the bottom on phones, the sidebar of D12 on wide screens.
const ITEMS = [
  {
    to: '/',
    label: 'explore',
    icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  },
  {
    to: '/mi-lista',
    label: 'myList',
    icon: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  },
  {
    to: '/tarjeta',
    label: 'card',
    icon: 'M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2',
  },
  {
    to: '/perfil',
    label: 'profile',
    icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  },
] as const;

export function MainNav() {
  const { t } = useTranslation();
  return (
    <nav className="main-nav" aria-label={t('nav.label')}>
      {ITEMS.map((item) => (
        <NavLink key={item.to} className="main-nav__link" to={item.to} end>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
            <path
              d={item.icon}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t(`nav.${item.label}`)}
        </NavLink>
      ))}
    </nav>
  );
}
