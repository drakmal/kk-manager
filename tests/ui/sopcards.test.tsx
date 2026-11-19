// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { defaultDayPlan, loadGameData } from '../../src/sim/index';
import { SopCards } from '../../src/ui/SopCards';

const data = loadGameData();
const sop = defaultDayPlan(data, 1).sop;
afterEach(cleanup);

test('a locked card shows its name with a lock and has no inputs', () => {
  render(<SopCards data={data} sop={sop} onChange={() => {}} unlocked={['saringan', 'laluanKhas', 'pinjamDoktor']} />);
  expect(screen.getByText('🔒 Temujanji Berperingkat (locked)')).toBeTruthy();
  expect(screen.getByText('🔒 Pelan Kontingensi CCMS (locked)')).toBeTruthy();
  expect(screen.queryByLabelText('Use Temujanji Berperingkat')).toBeNull();
  expect(screen.queryByLabelText('Print tomorrow’s appointment list')).toBeNull();
  expect(screen.getByLabelText('Use Laluan Khas')).toBeTruthy();
});

test('without an unlocked list every card is open (free play)', () => {
  render(<SopCards data={data} sop={sop} onChange={() => {}} />);
  expect(screen.queryByText(/locked/)).toBeNull();
  expect(screen.getByLabelText('Use Temujanji Berperingkat')).toBeTruthy();
});

test('the mentor card lists the trainee’s room doctors and reports changes', () => {
  const onChange = vi.fn();
  const trainees = [{ staffId: 'mo7', experience: 2, mentor: 'mo1' }];
  render(
    <SopCards
      data={data} sop={sop} onChange={() => {}}
      mentor={{
        on: false, trainees,
        names: { mo7: 'Dr. Amir (MO baru)' },
        doctors: { mo7: [{ id: 'mo1', name: 'Dr. Aina' }, { id: 'mo2', name: 'Dr. Hafiz' }] },
        onChange,
      }}
    />,
  );
  const select = screen.getByLabelText('Mentor for Dr. Amir (MO baru)') as HTMLSelectElement;
  expect([...select.options].map((o) => o.value)).toEqual(['', 'mo1', 'mo2']);
  expect(select.value).toBe('mo1');
  fireEvent.change(select, { target: { value: 'mo2' } });
  expect(onChange).toHaveBeenLastCalledWith(false, [{ staffId: 'mo7', experience: 2, mentor: 'mo2' }]);
  fireEvent.click(screen.getByLabelText('Use Pasangan Mentor'));
  expect(onChange).toHaveBeenLastCalledWith(true, trainees);
});
