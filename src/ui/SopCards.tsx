import type { GameData, PriorityGroup, SopSettings } from '../sim/index';

interface Props {
  data: GameData;
  sop: SopSettings;
  onChange(sop: SopSettings): void;
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

export function SopCards({ data, sop, onChange }: Props) {
  const set = (patch: Partial<SopSettings>) => onChange({ ...sop, ...patch });
  const skippable = data.visitTypes.filter((v) => v.steps.some((s) => s.bypassable));

  return (
    <section class="sop-cards">
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
    </section>
  );
}
