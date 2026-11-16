import { useSyncExternalStore } from 'react';

export type Settings = {
  theme: 'dark' | 'light'; board: 'green' | 'brown' | 'blue'; pieces: 'classic' | 'glyph'; coords: boolean; scale: number;
  sound: boolean; volume: number;
  side: 'opening' | 'w' | 'b'; hints: boolean;
  engineLevel: string; think: number;
};
export const DEFAULTS: Settings = { theme: 'dark', board: 'green', pieces: 'classic', coords: true, scale: 100, sound: true, volume: 0.6, side: 'opening', hints: true, engineLevel: 'Intermediate', think: 1 };

// Light preferences live in localStorage; openings and progress live in IndexedDB.
const KEY = 'chess-academy-settings';
let cur: Settings = (() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return DEFAULTS; } })();
const subs = new Set<() => void>();

export const getSettings = () => cur;

export function apply() {
  const r = document.documentElement;
  r.dataset.theme = cur.theme;
  r.style.setProperty('--scale', String(cur.scale / 100));
}

export function saveSettings(p: Partial<Settings>) {
  cur = { ...cur, ...p };
  try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch { /* storage unavailable */ }
  apply();
  subs.forEach(f => f());
}

export function useSettings() {
  return useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, getSettings);
}
