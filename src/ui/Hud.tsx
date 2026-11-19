import type { Speed } from '../game/clock';
import type { DayController } from '../game/controller';
import { fmt, liveScores, type GameData } from '../sim/index';

interface Props {
  controller: DayController;
  data: GameData;
  lowGraphics: boolean;
  onLowGraphics(on: boolean): void;
  dayName: string;
}

const LUNCH_TEXT = {
  pending: '🍛 13:00',
  onTime: '🍛 Makan on time',
  late: '🍛 Late lunch',
  missed: '🍛 Tak sempat makan',
} as const;

const SPEEDS: Speed[] = [1, 2, 4];

export function Hud({ controller: c, data, lowGraphics, onLowGraphics, dayName }: Props) {
  const sim = c.sim;
  if (!sim) return null;
  const scores = liveScores(sim, data);
  const paused = c.phase === 'paused';
  const asking = c.popup !== null;
  const setSpeed = (s: Speed) => {
    c.setSpeed(s);
    if (paused) c.resume();
  };

  return (
    <div class="hud" role="toolbar" aria-label="Clinic controls">
      <span class="clock">{dayName} {fmt(sim.now)}</span>
      <button type="button" aria-pressed={paused} onClick={() => c.pause()}>Pause</button>
      {SPEEDS.map((s) => (
        <button key={s} type="button" aria-pressed={!paused && c.clock.speed === s} onClick={() => setSpeed(s)}>
          {s}×
        </button>
      ))}
      <span class="bar">
        Pesakit
        <meter aria-label="Patient satisfaction" min={0} max={100} low={40} high={70} optimum={100} value={scores.patient} />
        {Math.round(scores.patient)}
      </span>
      <span class="bar">
        Staf
        <meter aria-label="Staff satisfaction" min={0} max={100} low={40} high={70} optimum={100} value={scores.hcw} />
        {Math.round(scores.hcw)}
      </span>
      <span class="lunch">{LUNCH_TEXT[scores.lunch]}</span>
      <span class="spacer" />
      <label>
        <input type="checkbox" checked={lowGraphics} onChange={(e) => onLowGraphics((e.currentTarget as HTMLInputElement).checked)} />
        Low graphics
      </label>
      <button type="button" disabled={asking} title="Runs to the next popup or the end of the day" onClick={() => c.skipAhead()}>
        Skip ahead
      </button>
    </div>
  );
}
