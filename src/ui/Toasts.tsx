import { useState } from 'preact/hooks';
import type { DayController } from '../game/controller';
import { pickLine, type JokeSituation } from '../game/jokes';
import { liveScores, type ClinicEvent, type GameData } from '../sim/index';

interface Props {
  controller: DayController;
  data: GameData;
}

/** Game minutes a toast stays up. */
const SHOW_FOR = 8;

interface Toast {
  id: string;
  situation: JokeSituation;
  manual?: boolean;
}

function eventStart(e: ClinicEvent): { at: number; situation: JokeSituation } | null {
  switch (e.kind) {
    case 'ccmsDown': return { at: e.from, situation: 'ccmsDown' };
    case 'printerDown': return { at: e.from, situation: 'printerDown' };
    case 'influx': return { at: e.at, situation: 'influx' };
    case 'emergencyWalkIn': return { at: e.at, situation: 'emergency' };
    case 'staffAway': return null;
  }
}

export function Toasts({ controller: c, data }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const sim = c.sim;
  if (!sim || !c.dayPlan) return null;
  const now = sim.now;

  const toasts: Toast[] = [];
  for (const e of c.dayPlan.events) {
    const start = eventStart(e);
    if (!start) continue;
    const { at, situation } = start;
    if (now > at && now <= at + SHOW_FOR) toasts.push({ id: `${situation}@${at}`, situation, manual: situation === 'ccmsDown' });
  }
  const cutoff = data.tuning.lunchLateCutoff;
  if (now > cutoff && now <= cutoff + SHOW_FOR && liveScores(sim, data).lunch === 'missed') {
    toasts.push({ id: 'lunchMissed', situation: 'lunchMissed' });
  }

  const visible = toasts.filter((t) => !dismissed.has(t.id));
  if (visible.length === 0) return null;
  const dismiss = (id: string) => setDismissed(new Set([...dismissed, id]));

  return (
    <div class="toasts" aria-live="polite">
      {visible.map((t) => (
        <div class="toast" key={t.id}>
          <div>
            <span aria-hidden="true">⚠ </span>
            <span>{pickLine(t.situation, 0)}</span>
          </div>
          {t.manual && (
            <button type="button" onClick={() => dismiss(t.id)}>Switch to manual registration</button>
          )}
        </div>
      ))}
    </div>
  );
}
