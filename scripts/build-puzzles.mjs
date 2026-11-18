// Turns generator output (.jsonl) into src/data/puzzles.json: removes duplicates, estimates a rating for each puzzle, and shuffles with a fixed seed
// (the daily puzzle is then just "day number mod puzzle count"). Usage: node scripts/build-puzzles.mjs a.jsonl b.jsonl ...
//
// The rating is an ESTIMATE from engine data, not from rated players: how deep Stockfish must search before it sees the win, plus bonuses for
// quiet (non-capturing) first moves, longer mates, more pieces on the board and more legal moves to choose from.
import { Chess } from 'chess.js';
import fs from 'node:fs';

const rows = new Map();
for (const f of process.argv.slice(2)) for (const l of fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)) { const p = JSON.parse(l); rows.set(p.fen, p); }
const BASE = { 1: 750, 2: 900, 3: 1050, 4: 1200, 5: 1350, 6: 1500, 8: 1750, 10: 2000, 12: 2250 };
let seed = 20260101;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const rate = p => {
  const first = p.line[0];
  const pieces = p.fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
  const moves = new Chess(p.fen).moves().length;
  const quiet = !first.includes('x') && !/[+#]/.test(first);
  return clamp(Math.round(BASE[p.solve] + (quiet ? 250 : /[+#]/.test(first) && !first.includes('x') ? 100 : 0) + (p.mate ? 250 * (p.mate - 1) + 100 : 0)
    + clamp((pieces - 14) * 12, -80, 150) + clamp((moves - 28) * 4, -60, 100) + (rnd() - 0.5) * 120), 600, 2600);
};

// A "mate in N" whose stored line does not actually end in checkmate (the engine's line was cut short) is kept as a plain winning-move puzzle.
for (const p of rows.values()) {
  if (!p.mate) continue;
  const c = new Chess(p.fen);
  try { for (const m of p.sol) c.move(m); } catch { /* handled below */ }
  if (!c.isCheckmate()) { p.mate = 0; p.sol = p.sol.slice(0, 1); }
}

const out = [...rows.values()].slice(0, 365).map(p => ({
  fen: p.fen, side: p.side, sol: p.sol, line: p.line, mate: p.mate, r: rate(p),
  t: p.mate ? `Mate in ${p.mate}` : p.line[0].includes('x') ? 'Win material' : 'Winning tactic',
})).sort(() => rnd() - 0.5).map((p, i) => ({ id: i + 1, ...p }));
fs.writeFileSync(new URL('../src/data/puzzles.json', import.meta.url), JSON.stringify(out));
const rs = out.map(p => p.r).sort((a, b) => a - b), at = n => rs[Math.floor((rs.length - 1) * n)];
console.log(out.length, 'puzzles, estimated rating', rs[0], 'to', rs[rs.length - 1], '| quartiles', at(0.25), at(0.5), at(0.75));
