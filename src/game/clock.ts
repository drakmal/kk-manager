export type Speed = 0 | 1 | 2 | 4;

export interface GameClock {
  speed: Speed;
  /** Real time passed → whole game minutes to step now. */
  advance(dtMs: number, quiet: boolean): number;
  /** How far into the current game minute we are (0..1), for smooth walking. */
  readonly fraction: number;
}

/** When nothing is happening, skip ahead at this many game minutes per real second. */
const QUIET_RATE = 16;
/** After a long pause (background tab), never step more than this in one frame. */
const MAX_STEPS_PER_FRAME = 60;

export function createClock(): GameClock {
  let acc = 0;
  return {
    speed: 0,
    get fraction() {
      return acc;
    },
    advance(dtMs: number, quiet: boolean): number {
      if (this.speed === 0 || dtMs <= 0) return 0;
      const rate = quiet ? QUIET_RATE : this.speed;
      acc += (dtMs / 1000) * rate;
      let steps = Math.floor(acc);
      acc -= steps;
      if (steps > MAX_STEPS_PER_FRAME) {
        steps = MAX_STEPS_PER_FRAME;
        acc = 0; // drop the rest of the backlog instead of paying it back later
      }
      return steps;
    },
  };
}
