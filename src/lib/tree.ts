import { Chess } from 'chess.js';

/** A repertoire is a tree of moves: each node holds one SAN move and its continuations. */
export type N = { san: string; kids: N[]; note?: string; name?: string };
export type Opening = { id: string; name: string; eco: string; side: 'w' | 'b'; tree: N[]; fen?: string; tmp?: boolean };

export const uid = () => Math.random().toString(36).slice(2, 10);
export const allLines = (t: N[], pre: string[] = []): string[][] => t.flatMap(n => (n.kids.length ? allLines(n.kids, [...pre, n.san]) : [[...pre, n.san]]));
export const lines = (t: N[]): number => t.reduce((a, n) => a + (n.kids.length ? lines(n.kids) : 1), 0);

/** Position identity ignores move counters, so transpositions compare equal. */
export const key = (c: Chess) => c.fen().split(' ').slice(0, 4).join(' ');

/** Plies already played before the start position (0 for the standard start), so labels and turns stay right for any FEN. */
export const startPly = (fen?: string) => { if (!fen) return 0; const f = fen.split(' '); return ((parseInt(f[5]) || 1) - 1) * 2 + (f[1] === 'b' ? 1 : 0); };
export const colorAt = (i: number, fen?: string): 'w' | 'b' => ((startPly(fen) + i) % 2 ? 'b' : 'w');
export const plyLabel = (i: number, fen?: string) => { const p = startPly(fen) + i; return `${Math.floor(p / 2) + 1}${p % 2 ? '…' : '.'}`; };
export const validFen = (fen: string) => { try { new Chess(fen); return true; } catch { return false; } };

export function replay(sans: string[], fen?: string): Chess {
  const c = new Chess(fen);
  sans.forEach(s => c.move(s));
  return c;
}

export function isLegal(sans: string[], fen?: string) {
  try { replay(sans, fen); return true; } catch { return false; }
}

/** Adds a line to the tree. `name` (e.g. "Giuoco Piano: Classical Variation") is kept on the last move of the line. */
export function addLine(tree: N[], sans: string[], name?: string) {
  let lvl = tree;
  let n: N | undefined;
  for (const s of sans) {
    n = lvl.find(k => k.san === s);
    if (!n) { n = { san: s, kids: [] }; lvl.push(n); }
    lvl = n.kids;
  }
  if (name && n && !n.name) n.name = name;
}

export function kidsAt(tree: N[], path: string[]): N[] {
  let lvl = tree;
  for (const s of path) {
    const n = lvl.find(k => k.san === s);
    if (!n) return [];
    lvl = n.kids;
  }
  return lvl;
}

export function findNode(tree: N[], path: string[]): N | undefined {
  let lvl = tree;
  let n: N | undefined;
  for (const s of path) {
    n = lvl.find(k => k.san === s);
    if (!n) return undefined;
    lvl = n.kids;
  }
  return n;
}

export function removeAt(tree: N[], path: string[]) {
  const parent = kidsAt(tree, path.slice(0, -1));
  const i = parent.findIndex(k => k.san === path[path.length - 1]);
  if (i >= 0) parent.splice(i, 1);
}

/** Finds the repertoire reply that leads to the same position as the attempted move. */
export function matchKid(tree: N[], path: string[], mv: { from: string; to: string; promotion?: string }, fen?: string): N | undefined {
  const c = replay(path, fen);
  try { c.move(mv); } catch { return undefined; }
  const target = key(c);
  return kidsAt(tree, path).find(k => { const d = replay(path, fen); d.move(k.san); return key(d) === target; });
}

/** Accepts full PGN (with headers, including a FEN start) or plain SAN. Throws on illegal moves. */
export function parseGame(text: string, fen?: string): { sans: string[]; fen?: string } {
  if (!fen || /\[FEN/i.test(text)) {
    try {
      const c = new Chess(fen);
      c.loadPgn(text);
      const h = c.history();
      if (h.length) return { sans: h, fen: c.header().FEN ?? fen };
    } catch { /* fall through to plain SAN */ }
  }
  const c = new Chess(fen);
  text
    .replace(/\{[^}]*\}|\([^)]*\)|\d+\.(\.\.)?|1\/2-1\/2|[01]-[01]|\*/g, ' ')
    .split(/\s+/).filter(Boolean)
    .forEach(s => c.move(s));
  return { sans: c.history(), fen };
}
export const parseMoves = (text: string) => parseGame(text).sans;

/** Parses PGN movetext (several games, variations in parentheses, {comments}) into one repertoire tree. Comments become move notes. */
export function parseTree(text: string, fen?: string): { tree: N[]; fen?: string } {
  type S = { lvl: N[]; fen: string; before?: { lvl: N[]; fen: string }; last?: N };
  const start = text.match(/\[FEN\s+"([^"]+)"\]/i)?.[1] ?? fen;
  const body = text.replace(/^\s*\[[^\]]*\]\s*$/gm, ' * '); // each header line also marks the start of a game
  const tree: N[] = [];
  const root = (): S => ({ lvl: tree, fen: new Chess(start).fen() });
  let s = root();
  const stack: S[] = [];
  for (const [tok] of body.matchAll(/\{[^}]*\}|;[^\n]*|\$\d+|[()]|\d+\.(?:\.\.)?|1-0|0-1|1\/2-1\/2|\*|[^\s(){}]+/g)) {
    if (tok[0] === '{') {
      const t = tok.slice(1, -1).trim();
      if (s.last && t) s.last.note = s.last.note ? s.last.note + ' ' + t : t;
    } else if (tok[0] === ';' || tok[0] === '$' || /^\d+\.(\.\.)?$/.test(tok)) {
      continue;
    } else if (tok === '(') {
      if (!s.before) throw new Error('a variation must follow a move');
      stack.push(s);
      s = { lvl: s.before.lvl, fen: s.before.fen };
    } else if (tok === ')') {
      s = stack.pop() ?? s;
    } else if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) {
      if (!stack.length) s = root();
    } else {
      const c = new Chess(s.fen);
      const m = c.move(tok.replace(/[!?]+$/, ''));
      let n = s.lvl.find(k => k.san === m.san);
      if (!n) { n = { san: m.san, kids: [] }; s.lvl.push(n); }
      s = { lvl: n.kids, fen: c.fen(), before: { lvl: s.lvl, fen: s.fen }, last: n };
    }
  }
  return { tree, fen: start };
}
