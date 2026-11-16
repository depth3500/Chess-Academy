import { describe, expect, it } from 'vitest';
import { N, addLine, isLegal, matchKid, parseMoves } from './tree';
import { SEED } from '../data/openings';

describe('repertoire tree', () => {
  it('every preloaded line is legal chess', () => {
    for (const [name, , , m] of SEED) for (const l of m.split('|')) expect(isLegal(l.split(' ')), name + ': ' + l).toBe(true);
  });
  it('branches from the right position', () => {
    const t: N[] = [];
    addLine(t, ['e4', 'e5']); addLine(t, ['e4', 'c5']);
    expect(t).toHaveLength(1);
    expect(t[0].kids.map(k => k.san)).toEqual(['e5', 'c5']);
  });
  it('matches moves by resulting position and rejects others', () => {
    const t: N[] = []; addLine(t, ['e4']);
    expect(matchKid(t, [], { from: 'e2', to: 'e4' })?.san).toBe('e4');
    expect(matchKid(t, [], { from: 'd2', to: 'd4' })).toBeUndefined();
  });
  it('rejects illegal moves', () => expect(isLegal(['e4', 'e4'])).toBe(false));
  it('parses PGN and plain SAN, handles castling and en passant', () => {
    expect(parseMoves('1. e4 e5 2. Nf3 Nc6')).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    expect(parseMoves('e4 a6 e5 d5 exd6').pop()).toBe('exd6');
    expect(parseMoves('e4 e5 Nf3 Nc6 Bc4 Bc5 O-O').pop()).toBe('O-O');
  });
});
