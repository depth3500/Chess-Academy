import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { PosEval, buildReview, evalText, gameAccuracy, makeBook, moveAccuracy, winPct } from './review';

describe('review maths', () => {
  it('win chance and move accuracy follow the lichess formulas', () => {
    expect(winPct(0)).toBeCloseTo(50, 5);
    expect(winPct(100)).toBeCloseTo(59.1, 1);
    expect(winPct(100000)).toBeCloseTo(winPct(1000), 5); // scores are clamped
    expect(moveAccuracy(50, 50)).toBeCloseTo(100, 0);
    expect(moveAccuracy(60, 50)).toBeCloseTo(63.6, 0);
    expect(moveAccuracy(80, 10)).toBeLessThan(10);
  });
  it('shows evaluations like an engine', () => {
    expect(evalText(135, 0)).toBe('+1.4'); expect(evalText(-40, 0)).toBe('-0.4'); expect(evalText(9990, 1)).toBe('M1'); expect(evalText(-9980, -2)).toBe('-M2');
  });
  it('perfect play scores near 100 and sloppy play scores lower', () => {
    const wps = [50, 50, 50, 50, 50, 50];
    expect(gameAccuracy([0, 2, 4], [100, 100, 100], wps, 6)).toBeCloseTo(100, 0);
    expect(gameAccuracy([0, 2, 4], [40, 50, 30], wps, 6)).toBeLessThan(55);
  });
});

// Scholar's mate: Black's 3...Nf6 allows mate in one. Evaluations are synthetic (side to move) so no engine is needed.
describe('buildReview', () => {
  const sans = ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'];
  const c = new Chess(); const fens = [c.fen()]; for (const s of sans) { c.move(s); fens.push(c.fen()); }
  const L = (cp: number, pv: string[], mate = 0) => ({ cp, mate, pv });
  const ev = (cp: number, best: string, second = cp - 30, mate = 0): PosEval => ({ cp, mate, lines: [L(cp, [best], mate), L(second, ['a2a3'])] });
  const evals: PosEval[] = [
    ev(20, 'e2e4'), ev(-20, 'e7e5'), ev(30, 'g1f3'), ev(-25, 'g8f6'), ev(30, 'b1c3'), ev(-35, 'g7g6'),
    { cp: 9990, mate: 1, lines: [L(9990, ['h5f7'], 1), L(300, ['h5e5'])] }, { cp: -10000, mate: 0, lines: [] },
  ];
  // position 3 (after 2.Qh5) is evaluated from black's side; the move before it gave away almost nothing
  evals[3] = ev(-25, 'g8f6');
  const r = buildReview(sans, fens, evals, p => (p <= 2 ? 'King\'s Pawn Game' : undefined), 12);

  it('flags the losing move as a blunder and the mating move as best or great', () => {
    expect(r.moves[5]).toMatchObject({ san: 'Nf6', cls: 'blunder', best: 'g6' });
    expect(['best', 'great']).toContain(r.moves[6].cls);
    expect(r.counts.b.blunder).toBe(1);
  });
  it('marks opening moves as book and names the opening', () => {
    expect(r.moves[0].cls).toBe('book'); expect(r.moves[1].cls).toBe('book'); expect(r.opening).toBe("King's Pawn Game");
  });
  it('gives the player who blundered the lower accuracy', () => { expect(r.acc.b).toBeLessThan(r.acc.w); });
  it('keeps white-side evaluations for the graph and eval bar', () => {
    expect(r.wcp[1]).toBe(20); // black to move with -20 from black's side = +20 for white
    expect(r.wmate[6]).toBe(1);
  });
});

describe('book lookup', () => {
  const book = makeBook([{ n: 'Italian Game', l: [['', 'e4 e5 Nf3 Nc6 Bc4'], ['Giuoco Piano', 'e4 e5 Nf3 Nc6 Bc4 Bc5']] }]);
  it('stays in book along known lines only', () => {
    expect(book(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'], 6)).toBe('Italian Game: Giuoco Piano');
    expect(book(['e4', 'e5', 'Nf3'], 3)).toBe('Opening theory');
    expect(book(['e4', 'e5', 'Qh5'], 3)).toBeUndefined();
  });
});
