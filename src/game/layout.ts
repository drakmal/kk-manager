import type { GameData, StationId } from '../sim/index';

export interface Tile {
  x: number;
  y: number;
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
}

/** Floor areas that aren't rooms (waiting areas, corridor). */
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

const WIDTH = 30;
const DEPTH = 20;
const QUEUE_SPOTS = 12;

type Rect = { x: number; y: number; w: number; d: number };

/**
 * The fixed floor plan. Back row: ANC nurse, MCH doctor, OPD doctors. Middle:
 * the MCH waiting area (left), corridor, OPD waiting area (right). Front row,
 * along y = DEPTH: counters, triage, lab and pharmacy, with the entrance in the middle.
 */
const ROOMS: Record<string, Rect & { floor: string }> = {
  ancNurse: { x: 0, y: 0, w: 7, d: 5, floor: '#d6e9e2' },
  mchDoctor: { x: 7, y: 0, w: 6, d: 5, floor: '#d9e2f1' },
  opdDoctor: { x: 15, y: 0, w: 15, d: 5, floor: '#dbe4ee' },
  immunisation: { x: 0, y: 5, w: 5, d: 5, floor: '#eddfe9' },
  mchRegistration: { x: 0, y: 14, w: 5, d: 6, floor: '#eadcc0' },
  mchTriage: { x: 5, y: 14, w: 4, d: 6, floor: '#e3dccb' },
  lab: { x: 9, y: 14, w: 4, d: 6, floor: '#e4e9ec' },
  primaryTriage: { x: 13, y: 14, w: 4, d: 6, floor: '#e7e2d8' },
  pharmacy: { x: 17, y: 14, w: 5, d: 6, floor: '#e2ecdf' },
  opdRegistration: { x: 22, y: 14, w: 4, d: 6, floor: '#eadcc0' },
  opdTriage: { x: 26, y: 14, w: 4, d: 6, floor: '#e3dccb' },
};

const AREAS: Record<'mch' | 'opd' | 'corridor', AreaLayout> = {
  mch: { label: 'Ruang Menunggu KIA', x: 0, y: 5, w: 13, d: 9, floor: '#f1e8d4' },
  corridor: { label: 'Laluan', x: 13, y: 5, w: 2, d: 9, floor: '#e7e2d8' },
  opd: { label: 'Ruang Menunggu OPD', x: 15, y: 5, w: 15, d: 9, floor: '#efe9d9' },
};

const overlaps = (t: Tile, r: Rect) => t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.d;

/** Free tiles of an area in reading order (back to front, left to right), skipping rooms inside it. */
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
    const rect = ROOMS[station.id];
    if (!rect) throw new Error(`No room in the clinic floor plan for station "${station.id}"`);
    const step = rect.w >= 2 * station.seats + 1 ? 2 : 1;
    if (1 + (station.seats - 1) * step >= rect.w) {
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
    if (pool.length < QUEUE_SPOTS) throw new Error(`Not enough waiting space for the queue of "${station.id}"`);
    const queue = pool.splice(0, QUEUE_SPOTS);
    return { station: station.id, label: station.label, ...rect, seats, chairs, queue };
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
