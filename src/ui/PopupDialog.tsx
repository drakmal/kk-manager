import { useEffect, useRef } from 'preact/hooks';
import type { Popup } from '../popups/popups';

interface Props {
  popup: Popup;
  onAnswer(choiceId: string): void;
}

/** A problem that stops the clock until the Clinic Manager picks an option. There is no close button: a choice must be made. */
export function PopupDialog({ popup, onAnswer }: Props) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), [popup.id]);
  const labelId = `popup-from-${popup.id.replace(/[^a-z0-9]/gi, '-')}`;

  return (
    <div class="popup-backdrop">
      <div class="popup" role="dialog" aria-modal="true" aria-labelledby={labelId}>
        <strong id={labelId} class="from">{popup.from}</strong>
        <p class="text">{popup.text}</p>
        <div class="choices">
          {popup.choices.map((c, i) => (
            <button key={c.id} type="button" ref={i === 0 ? first : undefined} class={i === 0 ? 'primary' : undefined} onClick={() => onAnswer(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
