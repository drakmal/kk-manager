import { dayName } from '../campaign/campaign';
import type { CampaignController } from '../campaign/controller';
import { allAnswered } from '../campaign/night';
import { NOT_SAVED } from './TitleScreen';
import { useController } from './useController';

interface Props {
  campaign: CampaignController;
  onExport?(): void;
}

export function NightScreen({ campaign, onExport }: Props) {
  const c = useController(campaign);
  const { state } = c;

  return (
    <div class="screen night-screen">
      <header class="screen-head">
        <h1>Malam · esok {dayName(state.day)}, Hari {state.day}</h1>
        <p class="hint">Your phone buzzes after dinner. Sort tomorrow out before you sleep.</p>
        <p class="goodwill">Goodwill: {state.goodwill}</p>
      </header>

      <ul class="phone" aria-label="Messages">
        {state.messages.map((m) => {
          const chosen = m.choices.find((x) => x.id === m.chosen);
          return (
            <li key={m.id} class={`msg msg-${m.kind}`}>
              <strong class="from">{m.from}</strong>
              <p>{m.text}</p>
              {chosen ? (
                <p class="chosen">✓ {chosen.label}</p>
              ) : (
                <div class="choices">
                  {m.choices.map((x) => (
                    <span key={x.id} class="choice">
                      <button type="button" disabled={x.disabledReason !== null} onClick={() => c.choose(m.id, x.id)}>{x.label}</button>
                      {x.disabledReason && <small class="hint">{x.disabledReason}</small>}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
        {state.messages.length === 0 && <li class="msg"><p class="hint">No messages tonight. Tidur awal.</p></li>}
      </ul>

      <footer class="screen-foot">
        {!c.saveAvailable && (
          <>
            <p class="notice" role="status">{NOT_SAVED}</p>
            {onExport && <button type="button" onClick={onExport}>Export save</button>}
          </>
        )}
        <button type="button" class="primary" disabled={!allAnswered(state)} onClick={() => c.toPlan()}>Go to morning</button>
      </footer>
    </div>
  );
}
