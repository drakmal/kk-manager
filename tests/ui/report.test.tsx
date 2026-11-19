// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { createController } from '../../src/game/controller';
import { defaultDayPlan, fmt, loadGameData } from '../../src/sim/index';
import { ReportScreen } from '../../src/ui/ReportScreen';

const data = loadGameData();
const finished = (empty = false) => {
  const plan = defaultDayPlan(data, 3);
  if (empty) plan.roster.ancNurse = [];
  const c = createController(data, 3, { plan });
  c.start();
  c.skipAhead();
  return c;
};
afterEach(cleanup);

test('report shows the day, lunch and balik headlines, both scores and the wait table', () => {
  const c = finished();
  render(<ReportScreen controller={c} data={data} dayLabel="Isnin" continueLabel="Continue to Selasa" onContinue={() => {}} />);
  expect(screen.getByRole('heading', { name: 'End of day · Isnin' })).toBeTruthy();
  expect(screen.getByText(/Makan on time|Late lunch|Tak sempat makan/)).toBeTruthy();
  expect(screen.getByText(/Balik on time|Overtime/)).toBeTruthy();
  const table = screen.getByRole('table', { name: 'Waiting time by visit type' });
  for (const id of Object.keys(c.report!.waitByVisitType)) {
    expect(table.textContent).toContain(data.visitTypes.find((v) => v.id === id)!.label);
  }
  expect(screen.getByText(String(Math.round(c.report!.patientSatisfaction)))).toBeTruthy();
});

test('report lists the top three bottlenecks with times', () => {
  const c = finished();
  render(<ReportScreen controller={c} data={data} dayLabel="Isnin" continueLabel="Continue" onContinue={() => {}} />);
  const top = Object.entries(c.report!.peakQueue).sort((a, b) => b[1].size - a[1].size).slice(0, 3);
  for (const [id, peak] of top) {
    expect(screen.getByText(`${data.stations.find((s) => s.id === id)!.label}: ${peak.size} waiting at ${fmt(peak.at)}`)).toBeTruthy();
  }
});

test('report shows unfinished patients when there are any', () => {
  const c = finished(true);
  render(<ReportScreen controller={c} data={data} dayLabel="Isnin" continueLabel="Continue" onContinue={() => {}} />);
  expect(screen.getByText(`${c.report!.unfinished} patients still waiting at 19:00`)).toBeTruthy();
});

test('the continue button uses its label and calls back', () => {
  const c = finished();
  const onContinue = vi.fn();
  render(<ReportScreen controller={c} data={data} dayLabel="Rabu" continueLabel="Continue to Khamis" onContinue={onContinue} />);
  fireEvent.click(screen.getByRole('button', { name: 'Continue to Khamis' }));
  expect(onContinue).toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'New day' })).toBeNull();
});
