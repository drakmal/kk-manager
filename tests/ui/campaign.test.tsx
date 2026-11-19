// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { createCampaign } from '../../src/campaign/campaign';
import { listSlots, memoryStorage, serialise, type SaveStorage } from '../../src/campaign/saves';
import { loadGameData } from '../../src/sim/index';
import { App } from '../../src/ui/App';

const data = loadGameData();
const now = () => '2026-11-19T21:00:00.000Z';
afterEach(cleanup);

const heading = (name: string | RegExp) => screen.getByRole('heading', { name });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

function playFirstDay() {
  click('New campaign in slot 1');
  expect(heading('Malam · esok Isnin, Hari 1')).toBeTruthy();
  click('Baik');
  click('Go to morning');
  expect(heading('Pagi ini · Isnin · Hari 1')).toBeTruthy();
  expect(screen.queryByLabelText(/CCMS down pagi/)).toBeNull();
  click('Start the day');
  expect(screen.getByText(/^Isnin \d\d:\d\d$/)).toBeTruthy();
  click('Finish day');
  expect(heading('End of day · Isnin · Hari 1')).toBeTruthy();
  click('Continue to tonight');
  expect(heading('Malam · esok Selasa, Hari 2')).toBeTruthy();
}

test('the app opens on the title screen', () => {
  render(<App data={data} storage={memoryStorage()} now={now} />);
  expect(heading('KK Manager')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Free play' })).toBeTruthy();
});

test('a new campaign in slot 1 walks night 1 → plan → day → report → night 2 and saves', () => {
  const storage = memoryStorage();
  render(<App data={data} storage={storage} now={now} seed={() => 1} />);
  playFirstDay();
  expect(listSlots(storage)).toEqual([{ slot: 1, day: 2, mode: 'campaign', savedAt: now() }]);
});

test('remounting with the same storage and pressing Continue lands at night 2', () => {
  const storage = memoryStorage();
  render(<App data={data} storage={storage} now={now} seed={() => 1} />);
  playFirstDay();
  cleanup();
  render(<App data={data} storage={storage} now={now} />);
  expect(screen.getByText('Slot 1 · Hari 2 (Selasa)')).toBeTruthy();
  click('Continue slot 1');
  expect(heading('Malam · esok Selasa, Hari 2')).toBeTruthy();
});

test('with storage blocked a note is shown and play continues', () => {
  const blocked: SaveStorage = { get: () => null, set: () => false, remove: () => {}, available: false };
  render(<App data={data} storage={blocked} now={now} seed={() => 1} />);
  expect(screen.getByText('Progress can’t be saved in this browser. Use Export to keep your game.')).toBeTruthy();
  playFirstDay();
  expect(screen.getByText('Progress can’t be saved in this browser. Use Export to keep your game.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Export save' })).toBeTruthy();
});

test('importing a save resumes it at its night and stores it in its slot', async () => {
  const storage = memoryStorage();
  render(<App data={data} storage={storage} now={now} />);
  const state = { ...createCampaign(data, 2), day: 3 };
  const file = new File([serialise({ version: 1, slot: 2, savedAt: now(), state })], 'kk.json');
  fireEvent.change(screen.getByLabelText('Import save'), { target: { files: [file] } });
  await waitFor(() => expect(heading('Malam · esok Rabu, Hari 3')).toBeTruthy());
  expect(listSlots(storage).map((s) => [s.slot, s.day])).toEqual([[2, 3]]);
});

test('free play from the title opens the Plan 2 day with the day-type picker', () => {
  render(<App data={data} storage={memoryStorage()} now={now} />);
  click('Free play');
  expect(heading('Pagi ini · Hari 1')).toBeTruthy();
  expect(screen.getByLabelText(/CCMS down pagi/)).toBeTruthy();
});
