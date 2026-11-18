import { useSyncExternalStore } from 'react';

export type Settings = {
  theme: 'midnight' | 'charcoal' | 'aurora' | 'light'; accent: 'indigo' | 'cyan' | 'green' | 'amber' | 'rose'; board: 'green' | 'brown' | 'blue'; pieces: string; sounds: string; coords: boolean; scale: number;
  sound: boolean; volume: number;
  side: 'opening' | 'w' | 'b'; hints: boolean;
  engineLevel: string; think: number;
};
export const DEFAULTS: Settings = { theme: 'midnight', accent: 'indigo', board: 'green', pieces: 'cburnett', sounds: 'sfx', coords: true, scale: 100, sound: true, volume: 0.6, side: 'opening', hints: true, engineLevel: 'Intermediate', think: 1 };

// Light preferences live in localStorage; openings and progress live in IndexedDB.
const KEY = 'chess-academy-settings';
let cur: Settings = (() => {
  try {
    const s = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
    if ((s.theme as string) === 'dark') s.theme = 'midnight'; // value saved by older versions
    return s as Settings;
  } catch { return DEFAULTS; }
})();
const subs = new Set<() => void>();

export const getSettings = () => cur;

export function apply() {
  const r = document.documentElement;
  r.dataset.theme = cur.theme;
  r.dataset.accent = cur.accent;
  r.style.setProperty('--scale', String(cur.scale / 100));
}

export function saveSettings(p: Partial<Settings>) {
  if ((p.theme as string) === 'dark') p = { ...p, theme: 'midnight' };
  cur = { ...cur, ...p };
  try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch { /* storage unavailable */ }
  apply();
  subs.forEach(f => f());
}

export function useSettings() {
  return useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, getSettings);
}
