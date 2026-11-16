import { describe, expect, it } from 'vitest';
import { DAY, DEFAULT_CFG as cfg, grade, level, newCard, review, streak } from './srs';

describe('spaced repetition', () => {
  it('grows intervals 1 day, 6 days, then by ease', () => {
    let c = review(newCard('o', 'x', cfg), 'good', 0, cfg);
    expect(c.interval).toBe(1);
    c = review(c, 'good', 0, cfg); expect(c.interval).toBe(6);
    c = review(c, 'good', 0, cfg); expect(c.interval).toBe(16);
  });
  it('a miss makes the card due now and counts a lapse', () => {
    const c = review(review(newCard('o', 'x', cfg), 'good', 0, cfg), 'again', 100, cfg);
    expect([c.interval, c.due, c.lapses, c.reps]).toEqual([0, 100, 1, 0]);
  });
  it('grades and levels', () => {
    expect([grade(0, false), grade(0, true), grade(2, false)]).toEqual(['good', 'hard', 'again']);
    expect(level(newCard('o', 'x', cfg))).toBe(1);
    expect(level(review(newCard('o', 'x', cfg), 'good', 0, cfg))).toBe(2);
  });
  it('counts a streak of consecutive days', () => {
    const now = new Date(2026, 10, 15, 12).getTime();
    expect(streak([now, now - DAY], now)).toBe(2);
    expect(streak([now - DAY], now)).toBe(1);
    expect(streak([now - 3 * DAY], now)).toBe(0);
  });
});
