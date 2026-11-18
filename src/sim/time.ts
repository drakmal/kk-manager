/** Time is minutes since midnight. "08:00" -> 480. */
export function toMinute(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) throw new Error(`Bad time "${hhmm}", expected HH:MM`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 780 -> "13:00". */
export function fmt(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
