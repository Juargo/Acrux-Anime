/** Presentational: the search of a world, one tap away in its header (boards M2 and M3). */
export function WorldSearchButton(props: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      className="world-header__action"
      type="button"
      aria-label={props.label}
      aria-expanded={props.open}
      onClick={props.onToggle}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
        <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M16 16l5 5" />
        </g>
      </svg>
    </button>
  );
}
