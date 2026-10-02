import * as Linking from 'expo-linking';

import { clearAll } from './storage';

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

/** FARM: the build stage fills this with believable, polished sample data (no lorem ipsum). */
export async function seedDemoData(): Promise<void> {}
