// Generates "find the winning move" puzzles with Stockfish from engine-assisted self-play.
// Usage (from the project folder, after `npm install`): node scripts/gen-puzzles.mjs out.jsonl <seed> <minutes>
// Difficulty is estimated from how deep the engine must search before it settles on the winning move.
import { Chess } from 'chess.js';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [out = 'puzzles.jsonl', seedArg = '1', minutes = '10'] = process.argv.slice(2);
let seed = +seedArg;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-'));
const dir = new URL('../public/stockfish/', import.meta.url).pathname;
fs.copyFileSync(dir + 'stockfish-19-lite-single.js', tmp + '/stockfish-19-lite-single.cjs'); // .cjs so Node does not treat it as ESM
fs.copyFileSync(dir + 'stockfish-19-lite-single.wasm', tmp + '/stockfish-19-lite-single.wasm');
const sf = spawn('node', [tmp + '/stockfish-19-lite-single.cjs']);
let buf = '', handler = null;
sf.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { handler?.(buf.slice(0, i).trim()); buf = buf.slice(i + 1); } });
const send = c => sf.stdin.write(c + '\n');
const ask = (cmds, until) => new Promise(res => { const got = []; handler = l => { got.push(l); if (l.startsWith(until)) { handler = null; res(got); } }; cmds.forEach(send); });

/** Returns the top `mpv` lines at `depth`: cp from the side to move (mates become +-(10000 - 10n)) and the pv in UCI. */
async function search(fen, depth, mpv = 1) {
  const got = await ask([`setoption name MultiPV value ${mpv}`, `position fen ${fen}`, `go depth ${depth}`], 'bestmove');
  const r = [];
  for (const l of got) {
    const m = l.match(/^info depth \d+ .*?multipv (\d+) score (cp|mate) (-?\d+).* pv (.+)$/);
    if (m) r[+m[1] - 1] = { cp: m[2] === 'cp' ? +m[3] : Math.sign(+m[3]) * (10000 - Math.abs(+m[3]) * 10), pv: m[4].split(' ') };
  }
  return r.filter(Boolean);
}

const cat = JSON.parse(fs.readFileSync(new URL('../src/data/catalog.json', import.meta.url)));
function startPos() {
  const f = cat[Math.floor(rnd() * cat.length)];
  const l = f.l[Math.floor(rnd() * f.l.length)][1].split(' ');
  const c = new Chess();
  for (const s of l.slice(0, Math.min(l.length, 6 + Math.floor(rnd() * 8)))) c.move(s);
  return c;
}
const mv = (c, u) => c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });

const DS = [1, 2, 3, 4, 5, 6, 8, 10, 12];
const bandOf = d => (d <= 2 ? 'a' : d <= 4 ? 'b' : d <= 6 ? 'c' : d <= 8 ? 'd' : 'e');
const CAP = { a: 60, b: 90, c: 90, d: 70, e: 60 }; // roughly even coverage from easy to hard
const have = { a: 0, b: 0, c: 0, d: 0, e: 0 };
const MIN_SOLVE = +(process.env.MIN_SOLVE ?? 1); // e.g. MIN_SOLVE=3 skips the easy puzzles that are already plentiful

/** Difficulty: the shallowest depth from which the engine both plays the best move and already sees that it wins. */
async function solveDepth(fen, best, bestCp) {
  const res = [];
  for (const d of DS) res.push((await search(fen, d, 1))[0]);
  let solve = null;
  for (let i = DS.length - 1; i >= 0; i--) {
    if (!(res[i].pv[0] === best && (res[i].cp > 9000 || res[i].cp >= 0.5 * bestCp))) break;
    solve = DS[i];
  }
  return solve;
}

async function tryPuzzle(fen) {
  const hardWanted = have.d < CAP.d || have.e < CAP.e;
  let q = await search(fen, 6, 2);
  if (!(q.length >= 2 && q[0].cp >= 200 && q[0].cp - q[1].cp >= 150)) {
    if (!hardWanted) return null;
    q = await search(fen, 10, 2); // tactics that are only visible deeper
    if (!(q.length >= 2 && q[0].cp >= 250 && q[0].cp - q[1].cp >= 200)) return null;
  }
  if (MIN_SOLVE > 2) { // cheap early exit: if a depth-2 search already finds the move and sees the win, the puzzle is too easy
    const d2 = (await search(fen, 2, 1))[0];
    if (d2.pv[0] === q[0].pv[0] && d2.cp >= 0.5 * q[0].cp) return null;
  }
  const f = await search(fen, 12, 2);
  if (f.length < 2) return null;
  const [b, s] = f, mate = b.cp > 9000;
  if (!(mate ? b.cp - s.cp > 500 : b.cp >= 300 && b.cp - s.cp >= 250)) return null; // a clearly best, hard-to-find move
  const solve = await solveDepth(fen, b.pv[0], b.cp);
  if (!solve || solve < MIN_SOLVE || have[bandOf(solve)] >= CAP[bandOf(solve)]) return null;
  const g = new Chess(fen), line = [];
  for (const u of b.pv.slice(0, mate ? 8 : 4)) { try { line.push(mv(g, u).san); } catch { break; } }
  const n = mate ? (10000 - b.cp) / 10 : 0;
  have[bandOf(solve)]++;
  return { fen, side: new Chess(fen).turn(), sol: mate ? line.slice(0, 2 * n - 1) : line.slice(0, 1), line, mate: n, solve, cp: mate ? 0 : b.cp };
}

if (process.argv[5]) { // re-score puzzles from an earlier run: node scripts/gen-puzzles.mjs out.jsonl 1 0 in.jsonl
  for (const l of fs.readFileSync(process.argv[5], 'utf8').split('\n').filter(Boolean)) {
    const p = JSON.parse(l);
    const r = (await search(p.fen, 12, 1))[0];
    const solve = await solveDepth(p.fen, r.pv[0], r.cp > 9000 ? 10000 : r.cp);
    if (solve) { have[bandOf(solve)]++; fs.appendFileSync(out, JSON.stringify({ ...p, solve }) + '\n'); }
  }
  console.log('rescored', out); sf.kill(); process.exit(0);
}
const end = Date.now() + +minutes * 60000, seen = new Set();
let found = 0;
while (Date.now() < end) {
  const c = startPos();
  let prev = 0, inGame = 0; // prev: how the player who just moved rated their own position before moving
  for (let ply = c.history().length; ply < 100 && !c.isGameOver() && Date.now() < end && inGame < 2; ply++) {
    const fen = c.fen(), k = fen.split(' ').slice(0, 4).join(' ');
    // only positions where the opponent's last move was a mistake (we were not already winning), at most two per game
    if (ply >= 12 && !seen.has(k) && prev >= -100) {
      seen.add(k);
      const p = await tryPuzzle(fen);
      if (p && (p.mate || p.cp <= 1200)) { fs.appendFileSync(out, JSON.stringify(p) + '\n'); found++; inGame++; }
    }
    const r = await search(fen, 2, 4); // plausible but imperfect play: any move within 1.5 pawns of the best
    if (!r.length) break;
    prev = r[0].cp;
    const pool = r.filter(x => x.cp >= r[0].cp - 150);
    mv(c, pool[Math.floor(rnd() * pool.length)].pv[0]);
  }
}
console.log(out, 'done,', found, 'puzzles');
sf.kill();
