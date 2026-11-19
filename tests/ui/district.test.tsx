// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { createCampaign, dayPlanFor, endDay } from '../../src/campaign/campaign';
import { resumeCampaign } from '../../src/campaign/controller';
import { memoryStorage } from '../../src/campaign/saves';
import { loadGameData } from '../../src/sim/index';
import { DistrictScreen } from '../../src/ui/DistrictScreen';
import { fakeReport } from '../campaign/helpers';

const data = loadGameData();
const now = () => '2026-11-19T21:00:00.000Z';
afterEach(cleanup);

test('the district screen shows the grade, numbers and remarks, then continues to endless mode', () => {
  let state = createCampaign(data, 1);
  while (state.day < 10) state = endDay(data, state, fakeReport(), dayPlanFor(data, state));
  const c = resumeCampaign(data, memoryStorage(), { version: 1, slot: 1, savedAt: now(), state }, now);
  for (const m of c.state.messages) c.choose(m.id, m.choices.find((x) => !x.disabledReason)!.id);
  c.toPlan();
  c.day!.start();
  c.day!.finishNow();
  c.continueAfterReport();
  render(<DistrictScreen campaign={c} />);
  const r = c.review!;
  expect(screen.getByLabelText('Grade').textContent).toBe(r.grade);
  for (const line of r.lines) expect(screen.getByText(line)).toBeTruthy();
  expect(screen.getByText(`Lunch on time: ${r.lunchOnTime} of 10 days`)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Continue (endless mode)' }));
  expect(c.phase).toBe('night');
});
