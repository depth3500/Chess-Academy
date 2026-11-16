import { describe, expect, it } from 'vitest';
import { explain, idea, moveAt } from './explain';

describe('explanations', () => {
  it('describes a central pawn move from the real position', () => {
    const e = explain(['e4']);
    expect(e[0]).toMatch(/centre/);
    expect(e[1]).toBe('White moves the pawn from e2 to e4.');
  });
  it('recognises castling and development', () => {
    expect(idea(moveAt(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O']))).toMatch(/Castle/);
    expect(idea(moveAt(['e4', 'e5', 'Nf3']))).toMatch(/Develop/);
  });
  it('reports captures and attacks', () => {
    expect(explain(['e4', 'd5', 'exd5'])[1]).toMatch(/capturing a pawn/);
  });
});
