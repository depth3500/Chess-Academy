import data from '../data/puzzles.json';

export type Puzzle = { id: number; fen: string; side: 'w' | 'b'; sol: string[]; line: string[]; mate: number; r: number; t: string };
export const PUZZLES = data as Puzzle[];

/** Whole days since 1970 for the local calendar date, so the puzzle changes at local midnight. */
export const dayNumber = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
/** The puzzles are stored in a fixed shuffled order, so the daily puzzle is simply the day number modulo the count. */
export const dailyPuzzle = (d = new Date()) => PUZZLES[dayNumber(d) % PUZZLES.length];

export const RANGES: [string, string, (r: number) => boolean][] = [
  ['any', 'Any difficulty', () => true], ['easy', 'Easy (under 1000)', r => r < 1000], ['medium', 'Medium (1000-1400)', r => r >= 1000 && r < 1400],
  ['hard', 'Hard (1400-1800)', r => r >= 1400 && r < 1800], ['expert', 'Expert (1800+)', r => r >= 1800],
];
export function randomPuzzle(range: string, not?: number) {
  const ok = RANGES.find(x => x[0] === range)?.[2] ?? (() => true);
  const pool = PUZZLES.filter(p => ok(p.r) && p.id !== not);
  return (pool.length ? pool : PUZZLES)[Math.floor(Math.random() * (pool.length || PUZZLES.length))];
}
