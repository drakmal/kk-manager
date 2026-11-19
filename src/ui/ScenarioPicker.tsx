import { SCENARIOS } from '../game/scenarios';

interface Props {
  value: string;
  onChange(id: string): void;
}

export function ScenarioPicker({ value, onChange }: Props) {
  return (
    <fieldset class="card scenarios">
      <legend>Today</legend>
      {SCENARIOS.map((s) => (
        <label key={s.id} class={s.id === value ? 'chosen' : undefined}>
          <input type="radio" name="scenario" value={s.id} checked={s.id === value} onChange={() => onChange(s.id)} />
          <strong>{s.label}</strong>
          <span class="hint">{s.blurb}</span>
        </label>
      ))}
    </fieldset>
  );
}
