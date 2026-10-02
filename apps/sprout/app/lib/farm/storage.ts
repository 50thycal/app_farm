import AsyncStorage from '@react-native-async-storage/async-storage';

/** Small typed JSON wrapper over AsyncStorage. Works on iOS and on the web build used for playtests. */
export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function clearAll(): Promise<void> {
  await AsyncStorage.clear();
}
