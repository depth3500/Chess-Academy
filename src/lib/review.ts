import { Chess } from 'chess.js';
import type { Line } from './engine';

// Game review: turns engine evaluations into move classes and accuracy scores.
// Win chances and the accuracy formula are the open lichess.org formulas; the move classes use expected-points loss
// (how much win probability a move gave away), the same idea chess.com explains for its own classes. The numbers are
// close to, but not identical with, chess.com's: they depend on the engine, its depth, and chess.com's private tuning.

export type MoveClass = 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'miss' | 'blunder';
export const CLASS_ORDER: MoveClass[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];
export const CLASS_INFO: Record<MoveClass, { label: string; color: string; icon: string }> = {
  brilliant: { label: 'Brilliant', color: '#1fb5a8', icon: '!!' }, great: { label: 'Great', color: '#5b9bd5', icon: '!' },
  best: { label: 'Best', color: '#8bc34a', icon: '★' }, excellent: { label: 'Excellent', color: '#9ccc65', icon: '✓' },
  good: { label: 'Good', color: '#b0b88a', icon: '·' }, book: { label: 'Book', color: '#a98467', icon: '≡' },
  inaccuracy: { label: 'Inaccuracy', color: '#f2c14e', icon: '?!' }, mistake: { label: 'Mistake', color: '#f08a3c', icon: '?' },
  miss: { label: 'Miss', color: '#ef6f6c', icon: '✕' }, blunder: { label: 'Blunder', color: '#e53935', icon: '??' },
};

export type PosEval = { cp: number; mate: number; lines: Line[] }; // from the side to move; cp already includes mates
export type MoveReview = { san: string; uci: string; color: 'w' | 'b'; cls: MoveClass; loss: number; acc: number; best?: string; bestUci?: string; line: string[]; opening?: string };
export type Review = {
  moves: MoveReview[]; wcp: number[]; wmate: number[]; acc: { w: number; b: number };
  counts: Record<'w' | 'b', Partial<Record<MoveClass, number>>>; opening?: string; depth: number;
};

export const lineCp = (l: Line) => (l.mate ? Math.sign(l.mate) * (10000 - Math.abs(l.mate) * 10) : l.cp);
/** Win chance (0-100) for a centipawn score. */
export const winPct = (cp: number) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-1000, Math.min(1000, cp)))) - 1);
/** Accuracy (0-100) of one move from the win chance before and after it. */
export const moveAccuracy = (before: number, after: number) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * (before - after)) - 3.1669));

const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const material = (c: Chess, color: 'w' | 'b') => c.board().flat().reduce((s, p) => s + (p ? (p.color === color ? 1 : -1) * VAL[p.type] : 0), 0);
/** Material change for the mover after the engine's next few plies (negative = a piece was given up). */
function materialShift(fen: string, san: string, pv: string[], color: 'w' | 'b') {
  const c = new Chess(fen);
  const b0 = material(c, color);
  c.move(san);
  for (const u of pv.slice(0, Math.min(4, pv.length) & ~1)) { try { c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { break; } }
  return material(c, color) - b0;
}

const sd = (a: number[]) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
/** Game accuracy: the mean of a volatility-weighted mean and a harmonic mean of the move accuracies (the lichess method). */
export function gameAccuracy(idx: number[], accs: number[], wps: number[], plies: number) {
  if (!idx.length) return 0;
  const w = Math.max(2, Math.min(8, Math.floor(plies / 10)));
  const wt = idx.map(i => Math.max(0.5, Math.min(12, sd(wps.slice(Math.max(0, i - w), Math.min(wps.length, i + w + 1))))));
  const weighted = accs.reduce((s, a, k) => s + a * wt[k], 0) / wt.reduce((s, x) => s + x, 0);
  const harmonic = accs.length / accs.reduce((s, a) => s + 1 / Math.max(a, 1), 0);
  return (weighted + harmonic) / 2;
}

/**
 * sans/fens: the game and its positions (fens has one more entry). evals: one engine evaluation per position.
 * book(ply) returns an opening name while the first `ply` moves are still opening theory.
 */
export function buildReview(sans: string[], fens: string[], evals: PosEval[], book: (ply: number) => string | undefined, depth: number): Review {
  const sign = (i: number) => (fens[i].split(' ')[1] === 'w' ? 1 : -1);
  const wcp = evals.map((e, i) => sign(i) * e.cp);
  const wmate = evals.map((e, i) => sign(i) * e.mate);
  const wps = wcp.map(winPct);
  const moves: MoveReview[] = [];
  const idx: Record<'w' | 'b', number[]> = { w: [], b: [] };
  const accs: Record<'w' | 'b', number[]> = { w: [], b: [] };
  const counts: Review['counts'] = { w: {}, b: {} };
  let opening: string | undefined;
  let prevLoss = 0;
  let prevTo = '';

  sans.forEach((san, i) => {
    const before = new Chess(fens[i]);
    const color = before.turn();
    const mv = before.move(san);
    const uci = mv.from + mv.to + (mv.promotion ?? '');
    const ev = evals[i], nx = evals[i + 1];
    const bestUci = ev.lines[0]?.pv[0];
    const isBest = bestUci === uci;
    const wpBest = winPct(ev.cp), wpAfter = winPct(-nx.cp);
    const drop = isBest ? 0 : Math.max(0, wpBest - wpAfter);
    const loss = drop / 100; // expected points given away
    const gap = ev.lines[1] ? wpBest - winPct(lineCp(ev.lines[1])) : 0;
    const bookName = book(i + 1);
    let cls: MoveClass;
    if (bookName) { cls = 'book'; opening = bookName; }
    else if (isBest || loss <= 0.005) cls = 'best';
    else if (loss <= 0.02) cls = 'excellent';
    else if (loss <= 0.05) cls = 'good';
    else if (loss <= 0.1) cls = 'inaccuracy';
    else if (loss <= 0.2) cls = 'mistake';
    else cls = 'blunder';

    if (cls === 'best' || cls === 'excellent') {
      const shift = materialShift(fens[i], san, nx.lines[0]?.pv ?? [], color);
      if (loss <= 0.02 && wpBest < 90 && wpAfter >= 45 && shift <= -2.5) cls = 'brilliant'; // a sound sacrifice
      else if (cls === 'best' && gap >= 18 && wpBest < 95 && !(mv.captured && mv.to === prevTo)) cls = 'great'; // the only good move (not a plain recapture)
    }
    if ((cls === 'inaccuracy' || cls === 'mistake') && prevLoss >= 0.1 && wpBest >= 60) cls = 'miss'; // did not punish the opponent's error

    const acc = cls === 'book' || isBest ? 100 : moveAccuracy(wpBest, wpAfter);
    const line = (ev.lines[0]?.pv ?? []).slice(0, 6);
    let best: string | undefined;
    if (bestUci) { try { best = new Chess(fens[i]).move({ from: bestUci.slice(0, 2), to: bestUci.slice(2, 4), promotion: bestUci[4] }).san; } catch { /* stale line */ } }
    moves.push({ san, uci, color, cls, loss, acc, best, bestUci, line: sanLine(fens[i], line), opening: bookName });
    counts[color][cls] = (counts[color][cls] ?? 0) + 1;
    idx[color].push(i); accs[color].push(acc);
    prevLoss = loss; prevTo = mv.to;
  });

  return {
    moves, wcp, wmate, depth, opening, counts,
    acc: { w: gameAccuracy(idx.w, accs.w, wps, sans.length), b: gameAccuracy(idx.b, accs.b, wps, sans.length) },
  };
}

function sanLine(fen: string, uci: string[]) {
  const c = new Chess(fen), out: string[] = [];
  for (const u of uci) { try { out.push(c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san); } catch { break; } }
  return out;
}

/** "+1.3", "-0.4" or "M3" for white's point of view. */
export function evalText(wcp: number, wmate: number) {
  if (wmate) return `${wmate > 0 ? '' : '-'}M${Math.abs(wmate)}`;
  if (Math.abs(wcp) >= 9000) return wcp > 0 ? '1-0' : '0-1';
  return `${wcp > 0 ? '+' : ''}${(wcp / 100).toFixed(1)}`;
}

type Fam = { n: string; l: [string, string][] };
/** Opening-book lookup from the catalog: returns the opening name while the moves are still known theory. */
export function makeBook(catalog: Fam[]) {
  const prefixes = new Set<string>(), names = new Map<string, string>();
  for (const f of catalog) {
    for (const [v, line] of f.l) {
      const s = line.split(' ');
      for (let k = 1; k <= s.length; k++) prefixes.add(s.slice(0, k).join(' '));
      if (!names.has(line)) names.set(line, v ? `${f.n}: ${v}` : f.n);
    }
  }
  return (sans: string[], ply: number) => {
    if (ply < 1 || !prefixes.has(sans.slice(0, ply).join(' '))) return undefined;
    for (let k = ply; k >= 1; k--) { const n = names.get(sans.slice(0, k).join(' ')); if (n) return n; }
    return 'Opening theory';
  };
}
