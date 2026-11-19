// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { createController } from '../../src/game/controller';
import { loadGameData } from '../../src/sim/data';
import { PlanScreen } from '../../src/ui/PlanScreen';
import { assignSeat } from '../../src/ui/RosterEditor';

const data = loadGameData();
const setup = () => {
  const controller = createController(data, 1);
  render(<PlanScreen controller={controller} data={data} />);
  return controller;
};
afterEach(cleanup);

test('lists every station with its seats', () => {
  setup();
  for (const s of data.stations) {
    expect(screen.getAllByLabelText(new RegExp(`^${s.label} seat \\d$`))).toHaveLength(s.seats);
  }
});

test('choosing a doctor already in OPD moves them to MCH', () => {
  const c = setup();
  fireEvent.change(screen.getByLabelText('Bilik Doktor KIA seat 2'), { target: { value: 'mo3' } });
  expect(c.plan.roster.mchDoctor).toEqual(['mo1', 'mo3']);
  expect(c.plan.roster.opdDoctor).not.toContain('mo3');
  expect(c.plan.roster.opdDoctor).toHaveLength(3);
  expect((screen.getByLabelText('Bilik Doktor KIA seat 2') as HTMLSelectElement).value).toBe('mo3');
});

test('assignSeat moves someone within the same room without duplicating them', () => {
  const roster = { mchDoctor: ['mo1', 'mo2'], opdDoctor: ['mo3'] };
  expect(assignSeat(roster, 'mchDoctor', 1, 'mo1', 2)).toEqual({ mchDoctor: ['mo1'], opdDoctor: ['mo3'] });
  expect(assignSeat(roster, 'mchDoctor', 0, '', 2)).toEqual({ mchDoctor: ['mo2'], opdDoctor: ['mo3'] });
  expect(roster).toEqual({ mchDoctor: ['mo1', 'mo2'], opdDoctor: ['mo3'] }); // not mutated
});

test('a seat only offers staff whose role fits the room', () => {
  setup();
  const options = [...(screen.getByLabelText('Bilik Jururawat ANC seat 1') as HTMLSelectElement).options].map((o) => o.value);
  expect(options).toEqual(['', 'jk1', 'jk2']);
});

test('Saringan checkbox sets bypass for that visit type', () => {
  const c = setup();
  fireEvent.click(screen.getByLabelText('Straight to doctor: Antenatal (doktor sahaja)'));
  expect(c.plan.sop.saringan.bypass.anc_doctor_only).toBe(true);
});

test('the other SOP cards change their settings', () => {
  const c = setup();
  fireEvent.click(screen.getByLabelText('Print tomorrow’s appointment list'));
  expect(c.plan.sop.kontingensiCcms.printedList).toBe(true);
  fireEvent.click(screen.getByLabelText('Use Pinjam Doktor OPD'));
  fireEvent.change(screen.getByLabelText('Queue threshold'), { target: { value: '4' } });
  expect(c.plan.sop.pinjamDoktor).toMatchObject({ enabled: true, queueThreshold: 4 });
  fireEvent.click(screen.getByLabelText('Use Laluan Khas'));
  fireEvent.click(screen.getByLabelText('Pregnant women'));
  expect(c.plan.sop.laluanKhas).toMatchObject({ enabled: true, groups: ['pregnant'] });
  fireEvent.click(screen.getByLabelText('Use Temujanji Berperingkat'));
  expect(c.plan.sop.temujanji.enabled).toBe(true);
});

test('empty station shows a warning but Start still works', () => {
  const c = setup();
  fireEvent.change(screen.getByLabelText('Bilik Jururawat ANC seat 1'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Bilik Jururawat ANC seat 1'), { target: { value: '' } });
  expect(c.plan.roster.ancNurse).toEqual([]);
  expect(screen.getByText('Bilik Jururawat ANC has no staff. Patients sent there will not be seen.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Start the day' }));
  expect(c.phase).toBe('running');
});

test('Start the day calls controller.start and the phase becomes running', () => {
  const c = setup();
  expect(screen.queryByText(/has no staff/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Start the day' }));
  expect(c.phase).toBe('running');
});

test('scenario picker sets the controller scenario', () => {
  const c = setup();
  fireEvent.click(screen.getByLabelText(/CCMS down pagi/));
  expect(c.scenarioId).toBe('ccmsPagi');
});

test('the purpose-dot legend names every visit type', () => {
  setup();
  for (const v of data.visitTypes) expect(screen.getAllByText(v.label).length).toBeGreaterThan(0);
});

test('in the campaign the plan screen shows the day label, hides the day-type picker and locks cards', () => {
  const controller = createController(data, 1);
  render(<PlanScreen controller={controller} data={data} campaign={{ dayLabel: 'Selasa · Hari 2', unlocked: ['saringan'], mentor: undefined }} />);
  expect(screen.getByRole('heading', { name: 'Pagi ini · Selasa · Hari 2' })).toBeTruthy();
  expect(screen.queryByLabelText(/CCMS down pagi/)).toBeNull();
  expect(screen.getByText('🔒 Laluan Khas (locked)')).toBeTruthy();
});
