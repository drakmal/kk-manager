// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { createController } from '../../src/game/controller';
import { loadGameData } from '../../src/sim/data';
import { App } from '../../src/ui/App';

afterEach(cleanup);

test('shows the KK Manager name', () => {
  render(<App />);
  expect(screen.getByText('KK Manager')).toBeTruthy();
});

test('App switches screens by phase', () => {
  const data = loadGameData();
  const c = createController(data, 1);
  render(<App data={data} controller={c} />);
  expect(screen.getByRole('heading', { name: 'Pagi ini · Hari 1' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Start the day' }));
  expect(screen.getByRole('toolbar', { name: 'Clinic controls' })).toBeTruthy();
  act(() => c.finishNow());
  expect(screen.getByRole('heading', { name: /End of day/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Replay this day' }));
  expect(screen.getByRole('heading', { name: 'Pagi ini · Hari 1' })).toBeTruthy();
});
