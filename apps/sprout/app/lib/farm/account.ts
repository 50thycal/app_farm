import { router } from 'expo-router';

import { clearAll } from './storage';

/**
 * Guideline 5.1.1(v): apps that support account creation must let users delete the account in-app.
 * FARM: if the app has a backend, call its delete endpoint here before clearing local state.
 */
export async function deleteAccount(): Promise<void> {
  await clearAll();
  router.replace('/');
}
