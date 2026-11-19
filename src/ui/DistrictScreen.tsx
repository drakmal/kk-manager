import type { WeekController } from '../week/controller';
import { WEEK_DAYS } from '../week/week';
import { useController } from './useController';

export function DistrictScreen({ week }: { week: WeekController }) {
  const w = useController(week);
  const r = w.review;
  if (!r) return null;

  return (
    <div class="screen district-screen">
      <header class="screen-head">
        <h1>Lawatan Pegawai Kesihatan Daerah · Minggu {w.state.week}</h1>
        <p class="hint">The district officer has read this week’s reports.</p>
      </header>
      <div class="district-grid">
        <section class="card grade-card">
          <h2>Grade</h2>
          <div class={`grade grade-${r.grade}`} aria-label="Grade">{r.grade}</div>
        </section>
        <section class="card">
          <h2>The week in numbers</h2>
          <ul>
            <li>Patient satisfaction (mean): {r.patient}</li>
            <li>Staff satisfaction (mean): {r.hcw}</li>
            <li>Lunch on time: {r.lunchOnTime} of {WEEK_DAYS} days</li>
            <li>Overtime: {r.overtimeDays} of {WEEK_DAYS} days</li>
          </ul>
        </section>
      </div>
      <section class="card remarks">
        <h2>Ulasan PKD</h2>
        {r.lines.map((line) => <p key={line}>{line}</p>)}
      </section>
      <footer class="screen-foot">
        <span class="hint">Medium (KK Jenis 3): coming soon</span>
        <button type="button" class="primary" onClick={() => w.playAnotherWeek()}>Play another week</button>
      </footer>
    </div>
  );
}
