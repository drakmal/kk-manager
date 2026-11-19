// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { TitleScreen } from '../../src/ui/TitleScreen';

afterEach(cleanup);
const slots = [{ slot: 2 as const, day: 4, mode: 'campaign', savedAt: '2026-11-19T21:00:00.000Z' }];
const handlers = () => ({
  onNew: vi.fn(), onContinue: vi.fn(), onFreePlay: vi.fn(), onExport: vi.fn(),
  onImport: vi.fn((_text: string): { ok: true } | { error: string } => ({ ok: true })),
});

test('shows three slot rows with Continue or New campaign, and Export for saved slots', () => {
  const h = handlers();
  render(<TitleScreen slots={slots} saveAvailable {...h} />);
  expect(screen.getByRole('heading', { name: 'KK Manager' })).toBeTruthy();
  expect(screen.getByText('Slot 2 · Hari 4 (Khamis)')).toBeTruthy();
  expect(screen.getAllByText(/Slot [13] · Empty/)).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Continue slot 2' }));
  expect(h.onContinue).toHaveBeenCalledWith(2);
  fireEvent.click(screen.getByRole('button', { name: 'New campaign in slot 1' }));
  expect(h.onNew).toHaveBeenCalledWith(1);
  fireEvent.click(screen.getByRole('button', { name: 'Export slot 2' }));
  expect(h.onExport).toHaveBeenCalledWith(2);
  expect(screen.queryByRole('button', { name: 'Export slot 1' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Continue slot 1' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Free play' }));
  expect(h.onFreePlay).toHaveBeenCalled();
});

test('an import error is shown beside the file input', async () => {
  const h = { ...handlers(), onImport: vi.fn((_t: string) => ({ error: 'This save is from a newer/unknown version (v2).' })) };
  render(<TitleScreen slots={[]} saveAvailable {...h} />);
  const input = screen.getByLabelText('Import save') as HTMLInputElement;
  const file = new File(['{"version":2}'], 'save.json', { type: 'application/json' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByText('This save is from a newer/unknown version (v2).')).toBeTruthy());
  expect(h.onImport).toHaveBeenCalledWith('{"version":2}');
});

test('when storage is unavailable a note says progress can’t be saved', () => {
  render(<TitleScreen slots={[]} saveAvailable={false} {...handlers()} />);
  expect(screen.getByText('Progress can’t be saved in this browser. Use Export to keep your game.')).toBeTruthy();
});
