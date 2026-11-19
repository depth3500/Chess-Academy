import { Chess } from 'chess.js';
import { replay } from './tree';

export type Lv = { skill: number; depth: number; ms: number };
/** One engine line: `cp` or `mate` (moves to mate) from the side to move, and the principal variation in UCI. */
export type Line = { cp: number; mate: number; pv: string[] };

// Difficulty is real engine configuration: Stockfish "Skill Level" plus a depth and time cap per move.
export const LEVELS: Record<string, Lv> = {
  Beginner: { skill: 0, depth: 1, ms: 100 },
  Easy: { skill: 5, depth: 4, ms: 250 },
  Intermediate: { skill: 10, depth: 8, ms: 500 },
  Advanced: { skill: 15, depth: 12, ms: 1000 },
  Expert: { skill: 20, depth: 18, ms: 2000 },
};
export const ANALYSIS: Lv = { skill: 20, depth: 12, ms: 1500 };

/** Stockfish 19 (lite, single-threaded WASM) in a Web Worker. Files are served from public/stockfish. */
export class Engine {
  private w = new Worker(`${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`);
  private q: Promise<unknown> = Promise.resolve();
  private fail: ((e: Error) => void) | null = null;

  constructor() {
    this.w.onerror = () => this.fail?.(new Error('Stockfish failed to start'));
    this.w.postMessage('uci');
  }

  /** Searches the position after `moves` (UCI). `cp` is centipawns for the side to move. Searches run one at a time. */
  search(moves: string[], lv: Lv, fen?: string) {
    const run = () => new Promise<{ move: string; cp: number }>((res, rej) => {
      this.fail = rej;
      let cp = 0;
      const on = (e: MessageEvent) => {
        const m = String(e.data);
        const s = m.match(/score (cp|mate) (-?\d+)/);
        if (s) cp = s[1] === 'cp' ? +s[2] : Math.sign(+s[2]) * 10000;
        if (m.startsWith('bestmove')) { this.w.removeEventListener('message', on); res({ move: m.split(' ')[1], cp }); }
      };
      this.w.addEventListener('message', on);
      this.w.postMessage(`setoption name Skill Level value ${lv.skill}`);
      this.w.postMessage(`position ${fen ? 'fen ' + fen : 'startpos'} moves ${moves.join(' ')}`);
      this.w.postMessage(`go depth ${lv.depth} movetime ${lv.ms}`);
    });
    const p = this.q.then(run);
    this.q = p.catch(() => {});
    return p;
  }
  /** Top `mpv` lines for a position at full strength (used by the game reviewer). */
  analyse(fen: string, depth: number, mpv: number, ms: number) {
    const run = () => new Promise<Line[]>((res, rej) => {
      this.fail = rej;
      const lines: Line[] = [];
      const on = (e: MessageEvent) => {
        const m = String(e.data);
        const r = m.match(/^info depth \d+ .*?multipv (\d+) score (cp|mate) (-?\d+).* pv (.+)$/);
        if (r) lines[+r[1] - 1] = { cp: r[2] === 'cp' ? +r[3] : 0, mate: r[2] === 'mate' ? +r[3] : 0, pv: r[4].split(' ') };
        if (m.startsWith('bestmove')) { this.w.removeEventListener('message', on); res(lines.filter(Boolean)); }
      };
      this.w.addEventListener('message', on);
      this.w.postMessage('setoption name Skill Level value 20');
      this.w.postMessage(`setoption name MultiPV value ${mpv}`);
      this.w.postMessage(`position fen ${fen}`);
      this.w.postMessage(`go depth ${depth} movetime ${ms}`);
    });
    const p = this.q.then(run);
    this.q = p.catch(() => {});
    return p;
  }
  cancel() { this.w.postMessage('stop'); }
  kill() { this.w.terminate(); }
}

export function toUci(sans: string[], fen?: string) {
  const c = new Chess(fen);
  return sans.map(s => { const m = c.move(s); return m.from + m.to + (m.promotion ?? ''); });
}

export function fromUci(path: string[], u: string, fen?: string) {
  return replay(path, fen).move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san;
}
