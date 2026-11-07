// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AboutScreen } from './AboutScreen';

afterEach(cleanup);

function renderAbout(version = '0.0.0 (abc1234)') {
  const router = createMemoryRouter(
    [{ path: '/perfil/acerca-de', element: <AboutScreen version={version} /> }],
    { initialEntries: ['/perfil/acerca-de'] },
  );
  render(<RouterProvider router={router} />);
}

const link = (name: string) => screen.getByRole('link', { name }).getAttribute('href');

describe('AboutScreen', () => {
  it('attributes the catalog to AniList and says Acrux is not affiliated (ADR-0024, RES-24)', () => {
    renderAbout();
    expect(screen.getByRole('heading', { name: 'Acerca de Acrux' })).toBeTruthy();
    expect(
      screen.getByText(
        'Los datos del catálogo los provee AniList. Acrux no está afiliada a AniList ni cuenta con su respaldo. Los títulos e imágenes de cada anime pertenecen a sus dueños.',
      ),
    ).toBeTruthy();
    expect(link('AniList')).toBe('https://anilist.co');
  });

  it('links to the privacy, terms and support pages of the landing', () => {
    renderAbout();
    expect(link('Privacidad')).toBe('https://acruxanime.com/privacidad');
    expect(link('Términos')).toBe('https://acruxanime.com/terminos');
    expect(link('Soporte')).toBe('https://acruxanime.com/soporte');
    expect(link('‹ Perfil')).toBe('/perfil');
  });

  it('shows the app version', () => {
    renderAbout('0.0.0 (abc1234)');
    expect(screen.getByText('Versión 0.0.0 (abc1234)')).toBeTruthy();
  });
});
