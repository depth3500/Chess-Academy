import { Chess, Move } from 'chess.js';
import { replay } from './tree';

export const NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const CENTRE = ['d4', 'e4', 'd5', 'e5'];

/** The strategic idea behind a move, worded so it can double as a hint (it never names the move). */
export function idea(m: Move): string {
  if (m.san.startsWith('O-O')) return 'Castle: put the king in safety and bring a rook toward the centre.';
  if (m.captured) return 'Win or trade material by capturing.';
  if (m.piece === 'p' && CENTRE.includes(m.to)) return 'Claim space in the centre with a pawn.';
  if (m.piece === 'p') return 'Gain space or prepare to support your pieces with a pawn move.';
  if ((m.piece === 'n' || m.piece === 'b') && m.from[1] === (m.color === 'w' ? '1' : '8')) return 'Develop a minor piece toward the centre.';
  if (m.piece === 'q') return 'Bring the queen out to pressure key squares.';
  if (m.piece === 'r') return 'Activate a rook.';
  return 'Improve the placement of a piece.';
}

/** The last move of `path`, as a chess.js Move. */
export const moveAt = (path: string[], fen?: string): Move => replay(path.slice(0, -1), fen).move(path[path.length - 1]);

/** Explains the last move of `path`, using only facts read from the actual position. */
export function explain(path: string[], fen?: string): string[] {
  const m = moveAt(path, fen);
  const who = m.color === 'w' ? 'White' : 'Black';
  const out = [idea(m)];
  out.push(`${who} moves the ${NAME[m.piece]} from ${m.from} to ${m.to}${m.captured ? `, capturing a ${NAME[m.captured]}` : ''}${/[+#]/.test(m.san) ? ', giving check' : ''}.`);
  try {
    // Give the move back to the mover to see what the piece can now reach and attack.
    const f = m.after.split(' ');
    f[1] = m.color; f[3] = '-';
    const mv = new Chess(f.join(' ')).moves({ square: m.to, verbose: true });
    if (m.piece !== 'p' && m.piece !== 'k' && mv.length) out.push(`From ${m.to} it can now reach ${mv.slice(0, 5).map(x => x.to).join(', ')}${mv.length > 5 ? ' and more' : ''}.`);
    const hit = mv.filter(x => x.captured).map(x => `${NAME[x.captured!]} on ${x.to}`);
    if (hit.length) out.push(`It attacks the ${hit.join(' and ')}.`);
  } catch { /* position could not be flipped (e.g. the opponent is in check); skip the attack notes */ }
  const home = m.color === 'w' ? '1' : '8';
  const off = new Chess(m.after).board().flat().filter(p => p && p.color === m.color && (p.type === 'n' || p.type === 'b') && p.square[1] !== home).length;
  out.push(`${who} has ${off} of 4 minor pieces off the back rank.`);
  return out;
}
