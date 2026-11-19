import { dayName } from '../week/week';

interface Props {
  /** The day a saved Easy week will resume on, or null for no save. */
  savedDay: number | null;
  saveAvailable: boolean;
  onStart(): void;
  onContinue(): void;
  onStartOver(): void;
}

const LOCKED = [
  { name: 'Medium', type: 'KK Jenis 3', issues: 'Isu sederhana', blurb: '300–500 pesakit sehari. Lebih banyak masalah.' },
  { name: 'Hard', type: 'KK Jenis 1', issues: 'Semua isu', blurb: 'Lebih 800 pesakit sehari. Semua boleh jadi.' },
];

export function DifficultyScreen({ savedDay, saveAvailable, onStart, onContinue, onStartOver }: Props) {
  return (
    <div class="screen difficulty-screen">
      <header class="screen-head">
        <h1>KK Manager</h1>
        <p class="lede">Pilih klinik anda</p>
        <p class="hint">You are the Clinic Manager. Keep patients moving and get the doctors to lunch at 1 pm.</p>
      </header>
      <div class="boxes">
        <section class="box easy" aria-label="Easy">
          <h2>Easy</h2>
          <p class="type">KK Jenis 4</p>
          <p class="issues">Isu minimum</p>
          <p class="hint">150–300 pesakit sehari. Satu minggu, Isnin hingga Jumaat.</p>
          {savedDay === null ? (
            <button type="button" class="primary" onClick={onStart}>Start</button>
          ) : (
            <div class="actions">
              <button type="button" class="primary" onClick={onContinue}>Continue ({dayName(savedDay)})</button>
              <button type="button" onClick={onStartOver}>Start over</button>
            </div>
          )}
        </section>
        {LOCKED.map((b) => (
          <section key={b.name} class="box locked" aria-label={b.name}>
            <h2>{b.name}</h2>
            <p class="type">{b.type}</p>
            <p class="issues">{b.issues}</p>
            <p class="hint">{b.blurb}</p>
            <button type="button" disabled>Coming soon</button>
          </section>
        ))}
      </div>
      {!saveAvailable && <p class="notice" role="status">Progress can’t be saved in this browser.</p>}
    </div>
  );
}
