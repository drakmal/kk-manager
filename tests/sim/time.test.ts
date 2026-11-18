import { fmt, toMinute } from '../../src/sim/time';

test('time round-trip', () => {
  expect(toMinute('08:00')).toBe(480);
  expect(toMinute('16:30')).toBe(990);
  expect(fmt(780)).toBe('13:00');
  expect(fmt(1145)).toBe('19:05');
});
