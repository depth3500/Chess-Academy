import { Chess } from 'chess.js';
import { Engine } from './engine';
import { PosEval, lineCp } from './review';

type Opts = { depth: number; ms: number; workers?: number; onProgress?: (done: number, total: number) => void; signal?: { cancelled: boolean } };

/** Evaluates every position with a small pool of Stockfish workers running in parallel (top two lines each). */
export async function analyseFens(fens: string[], o: Opts): Promise<PosEval[]> {
  const out: PosEval[] = new Array(fens.length);
  const cache = new Map<string, PosEval>();
  const todo = fens.map((_, i) => i);
  let done = 0;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  const n = Math.max(1, Math.min(o.workers ?? Math.min(4, cores - 1), fens.length));
  const engines = Array.from({ length: n }, () => new Engine());

  const terminal = (f: string): PosEval | null => {
    const c = new Chess(f);
    if (c.isCheckmate()) return { cp: -10000, mate: 0, lines: [] }; // the side to move has been mated
    return c.isGameOver() ? { cp: 0, mate: 0, lines: [] } : null;
  };
  const work = async (e: Engine) => {
    for (;;) {
      const i = todo.shift();
      if (i === undefined || o.signal?.cancelled) return;
      const key = fens[i].split(' ').slice(0, 4).join(' ');
      let r = terminal(fens[i]) ?? cache.get(key);
      if (!r) {
        const lines = await e.analyse(fens[i], o.depth, 2, o.ms);
        r = { cp: lines[0] ? lineCp(lines[0]) : 0, mate: lines[0]?.mate ?? 0, lines };
        cache.set(key, r);
      }
      out[i] = r;
      o.onProgress?.(++done, fens.length);
    }
  };
  try { await Promise.all(engines.map(work)); } finally { engines.forEach(e => e.kill()); }
  return out;
}
