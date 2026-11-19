// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { PopupDialog } from '../../src/ui/PopupDialog';

afterEach(cleanup);
const popup = {
  id: 'printer@540', from: 'Encik Azman (PT)', text: 'Printer tak connect. Slip tak keluar.',
  choices: [{ id: 'tangan', label: 'Tulis tangan slip' }, { id: 'it', label: 'Panggil IT, tunggu' }],
};

test('the dialog shows the sender, the text and the choices; a click answers', () => {
  const onAnswer = vi.fn();
  render(<PopupDialog popup={popup} onAnswer={onAnswer} />);
  const dialog = screen.getByRole('dialog', { name: 'Encik Azman (PT)' });
  expect(dialog.getAttribute('aria-modal')).toBe('true');
  expect(within(dialog).getByText('Printer tak connect. Slip tak keluar.')).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Panggil IT, tunggu' }));
  expect(onAnswer).toHaveBeenCalledWith('it');
});

test('focus starts on the first choice, and Escape does not close it', () => {
  const onAnswer = vi.fn();
  render(<PopupDialog popup={popup} onAnswer={onAnswer} />);
  expect(document.activeElement?.textContent).toBe('Tulis tangan slip');
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(onAnswer).not.toHaveBeenCalled();
});

test('all choices look the same: none is highlighted', () => {
  render(<PopupDialog popup={popup} onAnswer={() => {}} />);
  const buttons = within(screen.getByRole('dialog')).getAllByRole('button');
  expect(new Set(buttons.map((b) => b.className))).toEqual(new Set(['choice']));
});
