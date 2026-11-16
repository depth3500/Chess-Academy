import { get, set } from 'idb-keyval';
import { useEffect, useState } from 'react';
import { Card, Cfg, DEFAULT_CFG, grade, newCard, review } from './srs';

export type Session = {
  opening: string; name: string; side: 'w' | 'b'; at: number;
  tries: number; ok: number; hints: number; seconds: number; missed: string[];
};

/** State that loads from IndexedDB on mount and saves automatically on every change. */
export function usePersisted<T>(k: string, init: () => T) {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => { get(k).then(x => setV(x ?? init())); }, []);
  useEffect(() => { if (v !== null) set(k, v); }, [v]);
  return [v, setV] as const;
}

export async function logLesson(s: { opening: string; name: string; at: number; ok: number; total: number }) {
  const all = (await get('lessons')) ?? [];
  await set('lessons', [...all, s]);
}

export async function logSession(s: Session) {
  const all: Session[] = (await get('sessions')) ?? [];
  await set('sessions', [...all, s]);
}

export type Lesson = { opening: string; name: string; at: number; ok: number; total: number };
export type Entry = { key: string; opening: string; label: string; wrong: number; hint: boolean };

export const getCfg = async (): Promise<Cfg> => ({ ...DEFAULT_CFG, ...((await get('srs')) ?? {}) });
export const saveCfg = (c: Cfg) => set('srs', c);

/** Updates the review schedule for every move played in a practice session. */
export async function applyReviews(entries: Entry[]) {
  const cfg = await getCfg();
  const cards: Record<string, Card> = (await get('cards')) ?? {};
  const now = Date.now();
  for (const e of entries) cards[e.key] = review(cards[e.key] ?? newCard(e.opening, e.label, cfg), grade(e.wrong, e.hint), now, cfg);
  await set('cards', cards);
}

export function useData() {
  const [d, setD] = useState<{ sessions: Session[]; lessons: Lesson[]; cards: Record<string, Card> } | null>(null);
  useEffect(() => {
    Promise.all([get('sessions'), get('lessons'), get('cards')]).then(([s, l, c]) => setD({ sessions: s ?? [], lessons: l ?? [], cards: c ?? {} }));
  }, []);
  return d;
}
