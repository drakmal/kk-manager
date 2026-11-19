import type { GameData, Minute, Sim, SimSnapshot } from '../sim/index';
import { lookFor, purposeColour, type Look } from './appearance';
import { pickLine, type JokeSituation } from './jokes';
import { queueSpot, type AreaLayout, type ClinicLayout, type RoomLayout, type Tile } from './layout';

export type Pose = 'stand' | 'sit';

export interface Spot {
  x: number;
  y: number;
  pose: Pose;
}

export interface Person {
  /** `p<id>` for patients, `s:<staffId>` for staff. */
  key: string;
  kind: 'patient' | 'staff';
  x: number;
  y: number;
  pose: Pose;
  look: Look;
  /** Purpose-dot colour (patients only). */
  tag: string | null;
  baby: boolean;
  bubble: string | null;
}

export interface Scene {
  now: Minute;
  rooms: RoomLayout[];
  /** Waiting areas and corridor (floors that aren't rooms). */
  areas: AreaLayout[];
  /** Floor size in tiles. */
  width: number;
  depth: number;
  /** Overflow chairs, drawn as furniture. */
  overflow: Tile[];
  people: Person[];
}

type SimView = Pick<Sim, 'patients' | 'staff'>;

const MAX_BUBBLES = 4;
const LONG_WAIT = 45;
const RESULT_ONLY_WAIT = 30;
const BABY_VISITS = new Set(['child_health', 'immunisation', 'postnatal']);

/** Where everyone should be at this snapshot. Done, turned-away and absent people are left out. */
export function targets(layout: ClinicLayout, snap: SimSnapshot, sim: SimView): Map<string, Spot> {
  const out = new Map<string, Spot>();
  const away = new Set(
    sim.staff.filter((s) => s.unavailableUntil !== null && snap.now < s.unavailableUntil).map((s) => s.id),
  );
  for (const station of snap.stations) {
    const room = layout.rooms.find((r) => r.station === station.id);
    if (!room) continue;
    station.queue.forEach((id, i) => out.set(`p${id}`, { ...queueSpot(layout, station.id, i), pose: 'sit' }));
    station.seats.forEach((seat, i) => {
      const s = room.seats[i % room.seats.length]!;
      const c = room.chairs[i % room.chairs.length]!;
      // Extra (trainee) seats sit just beside the normal seat they share.
      const dx = Math.floor(i / room.seats.length) * 0.6;
      if (!seat.onLunch && !away.has(seat.staffId)) out.set(`s:${seat.staffId}`, { x: s.x + dx, y: s.y, pose: 'sit' });
      if (seat.patientId !== null) out.set(`p${seat.patientId}`, { x: c.x + dx, y: c.y, pose: 'sit' });
    });
  }
  return out;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Positions part-way (alpha 0..1) between two minutes. Newcomers walk in from
 * the entrance; people who left walk to the exit. Walking is done standing.
 */
export function interpolate(
  from: Map<string, Spot>,
  to: Map<string, Spot>,
  alpha: number,
  layout: ClinicLayout,
  lowGraphics: boolean,
): Map<string, Spot> {
  if (lowGraphics) return new Map(to);
  const a = Math.min(1, Math.max(0, alpha));
  const out = new Map<string, Spot>();
  for (const [key, end] of to) {
    const start = from.get(key) ?? { ...layout.entrance, pose: 'stand' as Pose };
    const moving = start.x !== end.x || start.y !== end.y;
    out.set(key, { x: lerp(start.x, end.x, a), y: lerp(start.y, end.y, a), pose: moving && a < 1 ? 'stand' : end.pose });
  }
  if (a < 1) {
    for (const [key, start] of from) {
      if (to.has(key)) continue;
      out.set(key, { x: lerp(start.x, layout.exit.x, a), y: lerp(start.y, layout.exit.y, a), pose: 'stand' });
    }
  }
  return out;
}

interface BubbleCandidate {
  key: string;
  rank: number;
  situation: JokeSituation;
  seed: number;
}

function bubbles(snap: SimSnapshot, sim: SimView, data: GameData): Map<string, string> {
  const queued = new Set(snap.stations.flatMap((s) => s.queue));
  const doctorStations = new Set(data.stations.filter((s) => s.role === 'doctor').map((s) => s.id));
  const candidates: BubbleCandidate[] = [];

  for (const p of sim.patients) {
    if (!queued.has(p.id)) continue;
    if (p.visitType === 'anc_doctor_only' && p.waitMinutes >= RESULT_ONLY_WAIT) {
      candidates.push({ key: `p${p.id}`, rank: 0, situation: 'resultOnly', seed: p.id });
    } else if (p.waitMinutes >= LONG_WAIT) {
      candidates.push({ key: `p${p.id}`, rank: 1, situation: 'longWait', seed: p.id });
    }
  }
  if (snap.now >= 480 && snap.now < 600) {
    for (const station of snap.stations) {
      if (!doctorStations.has(station.id) || station.queue.length > 0) continue;
      for (const seat of station.seats) {
        if (seat.patientId === null && !seat.onLunch) {
          candidates.push({ key: `s:${seat.staffId}`, rank: 2, situation: 'doctorIdle', seed: 0 });
        }
      }
    }
  }
  candidates.sort((a, b) => a.rank - b.rank || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return new Map(candidates.slice(0, MAX_BUBBLES).map((c) => [c.key, pickLine(c.situation, c.seed)]));
}

export function buildScene(
  layout: ClinicLayout,
  snap: SimSnapshot,
  sim: SimView,
  data: GameData,
  positions: Map<string, Spot>,
): Scene {
  const patientById = new Map(sim.patients.map((p) => [p.id, p]));
  const roleOf = new Map(data.staff.map((s) => [s.id, s.role]));
  const speech = bubbles(snap, sim, data);
  const people: Person[] = [];

  for (const [key, spot] of positions) {
    if (key.startsWith('s:')) {
      const id = key.slice(2);
      people.push({
        key, kind: 'staff', ...spot, look: lookFor(key, roleOf.get(id) ?? 'ppk'),
        tag: null, baby: false, bubble: speech.get(key) ?? null,
      });
    } else {
      const p = patientById.get(Number(key.slice(1)));
      people.push({
        key, kind: 'patient', ...spot, look: lookFor(key, 'patient'),
        tag: p ? purposeColour(p.visitType) : null, baby: p ? BABY_VISITS.has(p.visitType) : false,
        bubble: speech.get(key) ?? null,
      });
    }
  }
  return {
    now: snap.now, rooms: layout.rooms, areas: layout.areas, width: layout.width, depth: layout.depth,
    overflow: layout.overflow, people,
  };
}
