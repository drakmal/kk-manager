// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { DifficultyScreen } from '../../src/ui/DifficultyScreen';

afterEach(cleanup);
const handlers = () => ({ onStart: vi.fn(), onContinue: vi.fn(), onStartOver: vi.fn() });

test('three boxes: Easy is playable, Medium and Hard are coming soon', () => {
  const h = handlers();
  render(<DifficultyScreen savedDay={null} saveAvailable {...h} />);
  expect(screen.getByRole('heading', { name: 'KK Manager' })).toBeTruthy();
  expect(screen.getByText('Pilih klinik anda')).toBeTruthy();
  const easy = screen.getByRole('region', { name: 'Easy' });
  expect(within(easy).getByText('KK Jenis 4')).toBeTruthy();
  expect(within(easy).getByText('Isu minimum')).toBeTruthy();
  fireEvent.click(within(easy).getByRole('button', { name: 'Start' }));
  expect(h.onStart).toHaveBeenCalled();
  for (const [name, type, issues] of [['Medium', 'KK Jenis 3', 'Isu sederhana'], ['Hard', 'KK Jenis 1', 'Semua isu']] as const) {
    const box = screen.getByRole('region', { name });
    expect(within(box).getByText(type)).toBeTruthy();
    expect(within(box).getByText(issues)).toBeTruthy();
    const buttons = within(box).getAllByRole('button');
    expect(buttons.map((b) => (b as HTMLButtonElement).disabled)).toEqual([true]);
    expect(buttons[0]!.textContent).toBe('Coming soon');
  }
});

test('with a saved week, Easy offers Continue (day) and Start over', () => {
  const h = handlers();
  render(<DifficultyScreen savedDay={3} saveAvailable {...h} />);
  const easy = screen.getByRole('region', { name: 'Easy' });
  expect(within(easy).queryByRole('button', { name: 'Start' })).toBeNull();
  fireEvent.click(within(easy).getByRole('button', { name: 'Continue (Rabu)' }));
  expect(h.onContinue).toHaveBeenCalled();
  fireEvent.click(within(easy).getByRole('button', { name: 'Start over' }));
  expect(h.onStartOver).toHaveBeenCalled();
});

test('when storage is unavailable a note says progress can’t be saved', () => {
  render(<DifficultyScreen savedDay={null} saveAvailable={false} {...handlers()} />);
  expect(screen.getByText('Progress can’t be saved in this browser.')).toBeTruthy();
});
