import { useMemo, useState } from 'preact/hooks';
import { loadGameData, type GameData } from '../sim/index';
import { resumeWeek, startWeek, type WeekController } from '../week/controller';
import { clearWeek, loadWeek } from '../week/saves';
import { browserStorage, type SaveStorage } from '../week/storage';
import { dayName, WEEK_DAYS } from '../week/week';
import { DistrictScreen } from './DistrictScreen';
import { GameScreen } from './GameScreen';
import { PopupDialog } from './PopupDialog';
import { ReportScreen } from './ReportScreen';
import { DifficultyScreen } from './DifficultyScreen';
import { useController } from './useController';

interface Props {
  data?: GameData;
  storage?: SaveStorage;
  /** Timestamp for saves. */
  now?: () => string;
  /** Seed for a new week. */
  seed?: () => number;
}

function Week({ week }: { week: WeekController }) {
  const w = useController(week);
  const today = w.state.day;
  return (
    <>
      {w.phase === 'morning' && w.morning && (
        <div class="morning-screen">
          <p class="morning-title">{dayName(today)}, 07:00 · sebelum klinik dibuka</p>
          <PopupDialog popup={w.morning} onAnswer={(id) => w.answerMorning(id)} />
        </div>
      )}
      {w.phase === 'day' && w.day && <GameScreen controller={w.day} data={w.data} dayName={dayName(today)} />}
      {w.phase === 'report' && w.day && (
        <ReportScreen
          controller={w.day} data={w.data} dayLabel={dayName(today)}
          continueLabel={today < WEEK_DAYS ? `Continue to ${dayName(today + 1)}` : 'Continue'}
          onContinue={() => w.continueAfterReport()}
        />
      )}
      {w.phase === 'district' && <DistrictScreen week={w} />}
    </>
  );
}

export function App(props: Props) {
  const data = useMemo(() => props.data ?? loadGameData(), [props.data]);
  const storage = useMemo(() => props.storage ?? browserStorage(), [props.storage]);
  const now = props.now ?? (() => new Date().toISOString());
  const newSeed = () => (props.seed ? props.seed() : 1 + Math.floor(Math.random() * 999_999));
  const [week, setWeek] = useState<WeekController | null>(null);

  const saved = week ? null : loadWeek(storage);
  return (
    <div class="app">
      {week && <div class="brand" aria-hidden="true">KK Manager</div>}
      {!week && (
        <DifficultyScreen
          savedDay={saved?.state.day ?? null}
          saveAvailable={storage.available}
          onStart={() => setWeek(startWeek(data, storage, newSeed(), now))}
          onContinue={() => saved && setWeek(resumeWeek(data, storage, saved, now))}
          onStartOver={() => {
            clearWeek(storage);
            setWeek(startWeek(data, storage, newSeed(), now));
          }}
        />
      )}
      {week && <Week week={week} />}
    </div>
  );
}
