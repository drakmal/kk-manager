import { LINES, pickLine } from '../../src/game/jokes';

test('pickLine is deterministic and comes from the list', () => {
  expect(pickLine('longWait', 7)).toBe(pickLine('longWait', 7));
  expect(LINES.longWait).toContain(pickLine('longWait', 7));
});

test('LINES contains the required lines', () => {
  const all = Object.values(LINES).flat();
  for (const line of [
    'Lama lagi ke?',
    'Saya nak ambil result darah je…',
    '☕ Mana pesakit?',
    'CCMS down lagi. Tukar ke daftar manual?',
    'Printer tak connect…',
    'Bas sekolah asrama dah sampai!',
    'Kes kecemasan! Seorang doktor ke bilik rawatan.',
    'Tak sempat makan…',
  ]) expect(all).toContain(line);
});

test('every situation has at least one line', () => {
  for (const [situation, lines] of Object.entries(LINES)) expect(lines.length, situation).toBeGreaterThan(0);
});
