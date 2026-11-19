import { useEffect, useState } from 'preact/hooks';
import type { Speed } from '../game/clock';
import type { DayController } from '../game/controller';
import type { GameData } from '../sim/index';
import { ClinicCanvas } from './ClinicCanvas';
import { Hud } from './Hud';
import { PopupDialog } from './PopupDialog';
import { useController } from './useController';

interface Props {
  controller: DayController;
  data: GameData;
  dayName: string;
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

const SPEED_KEYS: Record<string, Speed> = { '1': 1, '2': 2, '4': 4 };
/** Typing in a control (the low-graphics box, a future text field) keeps its own keys. */
const isControl = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName);

export function GameScreen({ controller, data, dayName }: Props) {
  const c = useController(controller);

  // Space pauses or resumes; 1, 2 and 4 set the speed. Off while a popup asks for a choice.
  useEffect(() => {
    const isSpace = (e: KeyboardEvent) => e.key === ' ' || e.code === 'Space';
    const onKey = (e: KeyboardEvent) => {
      if (controller.popup || isControl(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isSpace(e)) {
        e.preventDefault();
        if (e.repeat) return;
        if (controller.phase === 'paused') controller.resume();
        else controller.pause();
        return;
      }
      const speed = SPEED_KEYS[e.key];
      if (speed) {
        controller.setSpeed(speed);
        if (controller.phase === 'paused') controller.resume();
      }
    };
    // Stop Space from also "clicking" whichever HUD button has focus.
    const onKeyUp = (e: KeyboardEvent) => {
      if (isSpace(e) && !controller.popup && !isControl(e.target)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [controller]);
  const [lowGraphics, setLowGraphics] = useState(readLowGraphics);
  const onLowGraphics = (on: boolean) => {
    setLowGraphics(on);
    writeLowGraphics(on);
  };

  return (
    <div class="game-screen">
      <Hud controller={c} data={data} lowGraphics={lowGraphics} onLowGraphics={onLowGraphics} dayName={dayName} />
      <div class="stage">
        <ClinicCanvas controller={c} data={data} lowGraphics={lowGraphics} />
        {c.popup && <PopupDialog popup={c.popup} onAnswer={(id) => c.answer(id)} />}
      </div>
    </div>
  );
}
