import { describe, expect, it } from 'vitest';
import { mergeCards, mergeList, reconcile } from './sync';

const s = (at: number, opening = 'o') => ({ at, opening });
const card = (last: number, seen = 1) => ({ last, seen });

describe('cloud reconcile', () => {
  it('newest edit wins for openings, in both directions', () => {
    expect(reconcile({ openings: { value: 'L', at: 5 } }, { openings: { value: 'R', at: 9 } }).pull.openings.value).toBe('R');
    const r = reconcile({ openings: { value: 'L', at: 9 } }, { openings: { value: 'R', at: 5 } });
    expect(r.push.openings.value).toBe('L');
    expect(r.pull.openings).toBeUndefined();
  });
  it('a fresh device (starter openings, never edited) takes the cloud copy', () => {
    expect(reconcile({}, { openings: { value: 'R', at: 3 } }).pull.openings.value).toBe('R');
  });
  it('merges sessions from two devices without losing any', () => {
    const r = reconcile({ sessions: { value: [s(1), s(2)], at: 2 } }, { sessions: { value: [s(2), s(3)], at: 3 } });
    expect((r.pull.sessions.value as unknown[]).length).toBe(3);
    expect((r.push.sessions.value as unknown[]).length).toBe(3);
  });
  it('keeps the most recently reviewed copy of each card', () => {
    expect(mergeCards({ a: card(5), b: card(1) }, { a: card(2), c: card(7) })).toEqual({ a: card(5), b: card(1), c: card(7) });
  });
  it('a reset on one device removes older progress everywhere', () => {
    const r = reconcile({ sessions: { value: [], at: 10 }, reset: { value: 10, at: 10 } }, { sessions: { value: [s(1), s(20)], at: 5 }, cards: { value: { a: card(3), b: card(30) }, at: 5 } });
    expect(r.push.sessions.value).toEqual([s(20)]);
    expect(r.push.cards.value).toEqual({ b: card(30) });
    expect(r.push.reset.value).toBe(10); // the reset itself is shared with the cloud
  });
  it('is stable once both sides agree (no ping-pong)', () => {
    const e = { openings: { value: 'X', at: 4 }, sessions: { value: [s(1)], at: 1 } };
    expect(reconcile(e, e)).toEqual({ pull: {}, push: {} });
    expect(mergeList([s(1)], [s(1)])).toEqual([s(1)]);
  });
});
