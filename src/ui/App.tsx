import { useMemo } from 'preact/hooks';
import { createController, type DayController } from '../game/controller';
import { loadGameData, type GameData } from '../sim/index';
import { GameScreen } from './GameScreen';
import { PlanScreen } from './PlanScreen';
import { ReportScreen } from './ReportScreen';
import { useController } from './useController';

interface Props {
  data?: GameData;
  controller?: DayController;
}

export function App(props: Props) {
  const data = useMemo(() => props.data ?? loadGameData(), [props.data]);
  const controller = useMemo(() => props.controller ?? createController(data, 1), [props.controller, data]);
  const c = useController(controller);

  return (
    <div class="app">
      <div class="brand" aria-hidden={c.phase === 'running' || c.phase === 'paused'}>
        KK Manager
      </div>
      {c.phase === 'plan' && <PlanScreen controller={c} data={data} />}
      {(c.phase === 'running' || c.phase === 'paused') && <GameScreen controller={c} data={data} />}
      {c.phase === 'report' && <ReportScreen controller={c} data={data} />}
    </div>
  );
}
