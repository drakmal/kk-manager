import type { GameData, StaffId, StationId } from '../sim/index';

type Roster = Record<StationId, StaffId[]>;

interface Props {
  data: GameData;
  roster: Roster;
  onChange(roster: Roster): void;
}

/** Puts `staffId` (or nobody) in seat `seat` of `station`. Anyone moved here leaves their old seat. */
export function assignSeat(roster: Roster, station: StationId, seat: number, staffId: StaffId | '', seats: number): Roster {
  const next: Roster = {};
  for (const [id, list] of Object.entries(roster)) {
    next[id] = staffId === '' || id === station ? [...list] : list.filter((s) => s !== staffId);
  }
  const row: string[] = [...(roster[station] ?? [])];
  while (row.length < seats) row.push('');
  if (staffId !== '') row.forEach((s, j) => { if (s === staffId && j !== seat) row[j] = ''; });
  row[seat] = staffId;
  next[station] = row.filter((s) => s !== '');
  return next;
}

export function RosterEditor({ data, roster, onChange }: Props) {
  const nameOf = new Map(data.staff.map((s) => [s.id, s.name]));
  return (
    <section class="card roster">
      <h2>Roster</h2>
      <table>
        <tbody>
          {data.stations.map((station) => {
            const row = roster[station.id] ?? [];
            const fits = data.staff.filter((s) => s.role === station.role);
            return (
              <tr key={station.id}>
                <th scope="row">{station.label}</th>
                <td>
                  {Array.from({ length: station.seats }, (_, i) => (
                    <select
                      key={i}
                      aria-label={`${station.label} seat ${i + 1}`}
                      value={row[i] ?? ''}
                      onChange={(e) =>
                        onChange(assignSeat(roster, station.id, i, (e.currentTarget as HTMLSelectElement).value, station.seats))
                      }
                    >
                      <option value="">(empty)</option>
                      {fits.map((s) => (
                        <option key={s.id} value={s.id}>
                          {nameOf.get(s.id)}
                        </option>
                      ))}
                    </select>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
