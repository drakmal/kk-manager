import { CARD_NAMES } from '../campaign/night';
import type { CardId, Trainee } from '../campaign/types';
import type { GameData, PriorityGroup, SopSettings, StaffId } from '../sim/index';

export interface MentorCard {
  on: boolean;
  trainees: Trainee[];
  /** Display names of the trainees. */
  names: Record<StaffId, string>;
  /** Per trainee: the doctors in their room who could mentor them. */
  doctors: Record<StaffId, { id: StaffId; name: string }[]>;
  onChange(on: boolean, trainees: Trainee[]): void;
}

interface Props {
  data: GameData;
  sop: SopSettings;
  onChange(sop: SopSettings): void;
  /** Campaign only: cards not in this list are shown locked. Free play leaves it out. */
  unlocked?: CardId[];
  /** Campaign only: the Pasangan Mentor card, once unlocked. */
  mentor?: MentorCard;
}

function Locked({ card }: { card: CardId }) {
  return (
    <fieldset class="card locked">
      <legend>🔒 {CARD_NAMES[card]} (locked)</legend>
      <p class="hint">Unlocks as the campaign goes on.</p>
    </fieldset>
  );
}

function Mentor({ mentor }: { mentor: MentorCard }) {
  const setMentor = (staffId: StaffId, id: string) =>
    mentor.onChange(mentor.on, mentor.trainees.map((t) => (t.staffId === staffId ? { ...t, mentor: id === '' ? null : id } : t)));
  return (
    <fieldset class="card">
      <legend>{CARD_NAMES.pasanganMentor}</legend>
      <p class="hint">Pair each new doctor with a senior in the same room. They learn faster, but the senior slows down answering questions.</p>
      <label>
        <input type="checkbox" checked={mentor.on} onChange={(e) => mentor.onChange(checked(e), mentor.trainees)} />
        Use Pasangan Mentor
      </label>
      {mentor.trainees.map((t) => {
        const name = mentor.names[t.staffId] ?? t.staffId;
        return (
          <label key={t.staffId}>
            Mentor for {name}
            <select aria-label={`Mentor for ${name}`} value={t.mentor ?? ''} onChange={(e) => setMentor(t.staffId, value(e))}>
              <option value="">No mentor</option>
              {(mentor.doctors[t.staffId] ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
        );
      })}
    </fieldset>
  );
}

const GROUPS: [PriorityGroup, string][] = [
  ['pregnant', 'Pregnant women'],
  ['elderly', 'Elderly'],
  ['oku', 'OKU'],
  ['childUnder2', 'Children aged 2 and under'],
];

const toggle = <T,>(list: T[], item: T, on: boolean) => (on ? [...list.filter((x) => x !== item), item] : list.filter((x) => x !== item));
const clampInt = (v: string, lo: number, hi: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
const checked = (e: Event) => (e.currentTarget as HTMLInputElement).checked;
const value = (e: Event) => (e.currentTarget as HTMLInputElement | HTMLSelectElement).value;

export function SopCards({ data, sop, onChange, unlocked, mentor }: Props) {
  const set = (patch: Partial<SopSettings>) => onChange({ ...sop, ...patch });
  const open = (card: CardId) => !unlocked || unlocked.includes(card);
  const skippable = data.visitTypes.filter((v) => v.steps.some((s) => s.bypassable));

  return (
    <section class="sop-cards">
      {open('saringan') ? (
        <fieldset class="card">
          <legend>Saringan di Kaunter</legend>
          <p class="hint">At registration, send these visits straight from triage to the doctor.</p>
          {skippable.map((v) => (
            <label key={v.id}>
              <input
                type="checkbox"
                checked={sop.saringan.bypass[v.id] === true}
                onChange={(e) => set({ saringan: { bypass: { ...sop.saringan.bypass, [v.id]: checked(e) } } })}
              />
              Straight to doctor: {v.label}
            </label>
          ))}
        </fieldset>
      ) : <Locked card="saringan" />}

      {open('laluanKhas') ? (
        <fieldset class="card">
          <legend>Laluan Khas</legend>
          <label>
            <input type="checkbox" checked={sop.laluanKhas.enabled} onChange={(e) => set({ laluanKhas: { ...sop.laluanKhas, enabled: checked(e) } })} />
            Use Laluan Khas
          </label>
          <div class="group">
            {GROUPS.map(([g, label]) => (
              <label key={g}>
                <input
                  type="checkbox"
                  checked={sop.laluanKhas.groups.includes(g)}
                  onChange={(e) => set({ laluanKhas: { ...sop.laluanKhas, groups: toggle(sop.laluanKhas.groups, g, checked(e)) } })}
                />
                {label}
              </label>
            ))}
          </div>
          <details>
            <summary>Where priority applies</summary>
            {data.stations.map((s) => (
              <label key={s.id}>
                <input
                  type="checkbox"
                  checked={sop.laluanKhas.stations.includes(s.id)}
                  onChange={(e) => set({ laluanKhas: { ...sop.laluanKhas, stations: toggle(sop.laluanKhas.stations, s.id, checked(e)) } })}
                />
                {s.label}
              </label>
            ))}
          </details>
        </fieldset>
      ) : <Locked card="laluanKhas" />}

      {open('pinjamDoktor') ? (
        <fieldset class="card">
          <legend>Pinjam Doktor OPD</legend>
          <label>
            <input type="checkbox" checked={sop.pinjamDoktor.enabled} onChange={(e) => set({ pinjamDoktor: { ...sop.pinjamDoktor, enabled: checked(e) } })} />
            Use Pinjam Doktor OPD
          </label>
          <label>
            Queue threshold
            <input
              type="number" min={1} max={20} aria-label="Queue threshold" value={sop.pinjamDoktor.queueThreshold}
              onChange={(e) => set({ pinjamDoktor: { ...sop.pinjamDoktor, queueThreshold: clampInt(value(e), 1, 20, sop.pinjamDoktor.queueThreshold) } })}
            />
          </label>
          <label>
            Doctors to borrow
            <select
              aria-label="Doctors to borrow" value={String(sop.pinjamDoktor.maxDoctors)}
              onChange={(e) => set({ pinjamDoktor: { ...sop.pinjamDoktor, maxDoctors: Number(value(e)) } })}
            >
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </label>
        </fieldset>
      ) : <Locked card="pinjamDoktor" />}

      {open('temujanji') ? (
        <fieldset class="card">
          <legend>Temujanji Berperingkat</legend>
          <label>
            <input type="checkbox" checked={sop.temujanji.enabled} onChange={(e) => set({ temujanji: { ...sop.temujanji, enabled: checked(e) } })} />
            Use Temujanji Berperingkat
          </label>
          <label>
            Slot length
            <select
              aria-label="Slot length" value={String(sop.temujanji.slotMinutes)}
              onChange={(e) => set({ temujanji: { ...sop.temujanji, slotMinutes: Number(value(e)) } })}
            >
              <option value="15">15 min</option>
              <option value="30">30 min</option>
            </select>
          </label>
          <label>
            Patients per slot
            <input
              type="number" min={1} max={12} aria-label="Patients per slot" value={sop.temujanji.perSlot}
              onChange={(e) => set({ temujanji: { ...sop.temujanji, perSlot: clampInt(value(e), 1, 12, sop.temujanji.perSlot) } })}
            />
          </label>
        </fieldset>
      ) : <Locked card="temujanji" />}

      {open('kontingensiCcms') ? (
        <fieldset class="card">
          <legend>Pelan Kontingensi CCMS</legend>
          <label>
            <input
              type="checkbox" checked={sop.kontingensiCcms.printedList}
              onChange={(e) => set({ kontingensiCcms: { printedList: checked(e) } })}
            />
            Print tomorrow’s appointment list
          </label>
        </fieldset>
      ) : <Locked card="kontingensiCcms" />}
      {mentor && <Mentor mentor={mentor} />}
    </section>
  );
}
