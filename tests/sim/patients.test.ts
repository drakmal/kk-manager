import { loadGameData } from '../../src/sim/data';
import { generatePatients, makePatient } from '../../src/sim/patients';
import { defaultDayPlan } from '../../src/sim/plan';
import { createRng } from '../../src/sim/rng';

const data = loadGameData();

test('count matches daily volume', () => {
  const ps = generatePatients(data, defaultDayPlan(data, 1), createRng(1));
  expect(ps.filter((p) => p.unit === 'mch')).toHaveLength(40);
  expect(ps.filter((p) => p.unit === 'opd')).toHaveLength(120);
});

test('deterministic', () => {
  const plan = defaultDayPlan(data, 5);
  expect(generatePatients(data, plan, createRng(5))).toEqual(generatePatients(data, plan, createRng(5)));
});

test('arrivals within 420..990 and sorted', () => {
  const ps = generatePatients(data, defaultDayPlan(data, 9), createRng(9));
  for (const p of ps) {
    expect(p.arrival).toBeGreaterThanOrEqual(420);
    expect(p.arrival).toBeLessThanOrEqual(990);
  }
  const arrivals = ps.map((p) => p.arrival);
  expect(arrivals).toEqual([...arrivals].sort((a, b) => a - b));
});

test('chance steps sampled; durations within range; colour only for anc', () => {
  for (let seed = 1; seed <= 5; seed++) {
    for (const p of generatePatients(data, defaultDayPlan(data, seed), createRng(seed))) {
      if (p.visitType === 'anc_doctor_only') {
        const nurse = p.steps.find((s) => s.station === 'ancNurse');
        expect(nurse?.bypassable).toBe(true);
        expect(nurse!.minutes).toBeGreaterThanOrEqual(4);
        expect(nurse!.minutes).toBeLessThanOrEqual(6);
      }
      if (p.visitType === 'opd_general') expect(p.colour).toBeNull();
      if (p.visitType.startsWith('anc_')) expect(p.colour).not.toBeNull();
      expect(p.route).toBeNull();
      expect(p.doneAt).toBeNull();
    }
  }
});

test('kuning/merah scale mchDoctor minutes', () => {
  let checked = 0;
  for (let id = 0; checked < 20 && id < 5000; id++) {
    const p = makePatient(data, 'anc_nurse_doctor', 500, id, createRng(id));
    if (p.colour !== 'merah') continue;
    const doc = p.steps.find((s) => s.station === 'mchDoctor')!;
    expect(doc.minutes).toBeGreaterThanOrEqual(Math.ceil(8 * 1.6));
    expect(doc.minutes).toBeLessThanOrEqual(Math.ceil(15 * 1.6));
    checked++;
  }
  expect(checked).toBe(20);
});

test('temujanji spreads appointment arrivals into slots', () => {
  const plan = defaultDayPlan(data, 2);
  plan.sop.temujanji = { enabled: true, from: 480, to: 720, slotMinutes: 30, perSlot: 6 };
  const appt = generatePatients(data, plan, createRng(2)).filter((p) => p.unit === 'mch');
  expect(appt).toHaveLength(40);
  expect(appt.filter((p) => p.arrival < 465)).toHaveLength(0);
  // 40 patients, 6 per slot → the 7th slot (08:00 + 6×30 = 11:00) is the last one used.
  expect(Math.max(...appt.map((p) => p.arrival))).toBeLessThanOrEqual(660 + 5);
});
