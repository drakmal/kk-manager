import type { DayController } from '../game/controller';
import { fmt, type GameData } from '../sim/index';
import { useController } from './useController';

interface Props {
  controller: DayController;
  data: GameData;
  /** The day just played, e.g. "Isnin". */
  dayLabel: string;
  /** "Continue to Selasa", or "Continue" before the district visit. */
  continueLabel: string;
  onContinue(): void;
}

const LUNCH = { onTime: '🍛 Makan on time', late: '🍛 Late lunch', missed: '🍛 Tak sempat makan' } as const;
const BALIK = { onTime: '🏠 Balik on time', overtime: '🏠 Overtime' } as const;

export function ReportScreen({ controller, data, dayLabel, continueLabel, onContinue }: Props) {
  const c = useController(controller);
  const r = c.report;
  if (!r) return null;
  const label = (id: string) => data.stations.find((s) => s.id === id)?.label ?? id;
  const visitLabel = (id: string) => data.visitTypes.find((v) => v.id === id)?.label ?? id;
  const nameOf = (id: string) => data.staff.find((s) => s.id === id)?.name ?? id;
  const mchDoctors = (c.dayPlan?.roster.mchDoctor ?? []).filter((id) => r.idleByStaff[id]);
  const peaks = Object.entries(r.peakQueue).filter(([, p]) => p.size > 0).sort((a, b) => b[1].size - a[1].size);
  const worst = peaks[0]?.[1].size ?? 1;

  return (
    <div class="screen report-screen">
      <header class="screen-head">
        <h1>End of day · {dayLabel}</h1>
        <div class="headline">
          <span>{LUNCH[r.lunch.outcome]}</span>
          <span>{BALIK[r.balik.outcome]}</span>
        </div>
      </header>

      <div class="report-grid">
        <div>
          <section class="card">
            <h2>Satisfaction</h2>
            <div class="scores">
              <div>Pesakit<strong>{Math.round(r.patientSatisfaction)}</strong></div>
              <div>HCW<strong>{Math.round(r.hcwSatisfaction)}</strong></div>
            </div>
            {r.balik.lastPatientDone !== null && <p class="hint">Last patient done at {fmt(r.balik.lastPatientDone)}.</p>}
            {r.unfinished > 0 && <p class="unfinished">{r.unfinished} patients still waiting at 19:00</p>}
          </section>

          <section class="card">
            <h2>Waiting time by visit type</h2>
            <table class="waits" aria-label="Waiting time by visit type">
              <thead>
                <tr><th>Visit</th><th class="num">Patients</th><th class="num">Mean (min)</th><th class="num">Longest (min)</th></tr>
              </thead>
              <tbody>
                {Object.entries(r.waitByVisitType).map(([id, w]) => (
                  <tr key={id}>
                    <td>{visitLabel(id)}</td>
                    <td class="num">{w.count}</td>
                    <td class="num">{Math.round(w.mean)}</td>
                    <td class="num">{w.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section class="card">
            <h2>MCH doctors idle, 08:00 to 10:00</h2>
            <ul>
              {mchDoctors.map((id) => <li key={id}>{nameOf(id)}: {r.idleByStaff[id]!.morning} min</li>)}
            </ul>
          </section>
        </div>

        <div>
          <section class="card">
            <h2>Bottlenecks</h2>
            <ol>
              {peaks.slice(0, 3).map(([id, p]) => <li key={id}>{label(id)}: {p.size} waiting at {fmt(p.at)}</li>)}
            </ol>
            <div class="flow" aria-hidden="true">
              {data.stations.map((s) => {
                const size = r.peakQueue[s.id]?.size ?? 0;
                const heat = Math.min(1, size / worst);
                return (
                  <div key={s.id} style={{ background: `rgba(192, 57, 43, ${0.08 + heat * 0.5})` }}>
                    {s.label}
                    <strong>{size}</strong>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <footer class="screen-foot">
        <button type="button" class="primary" onClick={onContinue}>{continueLabel}</button>
      </footer>
    </div>
  );
}
