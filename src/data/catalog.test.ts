import { describe, expect, it } from 'vitest';
import { isLegal } from '../lib/tree';
import catalog from './catalog.json';

describe('opening catalog', () => {
  it('has many families whose lines are legal chess', () => {
    expect(catalog.length).toBeGreaterThan(100);
    for (const f of catalog.slice(0, 40)) for (const [, m] of f.l.slice(0, 6)) expect(isLegal(m.split(' ')), f.n + ': ' + m).toBe(true);
  });
  it('sorts the biggest family first', () => expect(catalog[0].n).toBe('Sicilian Defense'));
});
