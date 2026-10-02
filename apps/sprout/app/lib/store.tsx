import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { dayKey } from './dates';
import { getJSON, setJSON } from './farm/storage';
import { completeDayIfDone, newId, reconcileStreak, type Plant, type Streak } from './plants';

export const PLANTS_KEY = 'sprout.plants.v1';
export const STREAK_KEY = 'sprout.streak.v1';

type Store = {
  ready: boolean;
  plants: Plant[];
  streak: Streak;
  getPlant: (id: string) => Plant | undefined;
  savePlant: (p: Omit<Plant, 'id' | 'createdAt' | 'waterings'> & { id?: string }) => Promise<Plant>;
  deletePlant: (id: string) => Promise<void>;
  water: (id: string) => Promise<void>;
};

const Ctx = createContext<Store | null>(null);
const EMPTY_STREAK: Streak = { current: 0, best: 0, lastCompletedDay: null };

export function PlantsProvider({ children }: { children: ReactNode }) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [streak, setStreak] = useState<Streak>(EMPTY_STREAK);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await getJSON<Plant[]>(PLANTS_KEY, []);
      const s = reconcileStreak(await getJSON<Streak>(STREAK_KEY, EMPTY_STREAK), p);
      setPlants(p);
      setStreak(s);
      setReady(true);
    })();
  }, []);

  const persist = useCallback(async (next: Plant[], nextStreak?: Streak) => {
    setPlants(next);
    await setJSON(PLANTS_KEY, next);
    if (nextStreak) {
      setStreak(nextStreak);
      await setJSON(STREAK_KEY, nextStreak);
    }
  }, []);

  const value = useMemo<Store>(() => ({
    ready,
    plants,
    streak,
    getPlant: (id) => plants.find((p) => p.id === id),
    savePlant: async (input) => {
      const existing = input.id ? plants.find((p) => p.id === input.id) : undefined;
      const plant: Plant = existing
        ? { ...existing, name: input.name, room: input.room, type: input.type, intervalDays: input.intervalDays }
        : { id: newId(), createdAt: dayKey(), waterings: [], name: input.name, room: input.room, type: input.type, intervalDays: input.intervalDays };
      await persist(existing ? plants.map((p) => (p.id === plant.id ? plant : p)) : [...plants, plant]);
      return plant;
    },
    deletePlant: async (id) => {
      await persist(plants.filter((p) => p.id !== id));
    },
    water: async (id) => {
      const today = dayKey();
      const next = plants.map((p) => (p.id === id && p.waterings[0] !== today ? { ...p, waterings: [today, ...p.waterings] } : p));
      await persist(next, completeDayIfDone(streak, next, today));
    },
  }), [ready, plants, streak, persist]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlants(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePlants must be used inside PlantsProvider');
  return v;
}
