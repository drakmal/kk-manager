import { useState } from 'preact/hooks';
import type { DayController } from '../game/controller';
import type { GameData } from '../sim/index';
import { ClinicCanvas } from './ClinicCanvas';
import { Hud } from './Hud';
import { PausePanel } from './PausePanel';
import { Toasts } from './Toasts';
import { useController } from './useController';

interface Props {
  controller: DayController;
  data: GameData;
}

const KEY = 'kkm.lowGraphics';

/** A per-viewer convenience only: if storage is blocked, the setting just isn't remembered. */
function readLowGraphics(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
function writeLowGraphics(on: boolean): void {
  try {
    globalThis.localStorage?.setItem(KEY, on ? '1' : '0');
  } catch {
    /* storage unavailable; keep the setting for this visit only */
  }
}

export function GameScreen({ controller, data }: Props) {
  const c = useController(controller);
  const [lowGraphics, setLowGraphics] = useState(readLowGraphics);
  const onLowGraphics = (on: boolean) => {
    setLowGraphics(on);
    writeLowGraphics(on);
  };

  return (
    <div class="game-screen">
      <Hud controller={c} data={data} lowGraphics={lowGraphics} onLowGraphics={onLowGraphics} />
      <div class="stage">
        <ClinicCanvas controller={c} data={data} lowGraphics={lowGraphics} />
        <Toasts controller={c} data={data} />
        <PausePanel controller={c} data={data} />
      </div>
    </div>
  );
}
