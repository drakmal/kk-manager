import { buildLayout, queueSpot, type RoomLayout } from '../../src/game/layout';
import { loadGameData } from '../../src/sim/data';

const data = loadGameData();
const layout = buildLayout(data);
const key = (t: { x: number; y: number }) => `${t.x},${t.y}`;
const inside = (t: { x: number; y: number }, r: { x: number; y: number; w: number; d: number }) =>
  t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.d;

test('every station has a room with enough seats and ≥ 12 queue spots', () => {
  for (const s of data.stations) {
    const room = layout.rooms.find((r) => r.station === s.id);
    expect(room, s.id).toBeDefined();
    expect(room!.label).toBe(s.label);
    expect(room!.seats.length).toBeGreaterThanOrEqual(s.seats);
    expect(room!.chairs.length).toBe(room!.seats.length);
    expect(room!.queue.length).toBeGreaterThanOrEqual(12);
  }
  expect(layout.overflow.length).toBeGreaterThanOrEqual(40);
});

test('doctor rooms have exactly 2 desks per room (OPD is one wide room with 4)', () => {
  expect(layout.rooms.find((r) => r.station === 'mchDoctor')!.seats).toHaveLength(2);
  expect(layout.rooms.find((r) => r.station === 'opdDoctor')!.seats).toHaveLength(4);
});

test('MCH wing on the left, OPD on the right, shared stations and entrance along the front', () => {
  const room = (id: string) => layout.rooms.find((r) => r.station === id)!;
  const mid = layout.width / 2;
  for (const id of ['mchRegistration', 'mchTriage', 'ancNurse', 'mchDoctor', 'immunisation']) expect(room(id).x + room(id).w).toBeLessThanOrEqual(mid);
  for (const id of ['opdRegistration', 'opdTriage', 'opdDoctor']) expect(room(id).x).toBeGreaterThanOrEqual(mid);
  for (const id of ['primaryTriage', 'lab', 'pharmacy']) expect(room(id).y + room(id).d).toBe(layout.depth);
  expect(Math.abs(layout.entrance.x - mid)).toBeLessThanOrEqual(2);
});

test('rooms stay inside the floor and do not overlap', () => {
  const rooms: RoomLayout[] = layout.rooms;
  for (const r of rooms) {
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(layout.width);
    expect(r.y + r.d).toBeLessThanOrEqual(layout.depth);
  }
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i]!, b = rooms[j]!;
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;
      expect(overlap, `${a.station} overlaps ${b.station}`).toBe(false);
    }
  }
});

test('seats and chairs sit inside their room', () => {
  for (const r of layout.rooms) for (const t of [...r.seats, ...r.chairs]) expect(inside(t, r), r.station).toBe(true);
});

test('all seats, chairs, queue spots and overflow chairs are distinct tiles', () => {
  const all = [...layout.rooms.flatMap((r) => [...r.seats, ...r.chairs, ...r.queue]), ...layout.overflow].map(key);
  expect(new Set(all).size).toBe(all.length);
});

test('buildLayout throws naming an unknown station', () => {
  const d = structuredClone(data);
  d.stations.push({ id: 'xray', unit: 'shared', label: 'X-ray', role: 'lab', seats: 1, minutes: [5, 5], opensAt: 480 });
  expect(() => buildLayout(d)).toThrow(/xray/);
});

test('queueSpot overflows into the shared chairs', () => {
  const room = layout.rooms.find((r) => r.station === 'ancNurse')!;
  expect(queueSpot(layout, 'ancNurse', 0)).toEqual(room.queue[0]);
  expect(queueSpot(layout, 'ancNurse', room.queue.length)).toEqual(layout.overflow[0]);
  expect(queueSpot(layout, 'ancNurse', room.queue.length + layout.overflow.length)).toEqual(layout.overflow[0]);
});
