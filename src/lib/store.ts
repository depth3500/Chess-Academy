import { get, set } from 'idb-keyval';
import { useEffect, useRef, useState } from 'react';
import { scheduleSync } from './cloud';
import { Card, Cfg, DEFAULT_CFG, grade, newCard, review } from './srs';

export type Session = {
  opening: string; name: string; side: 'w' | 'b'; at: number;
  tries: number; ok: number; hints: number; seconds: number; missed: string[];
};

/** Remembers when a data type last changed on this device (used by cloud sync) and schedules a sync. */
export async function touch(k: string) {
  const meta: Record<string, number> = (await get('meta')) ?? {};
  meta[k] = Date.now();
  await set('meta', meta);
  scheduleSync();
}

/**
 * State that loads from IndexedDB and saves automatically when you change it. Starter data (`init`) is kept in memory
 * and only stored after your first edit, so a fresh device never overwrites what is saved in your online account.
 */
export function usePersisted<T>(k: string, init: () => T) {
  const [v, setV] = useState<T | null>(null);
  const last = useRef('');
  useEffect(() => {
    const load = () => get(k).then(x => { const val = x ?? init(); last.current = JSON.stringify(val); setV(val); });
    void load();
    const on = (e: Event) => { if ((e as CustomEvent<string[]>).detail.includes(k)) void load(); };
    window.addEventListener('cloud-pulled', on);
    return () => window.removeEventListener('cloud-pulled', on);
  }, []);
  useEffect(() => {
    if (v === null) return;
    const j = JSON.stringify(v);
    if (j === last.current) return; // just loaded or pulled, not edited
    last.current = j;
    void set(k, v).then(() => touch(k));
  }, [v]);
  return [v, setV] as const;
}

export async function logLesson(s: Lesson) {
  const all: Lesson[] = (await get('lessons')) ?? [];
  await set('lessons', [...all, s]);
  await touch('lessons');
}

export async function logSession(s: Session) {
  const all: Session[] = (await get('sessions')) ?? [];
  await set('sessions', [...all, s]);
  await touch('sessions');
}

export type PuzzleLog = { at: number; opening: string; ok: boolean; daily: boolean }; // `opening` holds the puzzle id so the shared merge code can be reused
export async function logPuzzle(p: PuzzleLog) {
  const all: PuzzleLog[] = (await get('puzzles')) ?? [];
  await set('puzzles', [...all, p]);
  await touch('puzzles');
}
export type Lesson = { opening: string; name: string; at: number; ok: number; total: number };
export type Entry = { key: string; opening: string; label: string; wrong: number; hint: boolean };

export const getCfg = async (): Promise<Cfg> => ({ ...DEFAULT_CFG, ...((await get('srs')) ?? {}) });
export const saveCfg = async (c: Cfg) => { await set('srs', c); await touch('srs'); };

/** Updates the review schedule for every move played in a practice session. */
export async function applyReviews(entries: Entry[]) {
  const cfg = await getCfg();
  const cards: Record<string, Card> = (await get('cards')) ?? {};
  const now = Date.now();
  for (const e of entries) cards[e.key] = review(cards[e.key] ?? newCard(e.opening, e.label, cfg), grade(e.wrong, e.hint), now, cfg);
  await set('cards', cards);
  await touch('cards');
}

export function useData() {
  const [d, setD] = useState<{ sessions: Session[]; lessons: Lesson[]; cards: Record<string, Card>; puzzles: PuzzleLog[] } | null>(null);
  useEffect(() => {
    Promise.all([get('sessions'), get('lessons'), get('cards'), get('puzzles')]).then(([s, l, c, p]) => setD({ sessions: s ?? [], lessons: l ?? [], cards: c ?? {}, puzzles: p ?? [] }));
  }, []);
  return d;
}
