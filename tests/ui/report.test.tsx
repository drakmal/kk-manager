// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { createController } from '../../src/game/controller';
import { loadGameData } from '../../src/sim/data';
import { fmt } from '../../src/sim/time';
import { ReportScreen } from '../../src/ui/ReportScreen';

const data = loadGameData();
const finished = (edit?: (c: ReturnType<typeof createController>) => void) => {
  const c = createController(data, 3);
  edit?.(c);
  c.start();
  c.finishNow();
  return c;
};
afterEach(cleanup);

test('report shows lunch and balik headlines and the wait table', () => {
  const c = finished();
  render(<ReportScreen controller={c} data={data} />);
  expect(screen.getByText(/Makan on time|Late lunch|Tak sempat makan/)).toBeTruthy();
  expect(screen.getByText(/Balik on time|Overtime/)).toBeTruthy();
  const table = screen.getByRole('table', { name: 'Waiting time by visit type' });
  for (const id of Object.keys(c.report!.waitByVisitType)) {
    const label = data.visitTypes.find((v) => v.id === id)!.label;
    expect(table.textContent).toContain(label);
  }
  expect(screen.getByText(String(Math.round(c.report!.patientSatisfaction)))).toBeTruthy();
});

test('report lists the top three bottlenecks with times', () => {
  const c = finished();
  render(<ReportScreen controller={c} data={data} />);
  const top = Object.entries(c.report!.peakQueue).sort((a, b) => b[1].size - a[1].size).slice(0, 3);
  for (const [id, peak] of top) {
    const label = data.stations.find((s) => s.id === id)!.label;
    expect(screen.getByText(`${label}: ${peak.size} waiting at ${fmt(peak.at)}`)).toBeTruthy();
  }
});

test('report shows unfinished patients when there are any', () => {
  const c = finished((x) => {
    const plan = structuredClone(x.plan);
    plan.roster.ancNurse = [];
    x.setPlan(plan);
  });
  render(<ReportScreen controller={c} data={data} />);
  expect(screen.getByText(`${c.report!.unfinished} patients still waiting at 19:00`)).toBeTruthy();
});

test('report buttons replay the day or start a new one', () => {
  const c = finished();
  render(<ReportScreen controller={c} data={data} />);
  fireEvent.click(screen.getByRole('button', { name: 'New day' }));
  expect(c.phase).toBe('plan');
  expect(c.plan.seed).toBe(4);
});

test('in the campaign the report offers Continue to tonight instead of replay', () => {
  const c = finished();
  const onContinue = vi.fn();
  render(<ReportScreen controller={c} data={data} onContinue={onContinue} dayLabel="Rabu · Hari 3" />);
  expect(screen.getByRole('heading', { name: 'End of day · Rabu · Hari 3' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'New day' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Continue to tonight' }));
  expect(onContinue).toHaveBeenCalled();
});
