import { describe, expect, it } from 'vitest';
import { toUci } from './engine';
import { N, addLine, colorAt, isLegal, matchKid, parseGame, plyLabel, replay, validFen } from './tree';

const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

describe('custom start positions', () => {
  it('validates FEN strings', () => {
    expect(validFen(AFTER_E4)).toBe(true);
    expect(validFen('not a fen')).toBe(false);
  });
  it('keeps turns and move labels right when Black moves first', () => {
    expect([colorAt(0, AFTER_E4), colorAt(1, AFTER_E4)]).toEqual(['b', 'w']);
    expect([plyLabel(0, AFTER_E4), plyLabel(1, AFTER_E4)]).toEqual(['1…', '2.']);
    expect(plyLabel(0)).toBe('1.');
  });
  it('replays, validates and matches moves from the start position', () => {
    expect(replay(['e5'], AFTER_E4).fen()).toContain('rnbqkbnr/pppp1ppp/8/4p3/4P3');
    expect(isLegal(['e5'], AFTER_E4)).toBe(true);
    expect(isLegal(['e5'])).toBe(false);
    const t: N[] = []; addLine(t, ['e5']);
    expect(matchKid(t, [], { from: 'e7', to: 'e5' }, AFTER_E4)?.san).toBe('e5');
  });
  it('reads a FEN header from PGN and plain moves with a given FEN', () => {
    const g = parseGame(`[SetUp "1"]\n[FEN "${AFTER_E4}"]\n\n1... e5 2. Nf3 *`);
    expect(g.sans).toEqual(['e5', 'Nf3']);
    expect(g.fen).toBe(AFTER_E4);
    expect(parseGame('e5 Nf3', AFTER_E4)).toEqual({ sans: ['e5', 'Nf3'], fen: AFTER_E4 });
  });
  it('converts moves to UCI from the start position', () => {
    expect(toUci(['e5', 'Nf3'], AFTER_E4)).toEqual(['e7e5', 'g1f3']);
  });
});
