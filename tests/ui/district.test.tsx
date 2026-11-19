// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { loadGameData } from '../../src/sim/index';
import { DistrictScreen } from '../../src/ui/DistrictScreen';
import { startWeek, type WeekController } from '../../src/week/controller';
import { memoryStorage } from '../../src/week/storage';

const data = loadGameData();
afterEach(cleanup);

function playWeek(w: WeekController) {
  for (let i = 0; i < 5; i++) {
    while (w.morning) w.answerMorning(w.morning.choices[0]!.id);
    const d = w.day!;
    while (d.phase !== 'report') {
      d.skipAhead();
      if (d.popup) d.answer(d.popup.choices[0]!.id);
    }
    w.continueAfterReport();
  }
}

test('the district screen shows the week, grade, numbers and remarks, then plays another week', () => {
  const w = startWeek(data, memoryStorage(), 7, () => 'now');
  playWeek(w);
  render(<DistrictScreen week={w} />);
  const r = w.review!;
  expect(screen.getByRole('heading', { name: /Minggu 1/ })).toBeTruthy();
  expect(screen.getByLabelText('Grade').textContent).toBe(r.grade);
  for (const line of r.lines) expect(screen.getByText(line)).toBeTruthy();
  expect(screen.getByText(`Lunch on time: ${r.lunchOnTime} of 5 days`)).toBeTruthy();
  expect(screen.getByText('Medium (KK Jenis 3): coming soon')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Play another week' }));
  expect(w.state.week).toBe(2);
});
