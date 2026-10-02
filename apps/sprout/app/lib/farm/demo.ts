import * as Linking from 'expo-linking';

import { addDays, dayKey } from '../dates';
import type { Plant, PlantType, Streak } from '../plants';
import { PLANTS_KEY, STREAK_KEY } from '../store';
import { clearAll, setJSON } from './storage';

/**
 * Demo mode: launching with `?farmDemo=1` (web) or `<scheme>://?farmDemo=1` (iOS deep link)
 * wipes local data and seeds realistic sample content. Screenshots, the app preview video,
 * playtests and Maestro flows all start this way so they are deterministic.
 */
export function isDemoUrl(url: string | null | undefined): boolean {
  return !!url && /[?&]farmDemo=1\b/.test(url);
}

export async function maybeSeedDemo(): Promise<void> {
  const url = await Linking.getInitialURL();
  if (!isDemoUrl(url)) return;
  await clearAll();
  await seedDemoData();
}

/** `lastDaysAgo` = days since last watering; history follows the interval backwards. */
function plant(id: string, name: string, room: string, type: PlantType, intervalDays: number, lastDaysAgo: number): Plant {
  const today = dayKey();
  const waterings: string[] = [];
  for (let d = lastDaysAgo; d < 75 && waterings.length < 8; d += intervalDays) waterings.push(addDays(today, -d));
  return { id, name, room, type, intervalDays, createdAt: addDays(today, -80), waterings };
}

export async function seedDemoData(): Promise<void> {
  const plants: Plant[] = [
    plant('p1', 'Monstera Deliciosa', 'Living room', 'tropical', 7, 7),
    plant('p2', 'Boston Fern', 'Bathroom', 'fern', 4, 4),
    plant('p3', 'Fiddle Leaf Fig', 'Living room', 'tropical', 7, 7),
    plant('p4', 'Basil', 'Kitchen', 'herb', 3, 2),
    plant('p5', 'Golden Pothos', 'Office', 'tropical', 7, 3),
    plant('p6', 'Echeveria', 'Bedroom', 'succulent', 14, 9),
    plant('p7', 'Peace Lily', 'Bedroom', 'flowering', 5, 4),
    plant('p8', 'Bunny Ear Cactus', 'Balcony', 'cactus', 21, 6),
  ];
  const streak: Streak = { current: 12, best: 19, lastCompletedDay: addDays(dayKey(), -1) };
  await setJSON(PLANTS_KEY, plants);
  await setJSON(STREAK_KEY, streak);
}
