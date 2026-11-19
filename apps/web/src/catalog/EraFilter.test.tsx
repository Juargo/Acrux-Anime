// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import { EraFilter } from './EraFilter';

afterEach(cleanup);

const CURRENT_YEAR = 2026;

// Holds the selection the way the screen does, and reports every change.
function Harness(props: {
  initial?: number[];
  counts?: Record<number, number> | undefined;
  disabled?: boolean;
  onChange?: (years: number[]) => void;
}) {
  const [years, setYears] = useState(props.initial ?? []);
  return (
    <EraFilter
      years={years}
      counts={props.counts}
      currentYear={CURRENT_YEAR}
      disabled={props.disabled ?? false}
      onChange={(next) => {
        setYears(next);
        props.onChange?.(next);
      }}
    />
  );
}

const eraChip = (name: RegExp) => screen.getByRole('button', { name });

describe('EraFilter', () => {
  it('lists the six eras in order, all closed, with no year selected', () => {
    render(<Harness />);

    const eras = ['Pioneros', 'Era Tezuka', 'Boom OVA', 'Edad de oro', 'Era digital', 'Streaming'];
    for (const era of eras) {
      expect(eraChip(new RegExp(`^${era}`)).getAttribute('aria-expanded')).toBe('false');
    }
    expect(
      screen
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')?.split(',')[0]),
    ).toEqual(eras);
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
  });

  it('shows the range of each era and ends the last one at "hoy"', () => {
    render(<Harness />);

    expect(eraChip(/^Pioneros/).textContent).toContain('1917–1959');
    expect(eraChip(/^Streaming/).textContent).toContain('2015–hoy');
  });

  it('opens one era at a time and closes it when clicked again', async () => {
    render(<Harness />);

    await userEvent.click(eraChip(/^Streaming/));
    const panel = screen.getByRole('group', { name: 'Streaming · 2015 – hoy' });
    expect(eraChip(/^Streaming/).getAttribute('aria-expanded')).toBe('true');
    expect(eraChip(/^Streaming/).getAttribute('aria-controls')).toBe(panel.id);

    await userEvent.click(eraChip(/^Era digital/));
    expect(screen.queryByRole('group', { name: 'Streaming · 2015 – hoy' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Era digital · 2006 – 2014' })).toBeTruthy();

    await userEvent.click(eraChip(/^Era digital/));
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('groups the years of the open era by decade, cut at the era edges and at today', async () => {
    render(<Harness />);

    await userEvent.click(eraChip(/^Streaming/));
    const panel = screen.getByRole('group', { name: 'Streaming · 2015 – hoy' });
    const rows = within(panel).getAllByRole('list');
    expect(rows).toHaveLength(2);
    expect(
      within(rows[0] as HTMLElement)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['2015', '2016', '2017', '2018', '2019']);
    expect(
      within(rows[1] as HTMLElement)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['2020', '2021', '2022', '2023', '2024', '2025', '2026']);
    expect(within(panel).getByText('2010s')).toBeTruthy();
    expect(within(panel).getByText('2020s')).toBeTruthy();
  });

  it('selects several years across eras, and the era chip shows how many are selected', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.click(eraChip(/^Streaming/));
    await userEvent.click(screen.getByRole('button', { name: '2019' }));
    await userEvent.click(screen.getByRole('button', { name: '2016' }));
    await userEvent.click(eraChip(/^Boom OVA/));
    await userEvent.click(screen.getByRole('button', { name: '1985' }));

    expect(onChange).toHaveBeenLastCalledWith([1985, 2016, 2019]);
    expect(eraChip(/^Streaming/).getAttribute('aria-pressed')).toBe('true');
    expect(eraChip(/^Streaming/).getAttribute('aria-label')).toContain('2 años seleccionados');
    expect(eraChip(/^Boom OVA/).getAttribute('aria-label')).toContain('1 año seleccionado');
    expect(eraChip(/^Pioneros/).getAttribute('aria-pressed')).toBe('false');

    await userEvent.click(screen.getByRole('button', { name: '1985' }));
    expect(onChange).toHaveBeenLastCalledWith([2016, 2019]);
    expect(screen.getByRole('button', { name: '1985' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('"Todos" selects every year of the open era and keeps the others', async () => {
    const onChange = vi.fn();
    render(<Harness initial={[1985]} onChange={onChange} />);

    await userEvent.click(eraChip(/^Era digital/));
    await userEvent.click(screen.getByRole('button', { name: 'Todos' }));

    expect(onChange).toHaveBeenLastCalledWith([
      1985, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014,
    ]);
  });

  it('"Ninguno" deselects the years of the open era only', async () => {
    const onChange = vi.fn();
    render(<Harness initial={[1985, 2007, 2008]} onChange={onChange} />);

    await userEvent.click(eraChip(/^Era digital/));
    await userEvent.click(screen.getByRole('button', { name: 'Ninguno' }));

    expect(onChange).toHaveBeenLastCalledWith([1985]);
  });

  it('"Limpiar filtro" deselects the years of every era', async () => {
    const onChange = vi.fn();
    render(<Harness initial={[1985, 2007, 2019]} onChange={onChange} />);

    await userEvent.click(eraChip(/^Era digital/));
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtro' }));

    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
  });

  it('shows the real count of each year in compact form and names it in words', async () => {
    render(<Harness counts={{ 2016: 123, 2017: 1234, 2018: 1 }} />);

    await userEvent.click(eraChip(/^Streaming/));
    expect(screen.getByRole('button', { name: '2016, 123 franquicias' }).textContent).toBe(
      '2016123',
    );
    // Intl separates the unit with a no-break space.
    expect(
      screen
        .getByRole('button', { name: '2017, 1234 franquicias' })
        .textContent?.replace(/\s/g, ' '),
    ).toBe('20171,2 mil');
    expect(screen.getByRole('button', { name: '2018, 1 franquicia' })).toBeTruthy();
  });

  it('shows no number for a year with none, nor while the counts are loading or failed', async () => {
    const { rerender } = render(<Harness counts={{ 2016: 5 }} />);
    await userEvent.click(eraChip(/^Streaming/));
    expect(screen.getByRole('button', { name: '2017' }).textContent).toBe('2017');

    rerender(<Harness counts={undefined} />);
    expect(screen.getByRole('button', { name: '2016' }).textContent).toBe('2016');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('marks the current year with a dot and formats counts in the active language', async () => {
    await setLocale('en');
    render(<Harness counts={{ [CURRENT_YEAR]: 1234 }} />);

    await userEvent.click(eraChip(/^Streaming/));
    expect(eraChip(/^Streaming/).textContent).toContain('2015–today');
    expect(
      screen.getByRole('button', { name: `${CURRENT_YEAR}, 1234 franchises` }).textContent,
    ).toBe(`${CURRENT_YEAR}1.2K`);
    expect(screen.getByRole('button', { name: 'All' })).toBeTruthy();
    expect(screen.getAllByTestId('current-year')).toHaveLength(1);
    expect(
      within(screen.getByRole('button', { name: `${CURRENT_YEAR}, 1234 franchises` })).getByTestId(
        'current-year',
      ),
    ).toBeTruthy();
    await act(async () => {
      await setLocale('es');
    });
  });

  it('disables every control while a search covers all years', async () => {
    render(<Harness disabled initial={[2016]} />);

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveProperty('disabled', true);
    }
  });
});
