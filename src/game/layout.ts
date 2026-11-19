import type { GameData, StationId } from '../sim/index';

export interface Tile {
  x: number;
  y: number;
}

export type FurnitureKind = 'desk' | 'bed' | 'ultrasound' | 'xray' | 'counter' | 'shelf';

/** A piece of furniture, in tiles (top-left corner and size). */
export interface Furniture {
  kind: FurnitureKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoomLayout {
  station: StationId;
  label: string;
  x: number;
  y: number;
  w: number;
  d: number;
  floor: string;
  /** Staff seats. */
  seats: Tile[];
  /** The patient chair in front of each seat (same index). */
  chairs: Tile[];
  /** Where this station's queue sits, front of the queue first. */
  queue: Tile[];
  /** Beds, machines, counters (drawn; not used by the simulation). */
  furniture: Furniture[];
}

/** Floor areas that aren't rooms (waiting areas, corridor, lobby). */
export interface AreaLayout {
  label: string;
  x: number;
  y: number;
  w: number;
  d: number;
  floor: string;
}

export interface ClinicLayout {
  width: number;
  depth: number;
  rooms: RoomLayout[];
  areas: AreaLayout[];
  entrance: Tile;
  exit: Tile;
  /** Extra chairs used when a queue is longer than its own spots. */
  overflow: Tile[];
}

const WIDTH = 32;
const DEPTH = 20;
const QUEUE_SPOTS = 12;
/** Rooms nobody queues for (the emergency room) still get a couple of spots. */
const SMALL_QUEUE = 2;

type Rect = { x: number; y: number; w: number; d: number };

/**
 * KK Jenis 4 seen from above. Left wing MCH, right wing OPD, a middle column
 * of shared rooms, and the counters, triage and pharmacy along the bottom,
 * with the entrance in the middle.
 */
const ROOMS: Record<string, Rect & { floor: string; furniture?: Furniture[] }> = {
  ancNurse: { x: 0, y: 0, w: 7, d: 5, floor: '#d6e9e2', furniture: [{ kind: 'bed', x: 5.4, y: 0.4, w: 1.4, h: 2.6 }] },
  mchDoctor: {
    x: 7, y: 0, w: 6, d: 5, floor: '#d9e2f1',
    furniture: [{ kind: 'bed', x: 11.6, y: 0.4, w: 1.2, h: 2.4 }, { kind: 'ultrasound', x: 11.6, y: 3.0, w: 1.0, h: 1.0 }],
  },
  immunisation: { x: 0, y: 5, w: 5, d: 5, floor: '#eddfe9', furniture: [{ kind: 'shelf', x: 0.2, y: 9.3, w: 4.6, h: 0.5 }] },
  lab: { x: 13, y: 0, w: 3, d: 4, floor: '#e4e9ec', furniture: [{ kind: 'shelf', x: 13.2, y: 3.4, w: 2.6, h: 0.5 }] },
  xray: { x: 16, y: 0, w: 3, d: 4, floor: '#e1e4ea', furniture: [{ kind: 'xray', x: 16.2, y: 3.0, w: 2.6, h: 0.9 }] },
  emergency: {
    x: 13, y: 4, w: 6, d: 4, floor: '#f3dede',
    furniture: [{ kind: 'bed', x: 13.5, y: 4.6, w: 2.2, h: 1.2 }, { kind: 'bed', x: 16.3, y: 4.6, w: 2.2, h: 1.2 }],
  },
  physio: { x: 13, y: 8, w: 3, d: 4, floor: '#e3eedf', furniture: [{ kind: 'bed', x: 13.3, y: 10.4, w: 2.4, h: 1.2 }] },
  nutrition: { x: 16, y: 8, w: 3, d: 4, floor: '#eef0dc', furniture: [{ kind: 'shelf', x: 16.2, y: 11.3, w: 2.6, h: 0.5 }] },
  opdRoom1: { x: 19, y: 0, w: 6, d: 5, floor: '#dbe4ee', furniture: [{ kind: 'bed', x: 23.6, y: 0.4, w: 1.2, h: 2.4 }] },
  opdRoom2: { x: 25, y: 0, w: 7, d: 5, floor: '#dbe4ee', furniture: [{ kind: 'bed', x: 30.6, y: 0.4, w: 1.2, h: 2.4 }] },
  mchRegistration: { x: 2, y: 15, w: 4, d: 5, floor: '#eadcc0', furniture: [{ kind: 'counter', x: 2.2, y: 15.2, w: 3.6, h: 0.5 }] },
  mchTriage: { x: 6, y: 15, w: 4, d: 5, floor: '#e3dccb' },
  primaryTriage: { x: 13, y: 15, w: 4, d: 5, floor: '#e7e2d8' },
  opdRegistration: { x: 19, y: 15, w: 4, d: 5, floor: '#eadcc0', furniture: [{ kind: 'counter', x: 19.2, y: 15.2, w: 3.6, h: 0.5 }] },
  opdTriage: { x: 23, y: 15, w: 4, d: 5, floor: '#e3dccb' },
  pharmacy: { x: 27, y: 15, w: 5, d: 5, floor: '#e2ecdf', furniture: [{ kind: 'counter', x: 27.2, y: 15.2, w: 4.6, h: 0.5 }] },
};

const AREAS: Record<'lobby' | 'mch' | 'opd' | 'corridor', AreaLayout> = {
  lobby: { label: 'Lobi', x: 0, y: 15, w: 32, d: 5, floor: '#ece6d8' },
  mch: { label: 'Ruang Menunggu MCH', x: 0, y: 5, w: 13, d: 10, floor: '#f1e8d4' },
  corridor: { label: 'Laluan', x: 13, y: 12, w: 6, d: 3, floor: '#e7e2d8' },
  opd: { label: 'Ruang Menunggu OPD', x: 19, y: 5, w: 13, d: 10, floor: '#efe9d9' },
};

const overlaps = (t: Tile, r: Rect) => t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.d;

/** Free tiles of an area in reading order (top to bottom, left to right), skipping rooms inside it. */
function freeTiles(area: Rect, rooms: Rect[]): Tile[] {
  const tiles: Tile[] = [];
  for (let y = area.y; y < area.y + area.d; y++) {
    for (let x = area.x; x < area.x + area.w; x++) {
      const t = { x, y };
      if (!rooms.some((r) => overlaps(t, r))) tiles.push(t);
    }
  }
  return tiles;
}

/** Which waiting area a station's queue sits in. */
function queueArea(stationId: string, unit: string): 'mch' | 'opd' | 'corridor' {
  if (stationId === 'primaryTriage') return 'corridor';
  return unit === 'mch' ? 'mch' : 'opd';
}

export function buildLayout(data: GameData): ClinicLayout {
  const rects = Object.values(ROOMS);
  const pools: Record<'mch' | 'opd' | 'corridor', Tile[]> = {
    mch: freeTiles(AREAS.mch, rects),
    corridor: freeTiles(AREAS.corridor, rects),
    opd: freeTiles(AREAS.opd, rects),
  };

  const rooms: RoomLayout[] = data.stations.map((station) => {
    const spec = ROOMS[station.id];
    if (!spec) throw new Error(`No room in the clinic floor plan for station "${station.id}"`);
    const { furniture = [], ...rect } = spec;
    const step = rect.w >= 2 * station.seats + 1 ? 2 : 1;
    if (station.seats > 0 && 1 + (station.seats - 1) * step >= rect.w) {
      throw new Error(`Room for station "${station.id}" is too narrow for ${station.seats} seats`);
    }
    const seats: Tile[] = [];
    const chairs: Tile[] = [];
    for (let i = 0; i < station.seats; i++) {
      const x = rect.x + 1 + i * step;
      seats.push({ x, y: rect.y + 1 });
      chairs.push({ x, y: rect.y + 2 });
    }
    const pool = pools[queueArea(station.id, station.unit)];
    const spots = station.seats > 0 ? QUEUE_SPOTS : SMALL_QUEUE;
    if (pool.length < spots) throw new Error(`Not enough waiting space for the queue of "${station.id}"`);
    const queue = pool.splice(0, spots);
    return { station: station.id, label: station.label, ...rect, seats, chairs, queue, furniture: furniture.map((f) => ({ ...f })) };
  });

  return {
    width: WIDTH,
    depth: DEPTH,
    rooms,
    areas: Object.values(AREAS),
    entrance: { x: 15, y: DEPTH - 0.5 },
    exit: { x: 16, y: DEPTH - 0.5 },
    overflow: [...pools.mch, ...pools.corridor, ...pools.opd],
  };
}

/** Where the patient at `index` in a station's queue sits; long queues spill into the overflow chairs. */
export function queueSpot(layout: ClinicLayout, station: StationId, index: number): Tile {
  const room = layout.rooms.find((r) => r.station === station);
  if (!room) throw new Error(`Unknown station "${station}"`);
  if (index < room.queue.length) return room.queue[index]!;
  return layout.overflow[(index - room.queue.length) % layout.overflow.length]!;
}
