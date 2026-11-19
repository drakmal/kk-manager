import { purposeColour } from '../game/appearance';
import type { DayController } from '../game/controller';
import type { GameData } from '../sim/index';
import { RosterEditor } from './RosterEditor';
import { ScenarioPicker } from './ScenarioPicker';
import { SopCards } from './SopCards';
import { useController } from './useController';

interface Props {
  controller: DayController;
  data: GameData;
}

export function PurposeLegend({ data }: { data: GameData }) {
  return (
    <ul class="legend" aria-label="Purpose of visit">
      {data.visitTypes.map((v) => (
        <li key={v.id}>
          <i style={{ background: purposeColour(v.id) }} aria-hidden="true" />
          {v.label}
        </li>
      ))}
    </ul>
  );
}

export function PlanScreen({ controller, data }: Props) {
  const c = useController(controller);
  const { plan } = c;
  const empty = data.stations.filter((s) => (plan.roster[s.id] ?? []).length === 0);

  return (
    <div class="screen plan-screen">
      <header class="screen-head">
        <h1>Pagi ini · Hari {plan.seed}</h1>
        <p class="hint">You are the Clinic Manager. Set the roster and the SOP for today, then open the clinic.</p>
      </header>

      <div class="plan-grid">
        <div>
          <ScenarioPicker value={c.scenarioId} onChange={(id) => c.setScenario(id)} />
          <RosterEditor data={data} roster={plan.roster} onChange={(roster) => c.setPlan({ ...plan, roster })} />
        </div>
        <div>
          <SopCards data={data} sop={plan.sop} onChange={(sop) => c.setPlan({ ...plan, sop })} />
          <section class="card">
            <h2>Purpose of visit</h2>
            <PurposeLegend data={data} />
          </section>
        </div>
      </div>

      <footer class="screen-foot">
        {empty.length > 0 && (
          <ul class="warnings" role="status">
            {empty.map((s) => (
              <li key={s.id}>{s.label} has no staff. Patients sent there will not be seen.</li>
            ))}
          </ul>
        )}
        <button type="button" class="primary" onClick={() => c.start()}>
          Start the day
        </button>
      </footer>
    </div>
  );
}
