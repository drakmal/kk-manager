import { buildLayout, queueSpot, type RoomLayout } from '../../src/game/layout';
import { loadGameData } from '../../src/sim/index';

const data = loadGameData();
const layout = buildLayout(data);
const room = (id: string) => layout.rooms.find((r) => r.station === id)!;
const inside = (t: { x: number; y: number }, r: RoomLayout) => t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.d;

test('the floor is 32 × 20 tiles with the entrance at the bottom', () => {
  expect([layout.width, layout.depth]).toEqual([32, 20]);
  expect(layout.entrance.y).toBeGreaterThan(19);
});

test('every station has a room with its seats; stations with seats have ≥ 12 queue spots', () => {
  for (const s of data.stations) {
    const r = room(s.id);
    expect(r.seats).toHaveLength(s.seats);
    expect(r.chairs).toHaveLength(s.seats);
    if (s.seats > 0) expect(r.queue.length).toBeGreaterThanOrEqual(12);
  }
});

test('rooms stay inside the floor and do not overlap', () => {
  for (const r of layout.rooms) {
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(layout.width);
    expect(r.y + r.d).toBeLessThanOrEqual(layout.depth);
  }
  for (const a of layout.rooms) {
    for (const b of layout.rooms) {
      if (a === b) continue;
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;
      expect(overlap, `${a.station} overlaps ${b.station}`).toBe(false);
    }
  }
});

test('MCH wing on the left, OPD rooms on the right, the middle column in between', () => {
  for (const id of ['ancNurse', 'mchDoctor', 'immunisation']) expect(room(id).x + room(id).w).toBeLessThanOrEqual(13);
  for (const id of ['opdRoom1', 'opdRoom2']) expect(room(id).x).toBeGreaterThanOrEqual(19);
  for (const id of ['lab', 'xray', 'emergency', 'physio', 'nutrition']) {
    expect(room(id).x).toBeGreaterThanOrEqual(13);
    expect(room(id).x + room(id).w).toBeLessThanOrEqual(19);
  }
  for (const id of ['mchRegistration', 'mchTriage', 'primaryTriage', 'opdRegistration', 'opdTriage', 'pharmacy']) {
    expect(room(id).y).toBeGreaterThanOrEqual(15);
  }
});

test('seats and chairs sit inside their room; furniture too', () => {
  for (const r of layout.rooms) {
    for (const t of [...r.seats, ...r.chairs]) expect(inside(t, r), r.station).toBe(true);
    for (const f of r.furniture) {
      expect(f.x).toBeGreaterThanOrEqual(r.x);
      expect(f.y).toBeGreaterThanOrEqual(r.y);
      expect(f.x + f.w).toBeLessThanOrEqual(r.x + r.w);
      expect(f.y + f.h).toBeLessThanOrEqual(r.y + r.d);
    }
  }
});

test('the MCH doctor room has the ultrasound; X-ray has its machine; beds where they belong', () => {
  expect(room('mchDoctor').furniture.map((f) => f.kind)).toContain('ultrasound');
  expect(room('xray').furniture.map((f) => f.kind)).toContain('xray');
  for (const id of ['ancNurse', 'mchDoctor', 'emergency', 'physio']) expect(room(id).furniture.map((f) => f.kind)).toContain('bed');
});

test('queue spots and seats are distinct tiles', () => {
  const tiles = layout.rooms.flatMap((r) => [...r.seats, ...r.chairs, ...r.queue]).map((t) => `${t.x},${t.y}`);
  expect(new Set(tiles).size).toBe(tiles.length);
});

test('labels say MCH, never KIA', () => {
  for (const a of layout.areas) expect(a.label).not.toMatch(/KIA/);
  for (const r of layout.rooms) expect(r.label).not.toMatch(/KIA/);
});

test('queueSpot overflows into the shared chairs; unknown stations throw', () => {
  const r = room('opdRoom1');
  expect(queueSpot(layout, 'opdRoom1', 0)).toEqual(r.queue[0]);
  expect(queueSpot(layout, 'opdRoom1', r.queue.length)).toEqual(layout.overflow[0]);
  expect(() => buildLayout({ ...data, stations: [...data.stations, { ...data.stations[0]!, id: 'dental' }] })).toThrow(/dental/);
});
