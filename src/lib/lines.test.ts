import { describe, expect, it } from 'vitest';
import { leaning, describe as say } from '../data/leanings';
import { lineInfo, progress } from './lines';
import { newCard, review, DEFAULT_CFG as cfg } from './srs';
import { Opening, addLine } from './tree';

const o: Opening = { id: 'x', name: 'X', eco: 'C50', side: 'w', tree: [] };
addLine(o.tree, ['e4', 'e5', 'Nf3'], 'Open Game');
addLine(o.tree, ['e4', 'e5', 'Bc4', 'Nf6'], 'Bishop line');
addLine(o.tree, ['e4', 'c5']);

describe('lines', () => {
  it('names lines from the deepest named move and numbers the rest', () => {
    const l = lineInfo(o, {});
    expect(l.map(x => x.name)).toEqual(['Open Game', 'Bishop line', 'Line 3']);
    expect(progress(l)).toEqual({ learned: 0, total: 3 });
  });
  it('a line is learned after two correct answers on every move you play', () => {
    const cards: Record<string, ReturnType<typeof newCard>> = {};
    for (const k of ['e4', 'e4 e5 Nf3']) { let c = newCard('x', k, cfg); c = review(c, 'good', 0, cfg); cards['x:' + k] = c; }
    expect(lineInfo(o, cards)[0].status).toBe('learning');
    for (const k of Object.keys(cards)) cards[k] = review(cards[k], 'good', 0, cfg);
    expect(lineInfo(o, cards)[0].status).toBe('learned');
    expect(lineInfo(o, cards)[2].status).toBe('learned'); // its only move for you is e4, which is already learned (c5 is the opponent's)
  });
});

describe('leanings', () => {
  it('known openings use their hand-set values and stay in range', () => {
    expect(leaning('Sicilian Defense', 'b', 259)).toMatchObject({ pt: 55, da: 35, eb: 90 });
    expect(leaning('Danish Gambit', 'w', 1).eb).toBeLessThan(-50);
  });
  it('unknown gambits are guessed as sharp, and the summary reads well', () => {
    const l = leaning('Some Odd Gambit', 'w', 12);
    expect(l.pt).toBeGreaterThan(20); expect(l.da).toBeGreaterThan(20);
    expect(say(l)).toMatch(/tactical and aggressive/);
  });
});
