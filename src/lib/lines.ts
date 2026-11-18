import type { Card } from './srs';
import { level } from './srs';
import { N, Opening, allLines, colorAt, findNode } from './tree';

export type LineInfo = { i: number; sans: string[]; name: string; status: 'new' | 'learning' | 'learned'; due: boolean };

/** The name of a line: the name on the deepest named move along it, or "Line N". */
export function lineName(tree: N[], sans: string[], i: number) {
  let name = '';
  for (let k = 1; k <= sans.length; k++) name = findNode(tree, sans.slice(0, k))?.name ?? name;
  return name || `Line ${i + 1}`;
}

/** Every line of an opening with its status. A line is "learned" once every move you play in it has been answered correctly at least twice. */
export function lineInfo(o: Opening, cards: Record<string, Card>, now = Date.now()): LineInfo[] {
  return allLines(o.tree).map((sans, i) => {
    const mine = sans.map((_, k) => k).filter(k => colorAt(k, o.fen) === o.side);
    const cs = mine.map(k => cards[`${o.id}:${sans.slice(0, k + 1).join(' ')}`]);
    const seen = cs.filter(c => c && c.seen > 0);
    const status = !seen.length ? 'new' : cs.every(c => c && level(c) >= 3) ? 'learned' : 'learning';
    return { i, sans, name: lineName(o.tree, sans, i), status, due: seen.some(c => c.due <= now) };
  });
}

export const progress = (infos: LineInfo[]) => ({ learned: infos.filter(l => l.status === 'learned').length, total: infos.length });
