import { useMemo, useState } from 'preact/hooks';
import { dayName, isUnlocked } from '../campaign/campaign';
import { newCampaign, resumeCampaign, type CampaignController } from '../campaign/controller';
import {
  browserStorage, exportFileName, listSlots, loadSlot, parseSave, saveSlot, serialise, type SaveStorage, type Slot,
} from '../campaign/saves';
import { createController, type DayController } from '../game/controller';
import { loadGameData, type GameData } from '../sim/index';
import { DistrictScreen } from './DistrictScreen';
import { downloadText } from './download';
import { GameScreen } from './GameScreen';
import { NightScreen } from './NightScreen';
import { PlanScreen } from './PlanScreen';
import { ReportScreen } from './ReportScreen';
import type { MentorCard } from './SopCards';
import { TitleScreen } from './TitleScreen';
import { useController } from './useController';

interface Props {
  data?: GameData;
  /** Free play straight away with this day controller (tests). */
  controller?: DayController;
  storage?: SaveStorage;
  /** Timestamp for saves. */
  now?: () => string;
  /** Seed for a new campaign. */
  seed?: () => number;
}

type Mode = { kind: 'title' } | { kind: 'free'; controller: DayController } | { kind: 'campaign'; campaign: CampaignController };

function FreePlay({ controller, data }: { controller: DayController; data: GameData }) {
  const c = useController(controller);
  return (
    <>
      {c.phase === 'plan' && <PlanScreen controller={c} data={data} />}
      {(c.phase === 'running' || c.phase === 'paused') && <GameScreen controller={c} data={data} />}
      {c.phase === 'report' && <ReportScreen controller={c} data={data} />}
    </>
  );
}

function mentorCard(campaign: CampaignController): MentorCard | undefined {
  const { state, day, data } = campaign;
  if (!day || !isUnlocked(state, 'pasanganMentor') || state.trainees.length === 0) return undefined;
  const nameOf = (id: string) => data.staff.find((p) => p.id === id)?.name ?? id;
  const names: MentorCard['names'] = {};
  const doctors: MentorCard['doctors'] = {};
  for (const t of state.trainees) {
    names[t.staffId] = nameOf(t.staffId);
    const room = data.staff.find((p) => p.id === t.staffId)?.homeStation ?? 'mchDoctor';
    doctors[t.staffId] = (day.plan.roster[room] ?? []).map((id) => ({ id, name: nameOf(id) }));
  }
  return { on: state.mentorCardOn, trainees: state.trainees, names, doctors, onChange: (on, trainees) => campaign.setMentor(on, trainees) };
}

function Campaign({ campaign }: { campaign: CampaignController }) {
  const c = useController(campaign);
  const label = `${dayName(c.state.day)} · Hari ${c.state.day}`;
  const exportNow = () => {
    const { fileName, text } = c.exportSave();
    downloadText(fileName, text);
  };
  return (
    <>
      {c.phase === 'night' && <NightScreen campaign={c} onExport={exportNow} />}
      {c.phase === 'plan' && c.day && (
        <PlanScreen controller={c.day} data={c.data} campaign={{ dayLabel: label, unlocked: c.state.unlocked, mentor: mentorCard(c) }} />
      )}
      {c.phase === 'day' && c.day && <GameScreen controller={c.day} data={c.data} dayName={dayName(c.state.day)} />}
      {c.phase === 'report' && c.day && (
        <ReportScreen controller={c.day} data={c.data} dayLabel={label} onContinue={() => c.continueAfterReport()} />
      )}
      {c.phase === 'district' && <DistrictScreen campaign={c} />}
    </>
  );
}

export function App(props: Props) {
  const data = useMemo(() => props.data ?? loadGameData(), [props.data]);
  const storage = useMemo(() => props.storage ?? browserStorage(), [props.storage]);
  const now = props.now ?? (() => new Date().toISOString());
  const [mode, setMode] = useState<Mode>(() =>
    props.controller ? { kind: 'free', controller: props.controller } : { kind: 'title' },
  );

  const startNew = (slot: Slot) => {
    const seed = props.seed ? props.seed() : 1 + Math.floor(Math.random() * 999_999);
    setMode({ kind: 'campaign', campaign: newCampaign(data, storage, slot, seed, now) });
  };
  const resume = (slot: Slot) => {
    const save = loadSlot(storage, slot);
    if (save) setMode({ kind: 'campaign', campaign: resumeCampaign(data, storage, save, now) });
  };
  const importSave = (text: string): { ok: true } | { error: string } => {
    const r = parseSave(text, data);
    if (!r.ok) return { error: r.error };
    saveSlot(storage, r.save);
    setMode({ kind: 'campaign', campaign: resumeCampaign(data, storage, r.save, now) });
    return { ok: true };
  };
  const exportSlot = (slot: Slot) => {
    const save = loadSlot(storage, slot);
    if (save) downloadText(exportFileName(save), serialise(save));
  };

  return (
    <div class="app">
      {mode.kind !== 'title' && <div class="brand" aria-hidden="true">KK Manager</div>}
      {mode.kind === 'title' && (
        <TitleScreen
          slots={listSlots(storage)} saveAvailable={storage.available}
          onNew={startNew} onContinue={resume} onImport={importSave} onExport={exportSlot}
          onFreePlay={() => setMode({ kind: 'free', controller: createController(data, 1) })}
        />
      )}
      {mode.kind === 'free' && <FreePlay controller={mode.controller} data={data} />}
      {mode.kind === 'campaign' && <Campaign campaign={mode.campaign} />}
    </div>
  );
}
