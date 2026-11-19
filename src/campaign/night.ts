import { createRng, type GameData, type StaffId, type StationId } from '../sim/index';
import { CAMPAIGN_DAYS, daySeed, NEW_DOCTOR, NEW_DOCTOR_DAY, RELIEF_COST, RELIEF_DOCTOR, RELIEF_LIMIT, staffFor } from './campaign';
import type { CampaignState, CardId, Choice, DaySummary, Message } from './types';

export const EL_BASE_CHANCE = 0.15;
export const EL_HCW_PIVOT = 70;
export const EL_MAX_CHANCE = 0.6;
export const COMPLAINT_BELOW = 35;
/** The night whose emergency leave is scripted (the night before day 5). */
const SCRIPTED_EL_DAY = 5;
const SCRIPTED_EL_STAFF = 'mo2';
const DOCTOR_STATIONS: StationId[] = ['mchDoctor', 'opdDoctor'];
const COMPLAINT_AWAY = { kind: 'staffAway' as const, staffId: 'pt1', from: 540, to: 570 };

export const CARD_NAMES: Record<CardId, string> = {
  saringan: 'Saringan di Kaunter',
  laluanKhas: 'Laluan Khas',
  pinjamDoktor: 'Pinjam Doktor OPD',
  temujanji: 'Temujanji Berperingkat',
  kontingensiCcms: 'Kontingensi CCMS',
  pasanganMentor: 'Pasangan Mentor',
};

const OK: Choice[] = [{ id: 'ok', label: 'Baik', disabledReason: null }];
const note = (id: string, kind: Message['kind'], from: string, text: string): Message =>
  ({ id, kind, from, text, choices: OK, chosen: null });

const stationOf = (state: CampaignState, id: StaffId): StationId | null =>
  DOCTOR_STATIONS.find((st) => state.roster[st]?.includes(id)) ?? null;

function reliefReason(state: CampaignState): string | null {
  if (state.goodwill < RELIEF_COST) return 'Not enough goodwill';
  if (state.reliefsThisWeek >= RELIEF_LIMIT) return 'Relief limit reached this week';
  return null;
}

/** The OPD doctor who would be borrowed, if any. */
function borrowable(state: CampaignState): StaffId | null {
  const away = new Set(state.tomorrow.away);
  const moved = new Set(state.tomorrow.moves.map((m) => m.staffId));
  return (state.roster.opdDoctor ?? []).find((id) => !away.has(id) && !moved.has(id)) ?? null;
}

function pinjamReason(state: CampaignState, doctor: StaffId): string | null {
  if (stationOf(state, doctor) === 'opdDoctor') return 'Doctor is from OPD';
  if (!borrowable(state)) return 'No OPD doctor free';
  return null;
}

function elChoices(state: CampaignState, doctor: StaffId): Choice[] {
  return [
    { id: 'relief', label: `Minta relief dari klinik lain (−${RELIEF_COST} goodwill)`, disabledReason: reliefReason(state) },
    { id: 'pinjam', label: 'Pinjam doktor OPD', disabledReason: pinjamReason(state, doctor) },
    { id: 'kosong', label: 'Biarkan kosong', disabledReason: null },
  ];
}

/** Which doctor (if any) texts in sick tonight. */
function leaveTonight(data: GameData, state: CampaignState, last: DaySummary | null): StaffId | null {
  const away = new Set(state.tomorrow.away);
  const rostered = DOCTOR_STATIONS.flatMap((st) => state.roster[st] ?? [])
    .filter((id) => !away.has(id) && staffFor(data, state).staff.some((p) => p.id === id && p.role === 'doctor'));
  if (state.day === SCRIPTED_EL_DAY) return rostered.includes(SCRIPTED_EL_STAFF) ? SCRIPTED_EL_STAFF : null;
  if (state.day < SCRIPTED_EL_DAY + 1 || rostered.length === 0) return null;
  const rng = createRng(daySeed(state));
  const hcw = last?.hcw ?? 100;
  const chance = Math.min(EL_MAX_CHANCE, EL_BASE_CHANCE + Math.max(0, EL_HCW_PIVOT - hcw) / 100);
  if (!rng.chance(chance)) return null;
  return rng.pick(rostered);
}

/** Tonight's phone messages. Same state → same messages. */
export function nightMessages(data: GameData, state: CampaignState, last: DaySummary | null): Message[] {
  const out: Message[] = [];
  const d = state.day;
  if (d === 1) {
    out.push(note('tutorial-1', 'tutorial', 'Kak Ida (PT)',
      'Selamat datang, Clinic Manager! Esok hari pertama. Tengok siapa yang menunggu paling lama di KIA.'));
  }
  if (d === NEW_DOCTOR_DAY && state.trainees.some((t) => t.staffId === NEW_DOCTOR.id)) {
    out.push(note(`newDoctor-${d}`, 'newDoctor', 'Pejabat Kesihatan Daerah',
      `${NEW_DOCTOR.name} akan melapor diri esok. Sila tetapkan mentor.`));
  }
  for (const card of state.justUnlocked) {
    out.push(note(`memo-${card}`, 'memo', 'Pejabat Kesihatan Daerah', `Memo: SOP ${CARD_NAMES[card]} kini boleh digunakan.`));
  }
  if (last && last.patient < COMPLAINT_BELOW) {
    out.push(note(`complaint-${d}`, 'complaint', 'Unit Aduan',
      'Aduan diterima: pesakit tunggu terlalu lama. Kak Ida perlu tulis laporan esok pagi.'));
  }
  if (d === 6 && state.mode === 'campaign' && d <= CAMPAIGN_DAYS) {
    out.push(note(`forecast-${d}`, 'forecast', 'Cikgu Rahman (sekolah asrama)',
      'Esok kami bawa pelajar untuk saringan kesihatan, lebih kurang 25 orang 🚌'));
  }
  const doctor = leaveTonight(data, state, last);
  if (doctor) {
    const name = staffFor(data, state).staff.find((p) => p.id === doctor)!.name;
    out.push({ id: `el-${d}-${doctor}`, kind: 'el', from: name, text: 'Dr, saya demam, esok nak EL 🙏',
      choices: elChoices(state, doctor), chosen: null, staffId: doctor });
  }
  return out;
}

/** Answers one message. A disabled or repeated answer changes nothing. */
export function applyChoice(_data: GameData, stateIn: CampaignState, messageId: string, choiceId: string): CampaignState {
  const msg = stateIn.messages.find((m) => m.id === messageId);
  if (!msg || msg.chosen !== null || !msg.choices.some((c) => c.id === choiceId)) return stateIn;
  const s = structuredClone(stateIn);
  const t = s.tomorrow;

  if (msg.kind === 'el' && msg.staffId) {
    const doctor = msg.staffId;
    const station = stationOf(s, doctor);
    const reason = choiceId === 'relief' ? reliefReason(s) : choiceId === 'pinjam' ? pinjamReason(s, doctor) : null;
    if (reason || !station) return stateIn;
    if (choiceId === 'relief') {
      t.relief = { staffId: RELIEF_DOCTOR.id, station };
      s.goodwill -= RELIEF_COST;
      s.reliefsThisWeek += 1;
    }
    if (choiceId === 'pinjam') t.moves.push({ staffId: borrowable(s)!, from: 'opdDoctor', to: station });
    if (!t.away.includes(doctor)) t.away.push(doctor);
  }
  if (msg.kind === 'complaint') t.events.push({ ...COMPLAINT_AWAY });

  s.messages = s.messages.map((m) => (m.id === messageId ? { ...m, chosen: choiceId } : m));
  return s;
}

export const allAnswered = (state: CampaignState): boolean =>
  state.messages.every((m) => m.choices.length === 0 || m.chosen !== null);
