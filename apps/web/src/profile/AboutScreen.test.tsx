// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
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
  it('attributes the catalog to MyAnimeList and says Acrux is not affiliated (ADR-0024, RES-24)', () => {
    renderAbout();
    expect(screen.getByRole('heading', { name: 'Acerca de Acrux' })).toBeTruthy();
    expect(
      screen.getByText(
        'Los datos del catálogo los provee MyAnimeList. Acrux no está afiliada a MyAnimeList ni cuenta con su respaldo. Los títulos e imágenes de cada anime pertenecen a sus dueños.',
      ),
    ).toBeTruthy();
    expect(link('MyAnimeList')).toBe('https://myanimelist.net');
  });

  it('credits TVmaze for the drama data and names its CC BY-SA 4.0 license (#150, ADR-0046)', () => {
    renderAbout();
    expect(
      screen.getByText(
        'Los datos de los dramas los provee TVmaze, bajo la licencia CC BY-SA 4.0. Acrux no está afiliada a TVmaze ni cuenta con su respaldo.',
      ),
    ).toBeTruthy();
    expect(link('TVmaze')).toBe('https://www.tvmaze.com');
    expect(link('CC BY-SA 4.0')).toBe('https://creativecommons.org/licenses/by-sa/4.0/');
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

describe('AboutScreen in English (#43)', () => {
  afterEach(() => setLocale('es'));

  it('shows the attribution, links and version in English', async () => {
    await setLocale('en');
    renderAbout('0.0.0 (abc1234)');
    screen.getByRole('heading', { name: 'About Acrux' });
    expect(link('Privacy')).toBe('https://acruxanime.com/privacidad');
    expect(link('Terms')).toBe('https://acruxanime.com/terminos');
    expect(link('Support')).toBe('https://acruxanime.com/soporte');
    expect(link('‹ Profile')).toBe('/perfil');
    screen.getByText('Version 0.0.0 (abc1234)');
    screen.getByText(
      'Drama data is provided by TVmaze under the CC BY-SA 4.0 license. Acrux is not affiliated with or endorsed by TVmaze.',
    );
    expect(screen.queryByText('Versión 0.0.0 (abc1234)')).toBeNull();
  });
});
