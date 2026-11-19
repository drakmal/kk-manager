import { useEffect, useState } from 'preact/hooks';
import type { DayController } from '../game/controller';
import { fmt, type GameData, type PlanChange, type SopSettings, type StaffId, type StationId } from '../sim/index';
import { RosterEditor } from './RosterEditor';
import { SopCards } from './SopCards';

interface Props {
  controller: DayController;
  data: GameData;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function PausePanel({ controller: c, data }: Props) {
  const open = c.phase === 'paused';
  const [sop, setSop] = useState<SopSettings | null>(null);
  const [roster, setRoster] = useState<Record<StationId, StaffId[]>>({});
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSop(structuredClone(c.liveSop));
    setRoster(c.liveRoster());
    setNotice(null);
  }, [open]);

  if (!open || !sop) return null;

  const apply = () => {
    const change: PlanChange = {};
    if (!same(sop, c.liveSop)) change.sop = sop;
    if (!same(roster, c.liveRoster())) change.roster = roster;
    if (!change.sop && !change.roster) {
      setNotice('No changes to apply.');
      return;
    }
    const { effectiveAt } = c.applyChange(change);
    setNotice(`Takes effect at ${fmt(effectiveAt)}. Staff satisfaction −${data.tuning.midDayChangePenalty} per change.`);
  };

  return (
    <aside class="pause-panel" aria-label="Change today's plan">
      <h2>Paused: change today’s plan</h2>
      <p class="hint">
        Staff need {data.tuning.briefingDelayMinutes} minutes of briefing before a change takes effect. Every change costs some staff satisfaction.
      </p>
      <SopCards data={data} sop={sop} onChange={setSop} />
      <RosterEditor data={data} roster={roster} onChange={setRoster} />
      <div class="actions">
        {notice && <span class="notice" role="status">{notice}</span>}
        <button type="button" onClick={apply}>Apply changes</button>
        <button type="button" class="primary" onClick={() => c.resume()}>Resume</button>
      </div>
    </aside>
  );
}
