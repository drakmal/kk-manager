import { createClock } from '../../src/game/clock';

test('1× steps 1 minute per second, 4× steps 4, fractions carry', () => {
  const c = createClock();
  c.speed = 1;
  expect(c.advance(1000, false)).toBe(1);
  expect(c.advance(500, false)).toBe(0);
  expect(c.fraction).toBeCloseTo(0.5, 9);
  expect(c.advance(500, false)).toBe(1);
  c.speed = 4;
  expect(c.advance(1000, false)).toBe(4);
  c.speed = 2;
  expect(c.advance(1000, false)).toBe(2);
});

test('speed 0 never steps', () => {
  const c = createClock();
  c.speed = 0;
  expect(c.advance(5000, false)).toBe(0);
  expect(c.advance(5000, true)).toBe(0);
});

test('quiet stretches run at 16 minutes per second', () => {
  const c = createClock();
  c.speed = 1;
  expect(c.advance(1000, true)).toBe(16);
});

test('a 10-minute background gap steps at most 60 minutes', () => {
  const c = createClock();
  c.speed = 4;
  expect(c.advance(600_000, false)).toBeLessThanOrEqual(60);
  expect(c.fraction).toBeLessThan(1);
  // and it doesn't keep paying the debt back on later frames
  expect(c.advance(16, false)).toBeLessThanOrEqual(1);
});
