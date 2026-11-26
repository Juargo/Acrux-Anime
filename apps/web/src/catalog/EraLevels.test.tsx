// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import { EraRail, EraYears } from './EraLevels';

afterEach(cleanup);

const CURRENT_YEAR = 2026;
const STREAMING = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

// Holds the selection the way the screen does, and reports every change.
function Harness(props: {
  initial?: number[];
  counts?: Record<number, number> | undefined;
  disabled?: boolean;
  onChange?: (years: number[]) => void;
}) {
  const [years, setYears] = useState(props.initial ?? []);
  const shared = {
    years,
    currentYear: CURRENT_YEAR,
    disabled: props.disabled ?? false,
    onChange: (next: number[]) => {
      setYears(next);
      props.onChange?.(next);
    },
  };
  return (
    <>
      <EraRail {...shared} />
      <EraYears {...shared} counts={props.counts} />
    </>
  );
}

const stop = (name: RegExp) => screen.getByRole('button', { name });
const pressed = (name: string | RegExp) =>
  screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('the era levels of the Anime world', () => {
  it('lists the six eras as numbered stops in order, none taken, with no year in view', () => {
    render(<Harness />);

    expect(
      screen.getAllByRole('button').map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      'Pioneros, 1917–1959',
      'Era Tezuka, 1960–1979',
      'Boom OVA, 1980–1994',
      'Edad de oro, 1995–2005',
      'Era digital, 2006–2014',
      'Streaming, 2015–hoy',
    ]);
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      '11917',
      '21960',
      '31980',
      '41995',
      '52006',
      '62015',
    ]);
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('a stop takes its whole era: every year is sent and "Todos" is the one pressed', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.click(stop(/^Streaming/));

    expect(onChange).toHaveBeenLastCalledWith(STREAMING);
    expect(pressed(/^Streaming/)).toBe('true');
    const panel = screen.getByRole('region', { name: 'Streaming' });
    expect(panel.textContent).toContain('2015–hoy');
    expect(
      within(panel)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Todos', ...STREAMING.map(String)]);
    expect(
      within(panel)
        .getAllByRole('button', { pressed: true })
        .map((button) => button.textContent),
    ).toEqual(['Todos']);
  });

  it('one era at a time: another stop replaces it, and the same stop leaves every era', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.click(stop(/^Streaming/));
    await userEvent.click(stop(/^Era digital/));
    expect(onChange).toHaveBeenLastCalledWith([
      2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014,
    ]);
    expect(pressed(/^Streaming/)).toBe('false');
    expect(screen.queryByRole('region', { name: 'Streaming' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Era digital' })).toBeTruthy();

    await userEvent.click(stop(/^Era digital/));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
  });

  it('a year narrows the era to it, more years add up, and "Todos" widens it again', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(stop(/^Streaming/));

    await userEvent.click(screen.getByRole('button', { name: '2019' }));
    expect(onChange).toHaveBeenLastCalledWith([2019]);
    expect(pressed('Todos')).toBe('false');

    await userEvent.click(screen.getByRole('button', { name: '2016' }));
    expect(onChange).toHaveBeenLastCalledWith([2016, 2019]);
    expect(pressed('2016')).toBe('true');
    expect(pressed(/^Streaming/)).toBe('true');

    await userEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect(onChange).toHaveBeenLastCalledWith(STREAMING);
  });

  it('taking the last year off goes back to the whole era, never to an empty one', async () => {
    const onChange = vi.fn();
    render(<Harness initial={[2019]} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: '2019' }));

    expect(onChange).toHaveBeenLastCalledWith(STREAMING);
    expect(pressed('Todos')).toBe('true');
  });

  it('shows the real count of each year in compact form and names it in words', async () => {
    render(<Harness initial={[2016]} counts={{ 2016: 123, 2017: 1234, 2018: 1 }} />);

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

  it('shows no number for a year with none, nor while the counts are loading or failed', () => {
    const { rerender } = render(<Harness initial={[2016]} counts={{ 2016: 5 }} />);
    expect(screen.getByRole('button', { name: '2017' }).textContent).toBe('2017');

    rerender(<Harness initial={[2016]} counts={undefined} />);
    expect(screen.getByRole('button', { name: '2016' }).textContent).toBe('2016');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('marks the current year with a dot and speaks the active language', async () => {
    await setLocale('en');
    render(<Harness initial={[2016]} counts={{ [CURRENT_YEAR]: 1234 }} />);

    expect(stop(/^Streaming/).getAttribute('aria-label')).toBe('Streaming, 2015–today');
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

  it('disables every control while a search covers all years', () => {
    render(<Harness disabled initial={[2016]} />);

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveProperty('disabled', true);
    }
  });
});
