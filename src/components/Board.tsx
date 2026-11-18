import { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import type { ComponentProps, CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import { useSettings } from '../lib/settings';
import { play } from '../lib/sound';
import { replay } from '../lib/tree';

// Highlights use an inset shadow and a background image so the square's own colour always stays visible.
const LAST: CSSProperties = { boxShadow: 'inset 0 0 0 100px rgba(255,214,10,.28)' };
// Legal-move markers are a dark dot with a light rim, readable on every board theme.
const DOT = 'radial-gradient(circle, rgba(0,0,0,.42) 21%, rgba(255,255,255,.5) 22.5%, rgba(255,255,255,.5) 25%, transparent 27%)';
const RING = 'radial-gradient(circle, transparent 52%, rgba(255,255,255,.5) 53%, rgba(0,0,0,.42) 56%, rgba(0,0,0,.42) 63%, transparent 65%)';
export const BOARD_THEMES = { green: ['#769656', '#eeeed2'], brown: ['#b58863', '#f0d9b5'], blue: ['#8ca2ad', '#dee3e6'] } as const;

const GLYPH: Record<string, string> = { P: '♟', N: '♞', B: '♝', R: '♜', Q: '♛', K: '♚' };
type Pieces = NonNullable<ComponentProps<typeof Chessboard>['customPieces']>;
// "Outlined glyphs" piece style: one filled glyph per piece type, white or dark with a contrasting outline.
const GLYPH_PIECES = Object.fromEntries(['w', 'b'].flatMap(c => Object.keys(GLYPH).map(t => [c + t, ({ squareWidth }: { squareWidth: number }) => (
  <div style={{ width: squareWidth, height: squareWidth, display: 'grid', placeItems: 'center', fontSize: squareWidth * 0.82, lineHeight: 1,
    color: c === 'w' ? '#fff' : '#1a1a1a', textShadow: c === 'w' ? '0 0 2px #000, 0 0 3px #000, 0 0 3px #000' : '0 0 2px #fff, 0 0 3px #fff' }}>{GLYPH[t] + '\uFE0E'}</div>
)]))) as unknown as Pieces;

const setCache = new Map<string, Pieces>();
/** Piece sets from public/pieces/<set>/<wK>.svg; "classic" is the board library's built-in set. */
export function piecesFor(set: string): Pieces | undefined {
  if (set === 'glyph') return GLYPH_PIECES;
  if (set === 'classic') return undefined;
  let p = setCache.get(set);
  if (!p) {
    p = Object.fromEntries(['w', 'b'].flatMap(c => Object.keys(GLYPH).map(t => [c + t, ({ squareWidth }: { squareWidth: number }) => (
      <img src={`${import.meta.env.BASE_URL}pieces/${set}/${c}${t}.svg`} alt="" draggable={false} style={{ width: squareWidth, height: squareWidth, display: 'block' }} />
    )]))) as unknown as Pieces;
    setCache.set(set, p);
  }
  return p;
}

type Props = {
  path: string[];
  arrows?: [Square, Square][];
  fen?: string;
  side: 'w' | 'b';
  /** true = move made, false = illegal (plays a sound), null = ignore silently (e.g. not your turn). */
  onDrop?: (from: string, to: string) => boolean | null;
  /** The colour the user may pick up at any time, even on the opponent's turn. Without it, only the side to move can move. */
  mine?: 'w' | 'b';
  extra?: Record<string, CSSProperties>;
};

/** One board for the whole app. Pawns promote to a queen on drag; type SAN (e.g. e8=N) for under-promotion. */
export function Board({ path, fen, side, onDrop, mine, extra, arrows }: Props) {
  const s = useSettings();
  const c = replay(path, fen);
  const h = c.history({ verbose: true });
  const last = h[h.length - 1];
  const who = mine ?? c.turn();
  const [sel, setSel] = useState<Square | null>(null);
  const [dur, setDur] = useState(170); // piece slide time; 0 right after a drag so the piece does not slide again
  useEffect(() => { if (dur === 0) { const id = setTimeout(() => setDur(170), 80); return () => clearTimeout(id); } }, [dur]);

  // When it is not the user's turn, show where their piece could go if it were (for picking up and premoves).
  const probe = (() => {
    if (who === c.turn()) return c;
    try { const f = c.fen().split(' '); f[1] = who; f[3] = '-'; return new Chess(f.join(' ')); } catch { return c; }
  })();
  const targets = sel ? probe.moves({ square: sel, verbose: true }) : [];

  const styles: Record<string, CSSProperties> = { ...(last ? { [last.from]: LAST, [last.to]: LAST } : {}), ...extra };
  if (sel) styles[sel] = { ...styles[sel], boxShadow: 'inset 0 0 0 100px rgba(255,214,10,.4)' };
  for (const m of targets) styles[m.to] = { ...styles[m.to], backgroundImage: m.captured ? RING : DOT };

  const move = (f: string, t: string, drag = false) => {
    const r = onDrop?.(f, t) ?? null;
    if (r === false && f !== t) play('illegal');
    if (r === true && drag) setDur(0);
    return r === true;
  };
  const click = (sq: Square) => {
    if (!onDrop) return;
    if (sel && sel !== sq && targets.some(m => m.to === sq)) { move(sel, sq); setSel(null); return; }
    const p = c.get(sq);
    setSel(p && p.color === who ? sq : null);
  };
  useEffect(() => { setSel(null); }, [path.length, fen]);

  const prev = useRef(path.length);
  // Sound for every move that is added (not when stepping backwards through a line).
  useEffect(() => {
    const was = prev.current;
    prev.current = path.length;
    if (path.length <= was || !last) return;
    play(/[+#]/.test(last.san) ? 'check' : last.captured ? 'capture' : last.flags.includes('k') || last.flags.includes('q') ? 'castle' : last.promotion ? 'promote' : 'move');
  }, [path.length]);

  const [dark, light] = BOARD_THEMES[s.board];
  return (
    <div className="board" onPointerDownCapture={e => {
      // Grabbing a piece (mouse or touch) shows its legal moves immediately, whether you then drag or click.
      if (!onDrop) return;
      const sq = (e.target as HTMLElement).closest('[data-square]')?.getAttribute('data-square') as Square | null | undefined;
      const p = sq ? c.get(sq) : undefined;
      if (sq && p && p.color === who) setSel(sq);
    }}>
      <Chessboard
        position={c.fen()}
        boardOrientation={side === 'w' ? 'white' : 'black'}
        arePiecesDraggable={!!onDrop}
        isDraggablePiece={({ piece }) => piece[0] === who}
        animationDuration={dur}
        onPieceDrop={(f, t) => move(f, t, true)}
        onSquareClick={click}
        onPromotionCheck={() => false}
        showBoardNotation={s.coords}
        customArrows={arrows?.map((a): [Square, Square, string] => [a[0], a[1], 'rgba(124,140,255,.85)'])}
        customPieces={piecesFor(s.pieces)}
        customSquareStyles={styles}
        customDarkSquareStyle={{ backgroundColor: dark }}
        customLightSquareStyle={{ backgroundColor: light }}
      />
    </div>
  );
}
