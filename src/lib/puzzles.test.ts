import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { PUZZLES, dailyPuzzle, randomPuzzle } from './puzzles';

describe('puzzles', () => {
  it('has a full set and every stored solution is legal chess; mating lines end in checkmate', () => {
    expect(PUZZLES.length).toBeGreaterThan(250);
    for (const p of PUZZLES) {
      const c = new Chess(p.fen);
      expect(c.turn(), `puzzle ${p.id}`).toBe(p.side);
      for (const s of p.sol) c.move(s);
      if (p.mate) expect(c.isCheckmate(), `puzzle ${p.id}`).toBe(true);
    }
  });
  it('the daily puzzle is stable during a day and changes the next day', () => {
    const a = dailyPuzzle(new Date(2026, 5, 1, 9)), b = dailyPuzzle(new Date(2026, 5, 1, 22)), n = dailyPuzzle(new Date(2026, 5, 2, 9));
    expect(a.id).toBe(b.id);
    expect(n.id).not.toBe(a.id);
  });
  it('covers a wide rating range and the difficulty pickers respect it', () => {
    const rs = PUZZLES.map(p => p.r);
    expect(Math.max(...rs) - Math.min(...rs)).toBeGreaterThan(1200);
    for (let i = 0; i < 20; i++) { expect(randomPuzzle('easy').r).toBeLessThan(1000); expect(randomPuzzle('medium').r).toBeGreaterThanOrEqual(1000); }
  });
});
