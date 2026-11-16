import { useEffect, useRef, useState } from 'react';
import type { Square } from 'chess.js';
import type { ComponentProps, CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import { useSettings } from '../lib/settings';
import { play } from '../lib/sound';
import { replay } from '../lib/tree';

// Highlights use an inset shadow and a background image so the square's own colour always stays visible.
const LAST: CSSProperties = { boxShadow: 'inset 0 0 0 100px rgba(181,217,138,.5)' };
const THEMES = { green: ['#769656', '#eeeed2'], brown: ['#b58863', '#f0d9b5'], blue: ['#8ca2ad', '#dee3e6'] } as const;

const GLYPH: Record<string, string> = { P: '♟', N: '♞', B: '♝', R: '♜', Q: '♛', K: '♚' };
type Pieces = NonNullable<ComponentProps<typeof Chessboard>['customPieces']>;
// "Outlined glyphs" piece style: one filled glyph per piece type, white or dark with a contrasting outline.
const GLYPH_PIECES = Object.fromEntries(['w', 'b'].flatMap(c => Object.keys(GLYPH).map(t => [c + t, ({ squareWidth }: { squareWidth: number }) => (
  <div style={{ width: squareWidth, height: squareWidth, display: 'grid', placeItems: 'center', fontSize: squareWidth * 0.82, lineHeight: 1,
    color: c === 'w' ? '#fff' : '#1a1a1a', textShadow: c === 'w' ? '0 0 2px #000, 0 0 3px #000, 0 0 3px #000' : '0 0 2px #fff, 0 0 3px #fff' }}>{GLYPH[t] + '\uFE0E'}</div>
)]))) as unknown as Pieces;

type Props = {
  path: string[];
  arrows?: [Square, Square][];
  fen?: string;
  side: 'w' | 'b';
  onDrop?: (from: string, to: string) => boolean;
  extra?: Record<string, CSSProperties>;
};

/** One board for the whole app. Pawns promote to a queen on drag; type SAN (e.g. e8=N) for under-promotion. */
export function Board({ path, fen, side, onDrop, extra, arrows }: Props) {
  const s = useSettings();
  const c = replay(path, fen);
  const h = c.history({ verbose: true });
  const last = h[h.length - 1];
  const [sel, setSel] = useState<Square | null>(null);
  const styles: Record<string, CSSProperties> = { ...(last ? { [last.from]: LAST, [last.to]: LAST } : {}), ...extra };
  // Selected piece and its legal destinations (dots for moves, rings for captures).
  const targets = sel ? c.moves({ square: sel, verbose: true }) : [];
  if (sel) styles[sel] = { ...styles[sel], boxShadow: 'inset 0 0 0 100px rgba(255,214,10,.4)' };
  for (const m of targets) {
    styles[m.to] = { ...styles[m.to], backgroundImage: m.captured ? 'radial-gradient(circle, transparent 58%, rgba(20,60,30,.45) 60%)' : 'radial-gradient(circle, rgba(20,60,30,.45) 20%, transparent 22%)' };
  }
  const move = (f: string, t: string) => {
    const ok = onDrop?.(f, t) ?? false;
    if (!ok && onDrop && f !== t) play('illegal');
    return ok;
  };
  const click = (sq: Square) => {
    if (!onDrop) return;
    if (sel && sel !== sq && targets.some(m => m.to === sq)) { move(sel, sq); setSel(null); return; }
    const p = c.get(sq);
    setSel(p && p.color === c.turn() && sel !== sq ? sq : null);
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

  const [dark, light] = THEMES[s.board];
  return (
    <div className="board">
      <Chessboard
        position={c.fen()}
        boardOrientation={side === 'w' ? 'white' : 'black'}
        arePiecesDraggable={!!onDrop}
        onPieceDrop={(f, t) => move(f, t)}
        onSquareClick={click}
        onPieceDragBegin={(_, sq) => { if (onDrop) setSel(sq); }}
        onPieceDragEnd={() => setSel(null)}
        onPromotionCheck={() => false}
        showBoardNotation={s.coords}
        customArrows={arrows?.map((a): [Square, Square, string] => [a[0], a[1], 'rgba(129,182,76,.85)'])}
        customPieces={s.pieces === 'glyph' ? GLYPH_PIECES : undefined}
        customSquareStyles={styles}
        customDarkSquareStyle={{ backgroundColor: dark }}
        customLightSquareStyle={{ backgroundColor: light }}
      />
    </div>
  );
}
