// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { createCampaign, dayPlanFor, endDay } from '../../src/campaign/campaign';
import { resumeCampaign } from '../../src/campaign/controller';
import { memoryStorage } from '../../src/campaign/saves';
import { loadGameData } from '../../src/sim/index';
import { NightScreen } from '../../src/ui/NightScreen';
import { fakeReport } from '../campaign/helpers';

const data = loadGameData();
const now = () => '2026-11-19T21:00:00.000Z';
afterEach(cleanup);
const atNight = (day: number, goodwill?: number) => {
  let state = createCampaign(data, 1);
  while (state.day < day) state = endDay(data, state, fakeReport(), dayPlanFor(data, state));
  if (goodwill !== undefined) state = { ...state, goodwill };
  return resumeCampaign(data, memoryStorage(), { version: 1, slot: 1, savedAt: now(), state }, now);
};

test('shows the night heading, goodwill and each message', () => {
  const c = atNight(5);
  render(<NightScreen campaign={c} />);
  expect(screen.getByRole('heading', { name: 'Malam · esok Jumaat, Hari 5' })).toBeTruthy();
  expect(screen.getByText(`Goodwill: ${c.state.goodwill}`)).toBeTruthy();
  expect(screen.getByText('Dr, saya demam, esok nak EL 🙏')).toBeTruthy();
  expect(screen.getByText('Dr. Hafiz')).toBeTruthy();
});

test('a disabled relief choice shows its reason', () => {
  const c = atNight(5, 10);
  render(<NightScreen campaign={c} />);
  const relief = screen.getByRole('button', { name: /Minta relief/ }) as HTMLButtonElement;
  expect(relief.disabled).toBe(true);
  expect(screen.getByText('Not enough goodwill')).toBeTruthy();
});

test('choosing updates the message and the morning button enables once all are answered', () => {
  const c = atNight(5);
  render(<NightScreen campaign={c} />);
  expect((screen.getByRole('button', { name: 'Go to morning' }) as HTMLButtonElement).disabled).toBe(true);
  while (screen.queryAllByRole('button', { name: 'Baik' }).length > 0) fireEvent.click(screen.getAllByRole('button', { name: 'Baik' })[0]!);
  fireEvent.click(screen.getByRole('button', { name: 'Biarkan kosong' }));
  expect(screen.getByText('✓ Biarkan kosong')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Minta relief/ })).toBeNull();
  expect((screen.getByRole('button', { name: 'Go to morning' }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Go to morning' }));
  expect(c.phase).toBe('plan');
});

test('the not-saved note and Export show when storage fails', () => {
  const failing = { ...memoryStorage(), set: () => false };
  const c = resumeCampaign(data, failing, { version: 1, slot: 1, savedAt: now(), state: createCampaign(data, 1) }, now);
  const onExport = vi.fn();
  render(<NightScreen campaign={c} onExport={onExport} />);
  expect(screen.getByText('Progress can’t be saved in this browser. Use Export to keep your game.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Export save' }));
  expect(onExport).toHaveBeenCalled();
});
