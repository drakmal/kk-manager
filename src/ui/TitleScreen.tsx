import { useState } from 'preact/hooks';
import { dayName } from '../campaign/campaign';
import { SLOTS, type Slot } from '../campaign/saves';

interface Props {
  slots: { slot: Slot; day: number; mode: string; savedAt: string }[];
  saveAvailable: boolean;
  onNew(slot: Slot): void;
  onContinue(slot: Slot): void;
  onFreePlay(): void;
  onImport(text: string): { ok: true } | { error: string };
  onExport(slot: Slot): void;
}

export const NOT_SAVED = 'Progress can’t be saved in this browser. Use Export to keep your game.';

export function TitleScreen({ slots, saveAvailable, onNew, onContinue, onFreePlay, onImport, onExport }: Props) {
  const [importError, setImportError] = useState<string | null>(null);

  const readFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setImportError('That file could not be read.');
      return;
    }
    const result = onImport(text);
    setImportError('error' in result ? result.error : null);
    input.value = '';
  };

  return (
    <div class="screen title-screen">
      <header class="screen-head">
        <h1>KK Manager</h1>
        <p class="hint">Two weeks as Clinic Manager of a klinik kesihatan. Get the mothers to the doctor, and the doctors to lunch.</p>
      </header>

      <section class="card slots" aria-label="Saved games">
        <h2>Dua Minggu di KK</h2>
        {SLOTS.map((slot) => {
          const s = slots.find((x) => x.slot === slot);
          return (
            <div key={slot} class="slot">
              <span>
                {s ? `Slot ${slot} · Hari ${s.day} (${dayName(s.day)})` : `Slot ${slot} · Empty`}
                {s?.mode === 'endless' && <em class="hint"> endless mode</em>}
              </span>
              {s ? (
                <>
                  <button type="button" class="primary" aria-label={`Continue slot ${slot}`} onClick={() => onContinue(slot)}>Continue</button>
                  <button type="button" aria-label={`Export slot ${slot}`} onClick={() => onExport(slot)}>Export</button>
                </>
              ) : (
                <button type="button" class="primary" aria-label={`New campaign in slot ${slot}`} onClick={() => onNew(slot)}>New campaign</button>
              )}
            </div>
          );
        })}
        {!saveAvailable && <p class="notice" role="status">{NOT_SAVED}</p>}
        <label class="import">
          Import save
          <input type="file" accept=".json,application/json" aria-label="Import save" onChange={readFile} />
        </label>
        {importError && <p class="notice" role="alert">{importError}</p>}
      </section>

      <section class="card">
        <h2>Free play</h2>
        <p class="hint">One day at a time, any day type, every SOP card open. Nothing is saved.</p>
        <button type="button" onClick={onFreePlay}>Free play</button>
      </section>
    </div>
  );
}
