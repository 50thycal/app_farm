import { addDays, dayKey, diffDays } from './dates';

export type PlantType = 'tropical' | 'fern' | 'succulent' | 'cactus' | 'herb' | 'flowering' | 'custom';

export type Plant = {
  id: string;
  name: string;
  room: string;
  type: PlantType;
  intervalDays: number;
  createdAt: string; // day key
  waterings: string[]; // day keys, newest first
};

export type Streak = { current: number; best: number; lastCompletedDay: string | null };

export const ROOMS = ['Living room', 'Bedroom', 'Kitchen', 'Bathroom', 'Office', 'Balcony'] as const;

export const PLANT_TYPES: Record<PlantType, { label: string; interval: number; emoji: string; tint: string }> = {
  tropical: { label: 'Tropical', interval: 7, emoji: '🌿', tint: '#2F9E5B' },
  fern: { label: 'Fern', interval: 4, emoji: '🌱', tint: '#3BA55C' },
  succulent: { label: 'Succulent', interval: 14, emoji: '🪴', tint: '#7FA35B' },
  cactus: { label: 'Cactus', interval: 21, emoji: '🌵', tint: '#5E8C3A' },
  herb: { label: 'Herb', interval: 3, emoji: '🌿', tint: '#4CAF7A' },
  flowering: { label: 'Flowering', interval: 5, emoji: '🌸', tint: '#D9658F' },
  custom: { label: 'Other', interval: 7, emoji: '🍃', tint: '#6B8F71' },
};

export function lastWatered(p: Plant): string | null {
  return p.waterings[0] ?? null;
}

export function nextDue(p: Plant): string {
  return addDays(lastWatered(p) ?? p.createdAt, p.intervalDays);
}

/** Negative = overdue by N days, 0 = due today, positive = due in N days. */
export function daysUntilDue(p: Plant, today = dayKey()): number {
  return diffDays(today, nextDue(p));
}

export function isDue(p: Plant, today = dayKey()): boolean {
  return daysUntilDue(p, today) <= 0 && lastWatered(p) !== today;
}

export function dueLabel(p: Plant, today = dayKey()): string {
  if (lastWatered(p) === today) return 'Watered today';
  const n = daysUntilDue(p, today);
  if (n < -1) return `${-n} days overdue`;
  if (n === -1) return '1 day overdue';
  if (n === 0) return 'Due today';
  if (n === 1) return 'Due tomorrow';
  return `Due in ${n} days`;
}

export function sortByUrgency(plants: Plant[], today = dayKey()): Plant[] {
  return [...plants].sort((a, b) => daysUntilDue(a, today) - daysUntilDue(b, today) || a.name.localeCompare(b.name));
}

/** Streak broken if any plant has been overdue since before today. */
export function reconcileStreak(streak: Streak, plants: Plant[], today = dayKey()): Streak {
  const missed = plants.some((p) => daysUntilDue(p, today) <= -1 && lastWatered(p) !== today);
  if (missed && streak.lastCompletedDay !== today) return { ...streak, current: 0 };
  return streak;
}

/** Call after a watering: if nothing is left due today, today counts toward the streak. */
export function completeDayIfDone(streak: Streak, plants: Plant[], today = dayKey()): Streak {
  if (plants.some((p) => isDue(p, today))) return streak;
  if (streak.lastCompletedDay === today) return streak;
  const continues = streak.lastCompletedDay !== null && diffDays(streak.lastCompletedDay, today) >= 1 && streak.current > 0;
  const current = continues ? streak.current + 1 : 1;
  return { current, best: Math.max(streak.best, current), lastCompletedDay: today };
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
