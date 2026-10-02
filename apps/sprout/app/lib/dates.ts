/** Local-calendar day helpers. Day keys are YYYY-MM-DD in the device's time zone. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = fromDayKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Whole days from `a` to `b` (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((fromDayKey(b).getTime() - fromDayKey(a).getTime()) / 86_400_000);
}

export function relativeDay(key: string, today = dayKey()): string {
  const n = diffDays(today, key);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return fromDayKey(key).toLocaleDateString('en-US', { weekday: 'long' });
  return fromDayKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function longDate(key: string): string {
  return fromDayKey(key).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
