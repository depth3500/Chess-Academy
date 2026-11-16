import { describe, expect, it } from 'vitest';
import { seedOpenings } from '../data/openings';
import { validOpening } from './files';

describe('import validation', () => {
  it('accepts the preloaded openings', () => expect(seedOpenings().every(validOpening)).toBe(true));
  it('rejects illegal lines and wrong shapes', () => {
    expect(validOpening({ id: 'x', name: 'n', eco: '', side: 'w', tree: [{ san: 'e5', kids: [] }] })).toBe(false);
    expect(validOpening({ id: 'x', name: 'n', side: 'w', tree: [] })).toBe(false);
    expect(validOpening(null)).toBe(false);
  });
});
