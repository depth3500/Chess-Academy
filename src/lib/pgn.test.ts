import { describe, expect, it } from 'vitest';
import { lines, parseTree } from './tree';

describe('PGN import with variations', () => {
  const pgn = '[Event "Test"]\n\n1. e4 e5 (1... c5 2. Nf3 {Open Sicilian}) 2. Nf3 Nc6 *\n\n[Event "Two"]\n\n1. d4 d5 *';

  it('keeps variations as branches and comments as notes', () => {
    const { tree } = parseTree(pgn);
    expect(tree.map(n => n.san)).toEqual(['e4', 'd4']);
    expect(tree[0].kids.map(n => n.san)).toEqual(['e5', 'c5']);
    expect(tree[0].kids[1].kids[0]).toMatchObject({ san: 'Nf3', note: 'Open Sicilian' });
    expect(tree[0].kids[0].kids[0].kids[0].san).toBe('Nc6');
    expect(lines(tree)).toBe(3);
  });
  it('rejects illegal moves and reads a FEN header', () => {
    expect(() => parseTree('1. e4 e4')).toThrow();
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const r = parseTree(`[FEN "${fen}"]\n\n1... e5 2. Nf3`);
    expect(r.fen).toBe(fen);
    expect(r.tree[0].san).toBe('e5');
  });
  it('handles annotation marks and move numbers glued to moves', () => {
    expect(parseTree('1.e4! e5?! 2.Nf3').tree[0].kids[0].kids[0].san).toBe('Nf3');
  });
});
