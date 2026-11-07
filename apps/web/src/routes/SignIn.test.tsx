// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import { SignIn } from './SignIn';

afterEach(async () => {
  cleanup();
  await setLocale('es');
});

describe('SignIn', () => {
  it('invites to continue with Google in Spanish', () => {
    render(<SignIn onContinue={vi.fn()} busy={false} failed />);
    screen.getByRole('heading', { name: '¿Cuántos animes has visto de verdad?' });
    screen.getByRole('button', { name: 'Continuar con Google' });
    screen.getByText('No pudimos abrir Google. Vuelve a intentarlo.');
    screen.getByRole('link', { name: 'política de privacidad' });
  });

  it('speaks English when the language is English (#43)', async () => {
    await setLocale('en');
    render(<SignIn onContinue={vi.fn()} busy failed />);
    screen.getByRole('heading', { name: 'How many anime have you really watched?' });
    screen.getByRole('button', { name: 'Opening Google…' });
    screen.getByText("We couldn't open Google. Please try again.");
    screen.getByRole('link', { name: 'privacy policy' });
    expect(screen.queryByText('Abriendo Google…')).toBeNull();
  });
});
