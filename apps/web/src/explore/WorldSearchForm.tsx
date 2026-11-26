import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { searchPath } from './world-search';

/**
 * The search of every world at once (board M1). It searches on submit, not while typing: the
 * answer is another screen, and both catalogs are asked.
 */
export function WorldSearchForm({ initial = '' }: { initial?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [input, setInput] = useState(initial);
  return (
    <form
      className="worlds__search"
      onSubmit={(event) => {
        event.preventDefault();
        const search = input.trim();
        if (search !== '') navigate(searchPath(search));
      }}
    >
      <input
        className="worlds__search-input"
        type="search"
        aria-label={t('worlds.searchAll')}
        placeholder={t('worlds.searchAll')}
        value={input}
        onChange={(event) => setInput(event.target.value)}
      />
      <button className="worlds__search-submit" type="submit" aria-label={t('worlds.searchSubmit')}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M16 16l5 5" />
          </g>
        </svg>
      </button>
    </form>
  );
}
