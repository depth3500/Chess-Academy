import { Chessboard } from 'react-chessboard';
import { useSettings } from '../lib/settings';
import { replay } from '../lib/tree';
import { BOARD_THEMES, piecesFor } from './Board';

/** A small non-interactive board showing the position after `sans`. */
export function MiniBoard({ sans, side, fen }: { sans: string[]; side: 'w' | 'b'; fen?: string }) {
  const s = useSettings();
  const [dark, light] = BOARD_THEMES[s.board];
  let pos: string;
  try { pos = replay(sans, fen).fen(); } catch { pos = replay([], fen).fen(); }
  return (
    <Chessboard position={pos} arePiecesDraggable={false} animationDuration={0} showBoardNotation={false} boardOrientation={side === 'w' ? 'white' : 'black'}
      customPieces={piecesFor(s.pieces)} customDarkSquareStyle={{ backgroundColor: dark }} customLightSquareStyle={{ backgroundColor: light }} />
  );
}
