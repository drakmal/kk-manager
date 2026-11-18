import { createRng } from '../../src/sim/rng';

test('same seed gives same sequence', () => {
  const a = createRng(42), b = createRng(42);
  expect([a.next(), a.next(), a.int(1, 6)]).toEqual([b.next(), b.next(), b.int(1, 6)]);
});

test('int is inclusive and in range', () => {
  const r = createRng(1);
  const xs = Array.from({ length: 2000 }, () => r.int(3, 5));
  expect(new Set(xs)).toEqual(new Set([3, 4, 5]));
});

test('weighted never returns zero-weight keys', () => {
  const r = createRng(7);
  for (let i = 0; i < 500; i++) expect(r.weighted({ a: 1, b: 0 })).toBe('a');
});
