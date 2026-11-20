// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { MainNav } from './MainNav';

afterEach(cleanup);

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <MainNav />
    </MemoryRouter>,
  );
  const current = screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent);
  return current;
}

describe('MainNav', () => {
  it('keeps the four items, with Explorar current on /', () => {
    expect(renderAt('/')).toEqual(['Explorar']);
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Explorar',
      'Mi lista',
      'Tarjeta',
      'Perfil',
    ]);
  });

  it('keeps Mi lista current on its own route', () => {
    expect(renderAt('/mi-lista')).toEqual(['Mi lista']);
  });

  it('keeps Explorar current on /dramas (S2)', () => {
    expect(renderAt('/dramas')).toEqual(['Explorar']);
  });
});
