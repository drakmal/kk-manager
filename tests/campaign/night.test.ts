import { createCampaign, dayPlanFor, endDay } from '../../src/campaign/campaign';
import { allAnswered, applyChoice, nightMessages } from '../../src/campaign/night';
import type { CampaignState } from '../../src/campaign/types';
import { loadGameData } from '../../src/sim/index';
import { fakeReport } from './helpers';

const data = loadGameData();

function advanceTo(day: number, report = fakeReport(), seed = 1): CampaignState {
  let s = createCampaign(data, seed);
  while (s.day < day) s = endDay(data, s, report, dayPlanFor(data, s));
  return s;
}
const withMessages = (s: CampaignState): CampaignState => ({ ...s, messages: nightMessages(data, s, s.history.at(-1) ?? null) });
const elOf = (s: CampaignState) => s.messages.find((m) => m.kind === 'el');

test('night before day 1 has the tutorial message', () => {
  const s = withMessages(createCampaign(data, 1));
  expect(s.messages).toHaveLength(1);
  expect(s.messages[0]).toMatchObject({
    kind: 'tutorial', from: 'Kak Ida (PT)', chosen: null,
    text: 'Selamat datang, Clinic Manager! Esok hari pertama. Tengok siapa yang menunggu paling lama di KIA.',
    choices: [{ id: 'ok', label: 'Baik', disabledReason: null }],
  });
});

test('night before day 4 announces the new doctor; night before day 6 forecasts the bus', () => {
  const d4 = withMessages(advanceTo(4));
  expect(d4.messages.find((m) => m.kind === 'newDoctor')).toMatchObject({
    from: 'Pejabat Kesihatan Daerah', text: 'Dr. Amir (MO baru) akan melapor diri esok. Sila tetapkan mentor.',
  });
  const d6 = withMessages(advanceTo(6));
  expect(d6.messages.find((m) => m.kind === 'forecast')).toMatchObject({
    from: 'Cikgu Rahman (sekolah asrama)', text: 'Esok kami bawa pelajar untuk saringan kesihatan, lebih kurang 25 orang 🚌',
  });
});

test('night 4 always has an EL message from Dr. Hafiz', () => {
  for (const seed of [1, 2, 3]) {
    const s = withMessages(advanceTo(5, fakeReport(), seed));
    const el = elOf(s)!;
    expect(el).toMatchObject({ from: 'Dr. Hafiz', text: 'Dr, saya demam, esok nak EL 🙏', staffId: 'mo2' });
    expect(el.choices.map((c) => c.id)).toEqual(['relief', 'pinjam', 'kosong']);
    expect(el.choices[0]!.label).toBe('Minta relief dari klinik lain (−20 goodwill)');
  }
});

test('EL relief: away set, relief seated in that station, goodwill −20, relief counted', () => {
  const s = withMessages(advanceTo(5));
  const goodwill = s.goodwill;
  const after = applyChoice(data, s, elOf(s)!.id, 'relief');
  expect(after.tomorrow.away).toEqual(['mo2']);
  expect(after.tomorrow.relief).toEqual({ staffId: 'relief1', station: 'mchDoctor' });
  expect(after.goodwill).toBe(goodwill - 20);
  expect(after.reliefsThisWeek).toBe(1);
  expect(elOf(after)!.chosen).toBe('relief');
  expect(dayPlanFor(data, after).roster.mchDoctor).toEqual(['mo1', 'relief1']);
  expect(s.tomorrow.away).toEqual([]); // not mutated
});

test('relief is disabled with a reason when goodwill < 20 or two reliefs used', () => {
  const poor = withMessages({ ...advanceTo(5), goodwill: 19 });
  expect(elOf(poor)!.choices[0]!.disabledReason).toBe('Not enough goodwill');
  const after = applyChoice(data, poor, elOf(poor)!.id, 'relief');
  expect(after).toEqual(poor); // nothing spent, nothing chosen
  const used = withMessages({ ...advanceTo(5), reliefsThisWeek: 2 });
  expect(elOf(used)!.choices[0]!.disabledReason).toBe('Relief limit reached this week');
});

test('pinjam moves an OPD doctor into the empty MCH seat for tomorrow', () => {
  const s = withMessages(advanceTo(5));
  const after = applyChoice(data, s, elOf(s)!.id, 'pinjam');
  expect(after.tomorrow.away).toEqual(['mo2']);
  const plan = dayPlanFor(data, after);
  expect(plan.roster.mchDoctor).toEqual(['mo1', 'mo3']);
  expect(plan.roster.opdDoctor).toEqual(['mo4', 'mo5', 'mo6']);
  expect(after.goodwill).toBe(s.goodwill);
});

test('pinjam is disabled when the doctor on leave is from OPD', () => {
  // Find a later night whose random EL picks an OPD doctor.
  const tired = fakeReport({ hcwSatisfaction: 10 });
  let found = false;
  for (let seed = 1; seed < 40 && !found; seed++) {
    const s = withMessages(advanceTo(6, tired, seed));
    const el = elOf(s);
    if (!el || !s.roster.opdDoctor!.includes(el.staffId!)) continue;
    expect(el.choices[1]!.disabledReason).toBe('Doctor is from OPD');
    found = true;
  }
  expect(found).toBe(true);
});

test('kosong just leaves the seat empty', () => {
  const s = withMessages(advanceTo(5));
  const after = applyChoice(data, s, elOf(s)!.id, 'kosong');
  expect(dayPlanFor(data, after).roster.mchDoctor).toEqual(['mo1']);
  expect(after.tomorrow.relief).toBeNull();
});

test('no EL message for a doctor who is not rostered tomorrow', () => {
  const s = advanceTo(5);
  s.roster.mchDoctor = ['mo1'];
  expect(elOf(withMessages(s))).toBeUndefined();
});

test('EL on two nights in a row does not pick the same absent doctor or double a seat', () => {
  const tired = fakeReport({ hcwSatisfaction: 0 });
  for (const seed of [1, 2, 3, 4]) {
    let s = withMessages(advanceTo(5, tired, seed));
    for (let night = 0; night < 4; night++) {
      const el = elOf(s);
      if (el) {
        const pick = el.choices[1]!.disabledReason ? 'kosong' : 'pinjam';
        s = applyChoice(data, s, el.id, pick);
        s = applyChoice(data, s, el.id, 'relief'); // a second answer is ignored
        expect(elOf(s)!.chosen).toBe(pick);
      }
      for (const m of s.messages) if (!m.chosen) s = applyChoice(data, s, m.id, m.choices[0]!.id);
      const plan = dayPlanFor(data, s);
      const all = Object.values(plan.roster).flat();
      expect(new Set(all).size).toBe(all.length);
      if (el) expect(all).not.toContain(el.staffId);
      s = withMessages(endDay(data, s, tired, plan));
      const ids = Object.values(s.roster).flat();
      expect(new Set(ids).size).toBe(ids.length);
    }
  }
});

test('a low-satisfaction day produces a complaint and a staffAway event for Kak Ida', () => {
  const s = withMessages(advanceTo(2, fakeReport({ patientSatisfaction: 34.9 })));
  const c = s.messages.find((m) => m.kind === 'complaint')!;
  expect(c).toMatchObject({ from: 'Unit Aduan', text: 'Aduan diterima: pesakit tunggu terlalu lama. Kak Ida perlu tulis laporan esok pagi.' });
  const after = applyChoice(data, s, c.id, 'ok');
  expect(after.tomorrow.events).toEqual([{ kind: 'staffAway', staffId: 'pt1', from: 540, to: 570 }]);
  expect(withMessages(advanceTo(2, fakeReport({ patientSatisfaction: 35 }))).messages.some((m) => m.kind === 'complaint')).toBe(false);
});

test('unlocks produce a district memo', () => {
  const s = withMessages(advanceTo(2, fakeReport({ peak: 31 })));
  expect(s.messages.find((m) => m.kind === 'memo')).toMatchObject({
    from: 'Pejabat Kesihatan Daerah', text: 'Memo: SOP Temujanji Berperingkat kini boleh digunakan.',
  });
});

test('the same state gives the same messages (seeded)', () => {
  const tired = fakeReport({ hcwSatisfaction: 20 });
  for (const day of [6, 7, 8, 12]) {
    const s = advanceTo(day, tired, 9);
    expect(nightMessages(data, s, s.history.at(-1)!)).toEqual(nightMessages(data, structuredClone(s), s.history.at(-1)!));
  }
});

test('allAnswered is false until every choice-message is answered', () => {
  let s = withMessages(advanceTo(5));
  expect(s.messages.length).toBeGreaterThan(0);
  expect(allAnswered(s)).toBe(false);
  for (const m of s.messages) s = applyChoice(data, s, m.id, m.choices.find((c) => !c.disabledReason)!.id);
  expect(allAnswered(s)).toBe(true);
  expect(allAnswered({ ...s, messages: [] })).toBe(true);
});
