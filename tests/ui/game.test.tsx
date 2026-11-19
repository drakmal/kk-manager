// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { createController } from '../../src/game/controller';
import { loadGameData } from '../../src/sim/data';
import { fmt } from '../../src/sim/time';
import { GameScreen } from '../../src/ui/GameScreen';

const data = loadGameData();
const started = (scenario = 'biasa') => {
  const c = createController(data, 1);
  c.setScenario(scenario);
  c.start();
  return c;
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('speed buttons change controller speed; Pause enters paused', () => {
  const c = started();
  render(<GameScreen controller={c} data={data} />);
  fireEvent.click(screen.getByRole('button', { name: '2×' }));
  expect(c.clock.speed).toBe(2);
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(c.phase).toBe('paused');
  fireEvent.click(screen.getByRole('button', { name: '1×' }));
  expect(c.phase).toBe('running');
  expect(c.clock.speed).toBe(1);
});

test('pause panel apply calls applyChange and shows the effective time', () => {
  const c = started();
  render(<GameScreen controller={c} data={data} />);
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  fireEvent.click(screen.getByLabelText('Straight to doctor: Antenatal (doktor sahaja)'));
  fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
  expect(c.sim!.pendingChanges).toHaveLength(1);
  const at = c.sim!.pendingChanges[0]!.at;
  expect(screen.getByText(`Takes effect at ${fmt(at)}. Staff satisfaction −5 per change.`)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  expect(c.phase).toBe('running');
});

test('applying the same roster change twice only charges once', () => {
  const c = started();
  render(<GameScreen controller={c} data={data} />);
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  fireEvent.change(screen.getByLabelText('Bilik Doktor KIA seat 2'), { target: { value: 'mo3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
  expect(c.sim!.pendingChanges).toHaveLength(1);
  expect(screen.getByText('No changes to apply.')).toBeTruthy();
});

test('a CCMS toast appears once the clock passes the event start, and can be dismissed', () => {
  const c = started('ccmsPagi');
  render(<GameScreen controller={c} data={data} />);
  expect(screen.queryByText('CCMS down lagi. Tukar ke daftar manual?')).toBeNull();
  act(() => {
    c.setSpeed(4);
    while (c.sim!.now <= 481) c.frame(1000);
  });
  expect(screen.getByText('CCMS down lagi. Tukar ke daftar manual?')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Switch to manual registration' }));
  expect(screen.queryByText('CCMS down lagi. Tukar ke daftar manual?')).toBeNull();
});

test('the HUD shows the clock, both bars and the lunch chip', () => {
  const c = started();
  render(<GameScreen controller={c} data={data} />);
  expect(screen.getByText(new RegExp(`Isnin ${fmt(c.sim!.now)}`))).toBeTruthy();
  expect(screen.getByLabelText('Patient satisfaction')).toBeTruthy();
  expect(screen.getByLabelText('Staff satisfaction')).toBeTruthy();
  expect(screen.getByText('🍛 13:00')).toBeTruthy();
});

test('Finish day goes to the report phase', () => {
  const c = started();
  render(<GameScreen controller={c} data={data} />);
  fireEvent.click(screen.getByRole('button', { name: 'Finish day' }));
  expect(c.phase).toBe('report');
});

test('low graphics toggle survives a localStorage that throws', () => {
  vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
  const c = started();
  render(<GameScreen controller={c} data={data} />);
  const box = screen.getByLabelText('Low graphics') as HTMLInputElement;
  expect(box.checked).toBe(false);
  fireEvent.click(box);
  expect((screen.getByLabelText('Low graphics') as HTMLInputElement).checked).toBe(true);
});
