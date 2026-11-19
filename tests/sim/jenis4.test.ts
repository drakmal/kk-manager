import { createDaySim, defaultDayPlan, generatePatients, createRng, loadGameData, runDay } from '../../src/sim/index';
import { groupRooms } from '../../src/sim/data';

const data = loadGameData();
const ids = data.stations.map((s) => s.id);

test('the Jenis 4 clinic has its rooms and no dental', () => {
  for (const id of ['opdRoom1', 'opdRoom2', 'xray', 'emergency', 'physio', 'nutrition', 'mchDoctor', 'ancNurse']) expect(ids).toContain(id);
  expect(ids).not.toContain('opdDoctor');
  for (const s of data.stations) expect(`${s.id} ${s.label}`).not.toMatch(/dental|pergigian/i);
  for (const v of data.visitTypes) expect(`${v.id} ${v.label}`).not.toMatch(/dental|pergigian/i);
});

test('labels say MCH, never KIA', () => {
  for (const s of data.stations) expect(s.label).not.toMatch(/KIA/);
  expect(data.stations.find((s) => s.id === 'mchDoctor')!.label).toBe('Bilik Doktor MCH');
  expect(data.stations.find((s) => s.id === 'mchRegistration')!.label).toBe('Kaunter MCH');
  expect(data.stations.find((s) => s.id === 'mchTriage')!.label).toBe('Saringan MCH');
});

test('OPD rooms share group opdDoctor with two seats and two doctors each', () => {
  const rooms = groupRooms(data, 'opdDoctor');
  expect(rooms.map((r) => [r.id, r.label, r.seats])).toEqual([['opdRoom1', 'Bilik 1', 2], ['opdRoom2', 'Bilik 2', 2]]);
  const roster = defaultDayPlan(data, 1).roster;
  expect(roster.opdRoom1).toEqual(['mo3', 'mo4']);
  expect(roster.opdRoom2).toEqual(['mo5', 'mo6']);
  expect(roster.mchDoctor).toEqual(['mo1', 'mo2']);
  expect(roster.xray).toEqual(['jxr1']);
  expect(roster.physio).toEqual(['jp1']);
  expect(roster.nutrition).toEqual(['pd1']);
  expect(roster.emergency).toEqual([]);
});

test('a simulated Isnin splits OPD patients evenly between Bilik 1 and Bilik 2 (±2)', () => {
  const sim = createDaySim(data, defaultDayPlan(data, 1));
  while (!sim.isDone()) sim.step();
  const rooms = sim.patients.flatMap((p) => (p.route ?? []).map((s) => s.station)).filter((s) => s.startsWith('opdRoom'));
  const one = rooms.filter((r) => r === 'opdRoom1').length;
  const two = rooms.filter((r) => r === 'opdRoom2').length;
  expect(one + two).toBeGreaterThan(80);
  expect(Math.abs(one - two)).toBeLessThanOrEqual(2);
});

test('booking visits always have an ultrasound add-on; other antenatal doctor visits sometimes', () => {
  const booking = data.visitTypes.find((v) => v.id === 'anc_booking')!.steps.find((s) => s.station === 'mchDoctor')!;
  expect(booking.addOn).toEqual({ chance: 1, minutes: [5, 10] });
  for (const id of ['anc_nurse_doctor', 'anc_doctor_only']) {
    expect(data.visitTypes.find((v) => v.id === id)!.steps.find((s) => s.station === 'mchDoctor')!.addOn).toEqual({ chance: 0.3, minutes: [5, 10] });
  }
});

test('OPD has X-ray, physio and nutrition visits; side-room patients use the OPD counter', () => {
  const opd = data.visitTypes.filter((v) => v.unit === 'opd');
  expect(Object.fromEntries(opd.map((v) => [v.id, v.share]))).toEqual({ opd_general: 0.92, physio: 0.05, nutrition: 0.03 });
  expect(opd.find((v) => v.id === 'opd_general')!.steps.find((s) => s.station === 'xray')!.chance).toBe(0.08);
  for (const id of ['physio', 'nutrition']) {
    expect(opd.find((v) => v.id === id)!.steps.map((s) => s.station)).toEqual(['primaryTriage', 'opdRegistration', id]);
  }
  const patients = generatePatients(data, defaultDayPlan(data, 1), createRng(1));
  expect(patients.length).toBe(160);
});

test('a default day still finishes by 19:00 with most patients seen', () => {
  const r = runDay(data, defaultDayPlan(data, 1));
  expect(r.unfinished).toBeLessThanOrEqual(10);
  expect(data.tuning.printerRegistrationExtra).toBe(2);
});
