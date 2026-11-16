// Spaced repetition: an SM-2 style scheduler, one card per move you play in an opening.
export type Cfg = { ease: number; first: number; max: number };
export const DEFAULT_CFG: Cfg = { ease: 2.5, first: 1, max: 365 };
export type Card = { opening: string; label: string; reps: number; ease: number; interval: number; due: number; lapses: number; seen: number; last: number };
export type Grade = 'again' | 'hard' | 'good';
export const DAY = 86400000;
export const MASTERY = ['New', 'Learning', 'Developing', 'Familiar', 'Mastered'];

export const newCard = (opening: string, label: string, cfg: Cfg): Card => ({ opening, label, reps: 0, ease: cfg.ease, interval: 0, due: 0, lapses: 0, seen: 0, last: 0 });
export const isDue = (c: Card, now: number) => c.seen > 0 && c.due <= now;

/** 1 New, 2 Learning (under 3 days), 3 Developing (under 10), 4 Familiar (under 30), 5 Mastered. */
export const level = (c: Card) => (c.seen === 0 ? 1 : c.reps === 0 || c.interval < 3 ? 2 : c.interval < 10 ? 3 : c.interval < 30 ? 4 : 5);

/** Wrong attempts beat everything; a hint makes a correct answer "hard". */
export const grade = (wrong: number, hint: boolean): Grade => (wrong > 0 ? 'again' : hint ? 'hard' : 'good');

export function review(c: Card, g: Grade, now: number, cfg: Cfg): Card {
  const n = { ...c, seen: c.seen + 1, last: now };
  if (g === 'again') { n.lapses++; n.reps = 0; n.interval = 0; n.ease = Math.max(1.3, c.ease - 0.2); n.due = now; return n; }
  n.reps = c.reps + 1;
  if (g === 'hard') { n.ease = Math.max(1.3, c.ease - 0.15); n.interval = Math.max(1, Math.round(c.interval * 1.2)); }
  else { n.ease = c.ease + 0.05; n.interval = c.reps === 0 ? cfg.first : c.reps === 1 ? 6 : Math.round(c.interval * n.ease); }
  n.interval = Math.min(cfg.max, n.interval);
  n.due = now + n.interval * DAY;
  return n;
}

export function dueByOpening(cards: Record<string, Card>, now: number) {
  const out: Record<string, number> = {};
  for (const c of Object.values(cards)) if (isDue(c, now)) out[c.opening] = (out[c.opening] ?? 0) + 1;
  return out;
}

export const dayKey = (t: number) => new Date(t).toDateString();

/** Consecutive days with activity, ending today (or yesterday, so the streak survives until tonight). */
export function streak(times: number[], now: number) {
  const days = new Set(times.map(dayKey));
  const d = new Date(now);
  if (!days.has(dayKey(+d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(+d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
