import { NavLink } from 'react-router';

// Figma M03/M12: the bar at the bottom on phones, the sidebar of D12 on wide screens. Tarjeta
// (#36) and Perfil (#39) join when they exist (S5 of odd/tasks/mi-lista.md).
const ITEMS = [
  {
    to: '/',
    label: 'Explorar',
    icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  },
  {
    to: '/mi-lista',
    label: 'Mi lista',
    icon: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  },
];

export function MainNav() {
  return (
    <nav className="main-nav" aria-label="Principal">
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
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
