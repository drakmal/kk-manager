import { createLoop } from '../../src/game/loop';

function fakeRaf() {
  let queue: ((t: number) => void)[] = [];
  let requests = 0;
  return {
    raf: (cb: (t: number) => void) => { queue.push(cb); requests++; return requests; },
    caf: () => { queue = []; },
    /** Fires the pending frame callbacks at time t. */
    tick(t: number) { const q = queue; queue = []; q.forEach((cb) => cb(t)); },
    get requests() { return requests; },
    get pending() { return queue.length; },
  };
}

test('loop requests no frames while shouldRun is false', () => {
  const r = fakeRaf();
  let frames = 0;
  const loop = createLoop({ raf: r.raf, caf: r.caf, shouldRun: () => false, onFrame: () => frames++ });
  loop.wake();
  expect(r.requests).toBe(0);
  expect(frames).toBe(0);
});

test('loop calls onFrame at most 30 times per simulated second at 60 Hz rAF', () => {
  const r = fakeRaf();
  const dts: number[] = [];
  const loop = createLoop({ raf: r.raf, caf: r.caf, shouldRun: () => true, onFrame: (dt) => dts.push(dt) });
  loop.wake();
  for (let k = 1; k <= 60; k++) r.tick((1000 / 60) * k);
  expect(dts.length).toBeLessThanOrEqual(30);
  expect(dts.length).toBeGreaterThanOrEqual(29);
  expect(dts[0]).toBe(0); // first frame after waking never jumps
  expect(dts.slice(1).every((dt) => dt > 30 && dt < 40)).toBe(true);
});

test('loop goes to sleep when shouldRun turns false, and wake restarts it', () => {
  const r = fakeRaf();
  let run = true;
  let frames = 0;
  const loop = createLoop({ raf: r.raf, caf: r.caf, shouldRun: () => run, onFrame: () => frames++ });
  loop.wake();
  r.tick(0);
  expect(frames).toBe(1);
  run = false;
  r.tick(40);
  expect(r.pending).toBe(0);
  run = true;
  loop.wake();
  expect(r.pending).toBe(1);
  r.tick(5000);
  expect(frames).toBe(2);
});

test('stop cancels and wake no longer restarts', () => {
  const r = fakeRaf();
  let frames = 0;
  const loop = createLoop({ raf: r.raf, caf: r.caf, shouldRun: () => true, onFrame: () => frames++ });
  loop.wake();
  loop.stop();
  r.tick(0);
  loop.wake();
  r.tick(50);
  expect(frames).toBe(0);
});
