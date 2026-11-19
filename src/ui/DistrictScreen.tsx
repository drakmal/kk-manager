import type { CampaignController } from '../campaign/controller';
import { useController } from './useController';

export function DistrictScreen({ campaign }: { campaign: CampaignController }) {
  const c = useController(campaign);
  const r = c.review;
  if (!r) return null;

  return (
    <div class="screen district-screen">
      <header class="screen-head">
        <h1>Lawatan Pegawai Kesihatan Daerah</h1>
        <p class="hint">The district officer has read your two weeks of reports.</p>
      </header>
      <div class="district-grid">
        <section class="card grade-card">
          <h2>Grade</h2>
          <div class={`grade grade-${r.grade}`} aria-label="Grade">{r.grade}</div>
        </section>
        <section class="card">
          <h2>Two weeks in numbers</h2>
          <ul>
            <li>Patient satisfaction (mean): {r.patient}</li>
            <li>Staff satisfaction (mean): {r.hcw}</li>
            <li>Lunch on time: {r.lunchOnTime} of 10 days</li>
            <li>Overtime: {r.overtimeDays} of 10 days</li>
          </ul>
        </section>
      </div>
      <section class="card remarks">
        <h2>Ulasan PKD</h2>
        {r.lines.map((line) => <p key={line}>{line}</p>)}
      </section>
      <footer class="screen-foot">
        <button type="button" class="primary" onClick={() => c.continueAfterDistrict()}>Continue (endless mode)</button>
      </footer>
    </div>
  );
}
