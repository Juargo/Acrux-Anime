// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import { UpdateNotice } from './UpdateNotice';

afterEach(cleanup);

describe('UpdateNotice (ADR-0016)', () => {
  // Criterion CA-ADR16-01 of issue #44 (ADR-0016); not a requirement in docs/criterios.
  it('says there is a new version, with a button to reload', async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    render(<UpdateNotice needRefresh onReload={onReload} onDismiss={vi.fn()} />);
    screen.getByRole('status');
    screen.getByText('Hay una nueva versión');
    await user.click(screen.getByRole('button', { name: 'Recargar' }));
    expect(onReload).toHaveBeenCalledOnce();
  });

  it('can wait until later', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<UpdateNotice needRefresh onReload={vi.fn()} onDismiss={onDismiss} />);
    await user.click(screen.getByRole('button', { name: 'Más tarde' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('shows nothing while there is no new version', () => {
    const { container } = render(
      <UpdateNotice needRefresh={false} onReload={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });
});

describe('UpdateNotice in English (#43)', () => {
  afterEach(() => setLocale('es'));

  it('says there is a new version in English', async () => {
    await setLocale('en');
    render(<UpdateNotice needRefresh onReload={vi.fn()} onDismiss={vi.fn()} />);
    screen.getByText('A new version is available');
    screen.getByRole('button', { name: 'Reload' });
    screen.getByRole('button', { name: 'Later' });
    expect(screen.queryByText('Hay una nueva versión')).toBeNull();
  });
});
