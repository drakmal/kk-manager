export interface Loop {
  /** Starts the loop if it is asleep and there is something to animate. */
  wake(): void;
  /** Stops for good (on unmount). */
  stop(): void;
}

interface LoopOptions {
  raf: (cb: (t: number) => void) => number;
  caf: (id: number) => void;
  /** While false the loop sleeps: no frames are requested at all. */
  shouldRun: () => boolean;
  /** Called at most `maxFps` times a second with the ms since the previous call (0 right after waking). */
  onFrame: (dtMs: number) => void;
  maxFps?: number;
}

/** A requestAnimationFrame loop with a frame cap that sleeps when idle, to keep GPU and battery use low. */
export function createLoop({ raf, caf, shouldRun, onFrame, maxFps = 30 }: LoopOptions): Loop {
  const minGap = 1000 / maxFps - 0.5;
  let id: number | null = null;
  let lastFrame: number | null = null;
  let stopped = false;

  const tick = (t: number) => {
    id = null;
    if (stopped || !shouldRun()) {
      lastFrame = null;
      return;
    }
    if (lastFrame === null || t - lastFrame >= minGap) {
      const dt = lastFrame === null ? 0 : t - lastFrame;
      lastFrame = t;
      onFrame(dt);
    }
    if (!stopped && shouldRun()) id = raf(tick);
    else lastFrame = null;
  };

  return {
    wake() {
      if (stopped || id !== null || !shouldRun()) return;
      lastFrame = null;
      id = raf(tick);
    },
    stop() {
      stopped = true;
      if (id !== null) caf(id);
      id = null;
    },
  };
}
