// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { ExploreSwitch } from './ExploreSwitch';

afterEach(cleanup);

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ExploreSwitch />
    </MemoryRouter>,
  );
  return within(screen.getByRole('group', { name: 'Qué explorar' }));
}

describe('ExploreSwitch', () => {
  it('links Anime to / and Dramas to /dramas inside a labelled group (S2)', () => {
    const group = renderAt('/');

    expect(group.getByRole('link', { name: 'Anime' }).getAttribute('href')).toBe('/');
    expect(group.getByRole('link', { name: 'Dramas' }).getAttribute('href')).toBe('/dramas');
  });

  it('marks Anime as the current one on /', () => {
    const group = renderAt('/');

    expect(group.getByRole('link', { name: 'Anime' }).getAttribute('aria-current')).toBe('page');
    expect(group.getByRole('link', { name: 'Dramas' }).getAttribute('aria-current')).toBeNull();
  });

  it('marks Dramas as the current one on /dramas', () => {
    const group = renderAt('/dramas');

    expect(group.getByRole('link', { name: 'Dramas' }).getAttribute('aria-current')).toBe('page');
    expect(group.getByRole('link', { name: 'Anime' }).getAttribute('aria-current')).toBeNull();
  });
});
