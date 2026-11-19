// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { loadGameData } from '../../src/sim/index';
import { App } from '../../src/ui/App';
import { loadWeek } from '../../src/week/saves';
import { memoryStorage, type SaveStorage } from '../../src/week/storage';

const data = loadGameData();
const now = () => '2026-11-19T21:00:00.000Z';
afterEach(cleanup);

/** Answers popups with their first choice and skips ahead until the end-of-day report. */
function playToReport() {
  for (let i = 0; i < 30; i++) {
    const dialog = screen.queryByRole('dialog');
    if (dialog) {
      fireEvent.click(within(dialog).getAllByRole('button')[0]!);
      continue;
    }
    if (screen.queryByRole('heading', { name: /End of day/ })) return;
    fireEvent.click(screen.getByRole('button', { name: 'Skip ahead' }));
  }
  throw new Error('never reached the report');
}

test('Start → Isnin popups → Skip ahead → report → Continue to Selasa', () => {
  const storage = memoryStorage();
  render(<App data={data} storage={storage} now={now} seed={() => 7} />);
  fireEvent.click(within(screen.getByRole('region', { name: 'Easy' })).getByRole('button', { name: 'Start' }));
  expect(screen.getByRole('toolbar', { name: 'Clinic controls' })).toBeTruthy();
  expect(screen.getByText(/^Isnin \d\d:\d\d$/)).toBeTruthy();
  playToReport();
  expect(screen.getByRole('heading', { name: 'End of day · Isnin' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Continue to Selasa' }));
  expect(screen.getByText(/^Selasa \d\d:\d\d$/)).toBeTruthy();
  expect(loadWeek(storage)!.state.day).toBe(2);
});

test('remounting with the same storage offers Continue (Selasa)', () => {
  const storage = memoryStorage();
  render(<App data={data} storage={storage} now={now} seed={() => 7} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  playToReport();
  fireEvent.click(screen.getByRole('button', { name: 'Continue to Selasa' }));
  cleanup();
  render(<App data={data} storage={storage} now={now} />);
  fireEvent.click(screen.getByRole('button', { name: 'Continue (Selasa)' }));
  expect(screen.getByText(/^Selasa \d\d:\d\d$/)).toBeTruthy();
});

test('with storage blocked the note shows and play goes on', () => {
  const blocked: SaveStorage = { get: () => null, set: () => false, remove: () => {}, available: false };
  render(<App data={data} storage={blocked} now={now} seed={() => 7} />);
  expect(screen.getByText('Progress can’t be saved in this browser.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  playToReport();
  fireEvent.click(screen.getByRole('button', { name: 'Continue to Selasa' }));
  expect(screen.getByText(/^Selasa/)).toBeTruthy();
});

test('Khamis starts with the EL popup before the clinic opens', () => {
  const storage = memoryStorage();
  render(<App data={data} storage={storage} now={now} seed={() => 7} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  for (const next of ['Selasa', 'Rabu', 'Khamis']) {
    playToReport();
    fireEvent.click(screen.getByRole('button', { name: `Continue to ${next}` }));
  }
  const dialog = screen.getByRole('dialog', { name: 'Dr. Hafiz' });
  expect(screen.queryByRole('toolbar', { name: 'Clinic controls' })).toBeNull();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Pinjam doktor OPD' }));
  expect(screen.getByText(/^Khamis \d\d:\d\d$/)).toBeTruthy();
});
