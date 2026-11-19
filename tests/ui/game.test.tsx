// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { createController } from '../../src/game/controller';
import type { PopupDef } from '../../src/popups/popups';
import { fmt, loadGameData } from '../../src/sim/index';
import { GameScreen } from '../../src/ui/GameScreen';

const data = loadGameData();
const at = (minute: number): PopupDef => ({
  id: 'test', due: (c) => c.now === minute,
  build: (c) => ({ id: `test@${c.now}`, from: 'JM Devi', text: 'Ujian', choices: [{ id: 'ok', label: 'OK' }] }),
  effect: () => ({}),
});
const started = (popups: PopupDef[] = []) => {
  const c = createController(data, 1, { popups });
  c.start();
  return c;
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('speed buttons change controller speed; Pause enters paused', () => {
  const c = started();
  render(<GameScreen controller={c} data={data} dayName="Isnin" />);
  fireEvent.click(screen.getByRole('button', { name: '2×' }));
  expect(c.clock.speed).toBe(2);
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(c.phase).toBe('paused');
  fireEvent.click(screen.getByRole('button', { name: '1×' }));
  expect(c.phase).toBe('running');
});

test('the HUD shows the day and clock, both bars and the lunch chip; no Finish day', () => {
  const c = started();
  render(<GameScreen controller={c} data={data} dayName="Khamis" />);
  expect(screen.getByText(`Khamis ${fmt(c.sim!.now)}`)).toBeTruthy();
  expect(screen.getByLabelText('Patient satisfaction')).toBeTruthy();
  expect(screen.getByLabelText('Staff satisfaction')).toBeTruthy();
  expect(screen.getByText('🍛 13:00')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Finish day' })).toBeNull();
});

test('Skip ahead stops at a popup, which shows over the clinic; answering it lets the day go on', () => {
  const c = started([at(500)]);
  render(<GameScreen controller={c} data={data} dayName="Isnin" />);
  fireEvent.click(screen.getByRole('button', { name: 'Skip ahead' }));
  const dialog = screen.getByRole('dialog', { name: 'JM Devi' });
  expect((screen.getByRole('button', { name: 'Skip ahead' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  act(() => c.skipAhead());
  expect(c.phase).toBe('report');
});

test('low graphics toggle survives a localStorage that throws', () => {
  vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
  const c = started();
  render(<GameScreen controller={c} data={data} dayName="Isnin" />);
  const box = screen.getByLabelText('Low graphics') as HTMLInputElement;
  expect(box.checked).toBe(false);
  fireEvent.click(box);
  expect((screen.getByLabelText('Low graphics') as HTMLInputElement).checked).toBe(true);
});

test('Space pauses and resumes; 1, 2 and 4 set the speed', () => {
  const c = started();
  render(<GameScreen controller={c} data={data} dayName="Isnin" />);
  fireEvent.keyDown(window, { key: ' ', code: 'Space' });
  expect(c.phase).toBe('paused');
  fireEvent.keyDown(window, { key: ' ', code: 'Space' });
  expect(c.phase).toBe('running');
  fireEvent.keyDown(window, { key: '4' });
  expect(c.clock.speed).toBe(4);
  fireEvent.keyDown(window, { key: '2' });
  expect(c.clock.speed).toBe(2);
  fireEvent.keyDown(window, { key: ' ' });
  fireEvent.keyDown(window, { key: '1' });
  expect(c.phase).toBe('running');
  expect(c.clock.speed).toBe(1);
});

test('shortcuts are off while a popup is open, and when typing in a control', () => {
  const c = started([at(500)]);
  render(<GameScreen controller={c} data={data} dayName="Isnin" />);
  fireEvent.click(screen.getByRole('button', { name: 'Skip ahead' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.keyDown(window, { key: ' ' });
  fireEvent.keyDown(window, { key: '4' });
  expect(c.phase).toBe('running');
  expect(c.clock.speed).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  fireEvent.keyDown(screen.getByLabelText('Low graphics'), { key: ' ' });
  expect(c.phase).toBe('running');
});
