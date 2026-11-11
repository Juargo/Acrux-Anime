// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import { DeleteAccountScreen } from './DeleteAccountScreen';

afterEach(cleanup);

const NOW = new Date('2026-11-05T12:00:00.000Z');
const FRESH = '2026-11-05T10:00:00.000Z';
const STALE = '2026-11-04T11:00:00.000Z';

function renderScreen(
  options: {
    sessionStartedAt?: string;
    deleteStatus?: number;
    deleteProblem?: unknown;
    exportStatus?: number;
  } = {},
) {
  const requests: { url: string; method: string }[] = [];
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    requests.push({ url, method });
    if (url === '/api/v1/me' && method === 'DELETE') {
      if (options.deleteProblem) {
        return Response.json(options.deleteProblem, { status: options.deleteStatus ?? 503 });
      }
      return new Response(null, { status: options.deleteStatus ?? 204 });
    }
    if (url === '/api/v1/me/export') {
      return new Response('{"marks":[]}', { status: options.exportStatus ?? 200 });
    }
    throw new Error(`Unexpected request ${method} ${url}`);
  });
  const saveFile = vi.fn();
  const onAccountDeleted = vi.fn();
  const onReauthenticate = vi.fn();
  const router = createMemoryRouter(
    [
      {
        path: '/perfil/borrar-cuenta',
        element: (
          <DeleteAccountScreen
            getToken={async () => 'jwt'}
            fetchFn={fetchFn as unknown as typeof fetch}
            sessionStartedAt={'sessionStartedAt' in options ? options.sessionStartedAt : FRESH}
            now={() => NOW}
            saveFile={saveFile}
            onAccountDeleted={onAccountDeleted}
            onReauthenticate={onReauthenticate}
          />
        ),
      },
      { path: '/perfil', element: <p>Perfil</p> },
    ],
    { initialEntries: ['/perfil/borrar-cuenta'] },
  );
  render(<RouterProvider router={router} />);
  return { requests, saveFile, onAccountDeleted, onReauthenticate };
}

const confirm = () => screen.getByRole('button', { name: 'Borrar mi cuenta para siempre' });

describe('DeleteAccountScreen', () => {
  it('says what is deleted and mentions no external list (Figma M19, ADR-0043)', () => {
    renderScreen();
    expect(screen.getByRole('heading', { name: 'Borrar tu cuenta' })).toBeTruthy();
    expect(
      screen.getByText(
        'Se borra para siempre: tu perfil, tus marcas, tu enlace público y tu plan.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/No se toca/)).toBeNull();
    expect(
      screen.getByText('Las tarjetas que ya compartiste no se pueden recuperar.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: '‹ Perfil' }).getAttribute('href')).toBe('/perfil');
  });

  it('deletes only after typing BORRAR, then reports the deletion', async () => {
    const user = userEvent.setup();
    const { requests, onAccountDeleted } = renderScreen();
    expect(confirm().hasAttribute('disabled')).toBe(true);
    await user.type(screen.getByLabelText('Escribe BORRAR para confirmar'), 'borra');
    expect(confirm().hasAttribute('disabled')).toBe(true);
    await user.clear(screen.getByLabelText('Escribe BORRAR para confirmar'));
    await user.type(screen.getByLabelText('Escribe BORRAR para confirmar'), 'BORRAR');
    await user.click(confirm());
    expect(requests).toEqual([{ url: '/api/v1/me', method: 'DELETE' }]);
    expect(onAccountDeleted).toHaveBeenCalledTimes(1);
  });

  it('asks to retry when the deletion fails, without leaving', async () => {
    const user = userEvent.setup();
    const { onAccountDeleted } = renderScreen({ deleteStatus: 502 });
    await user.type(screen.getByLabelText('Escribe BORRAR para confirmar'), 'BORRAR');
    await user.click(confirm());
    expect((await screen.findByRole('alert')).textContent).toBe(
      'No pudimos terminar de borrar tu cuenta. Vuelve a intentarlo.',
    );
    expect(onAccountDeleted).not.toHaveBeenCalled();
    expect(confirm().hasAttribute('disabled')).toBe(false);
  });

  it('downloads the data before deleting', async () => {
    const user = userEvent.setup();
    const { requests, saveFile } = renderScreen();
    await user.click(screen.getByRole('button', { name: 'Descargar mis datos antes' }));
    expect(requests).toEqual([{ url: '/api/v1/me/export', method: 'GET' }]);
    expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), 'acrux-datos.json');
  });

  it('says so when the download fails', async () => {
    const user = userEvent.setup();
    const { saveFile } = renderScreen({ exportStatus: 503 });
    await user.click(screen.getByRole('button', { name: 'Descargar mis datos antes' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'No pudimos descargar tus datos. Vuelve a intentarlo.',
    );
    expect(saveFile).not.toHaveBeenCalled();
  });

  it('@CA-RF06-02 asks to sign in again when the session is older than 24 hours', async () => {
    const user = userEvent.setup();
    const { onReauthenticate, requests } = renderScreen({ sessionStartedAt: STALE });
    expect(screen.queryByRole('button', { name: 'Borrar mi cuenta para siempre' })).toBeNull();
    expect(
      screen.getByText('Por seguridad, vuelve a iniciar sesión antes de borrar tu cuenta.'),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Volver a iniciar sesión' }));
    expect(onReauthenticate).toHaveBeenCalledTimes(1);
    expect(requests).toEqual([]);
  });
});

describe('DeleteAccountScreen in English and API codes (#43)', () => {
  afterEach(() => setLocale('es'));

  it('says what is deleted in English and confirms with DELETE', async () => {
    await setLocale('en');
    const user = userEvent.setup();
    const { onAccountDeleted } = renderScreen();
    screen.getByRole('heading', { name: 'Delete your account' });
    screen.getByText('Deleted forever: your profile, your marks, your public link and your plan.');
    screen.getByRole('button', { name: 'Download my data first' });
    expect(screen.queryByText('Borrar tu cuenta')).toBeNull();
    await user.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await user.click(screen.getByRole('button', { name: 'Delete my account forever' }));
    expect(onAccountDeleted).toHaveBeenCalledTimes(1);
  });

  it("shows the API code's message when the deletion fails with one (ADR-0023)", async () => {
    const user = userEvent.setup();
    renderScreen({
      deleteStatus: 503,
      deleteProblem: { status: 503, code: 'account.auth_unavailable', requestId: 'r1' },
    });
    await user.type(screen.getByLabelText('Escribe BORRAR para confirmar'), 'BORRAR');
    await user.click(confirm());
    expect((await screen.findByRole('alert')).textContent).toBe(
      'No pudimos contactar al servicio de inicio de sesión. Vuelve a intentarlo.',
    );
  });
});
