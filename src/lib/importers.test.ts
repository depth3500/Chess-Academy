import { describe, expect, it } from 'vitest';
import { fromChesscom, fromLichess, fromPgn, outcome, parsePgn } from './importers';

const SCHOLAR = '[Event "Live"]\n[White "buddy"]\n[Black "Tester"]\n[Result "1-0"]\n\n1. e4 {[%clk 0:09:58]} e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0';

describe('importers', () => {
  it('reads chess.com archives: newest first, standard chess only, with the result for you', () => {
    const g = fromChesscom({ games: [
      { url: 'u1', uuid: 'a', pgn: SCHOLAR, rules: 'chess', time_class: 'rapid', end_time: 100, white: { username: 'buddy', rating: 900, result: 'win' }, black: { username: 'Tester', rating: 880, result: 'checkmated' } },
      { url: 'u2', pgn: SCHOLAR, rules: 'chess960', end_time: 200, white: { username: 'x', rating: 1, result: 'win' }, black: { username: 'y', rating: 1, result: 'resigned' } },
      { url: 'u3', uuid: 'c', pgn: SCHOLAR, rules: 'chess', end_time: 300, white: { username: 'tester', rating: 880, result: 'agreed' }, black: { username: 'z', rating: 900, result: 'agreed' }, accuracies: { white: 70, black: 80 } },
    ] }, 'tester');
    expect(g.map(x => x.id)).toEqual(['c', 'a']);
    expect(g[0]).toMatchObject({ me: 'w', result: '1/2-1/2', acc: { w: 70, b: 80 } });
    expect(g[1]).toMatchObject({ me: 'b', result: '1-0' });
    expect(outcome(g[0])).toBe('Draw'); expect(outcome(g[1])).toBe('Lost');
  });
  it('reads the lichess ndjson export', () => {
    const line = JSON.stringify({ id: 'abc123', createdAt: 5, speed: 'blitz', winner: 'black', pgn: SCHOLAR, players: { white: { user: { name: 'Me' }, rating: 1500 }, black: { user: { name: 'Other' }, rating: 1600 } } });
    const g = fromLichess(line + '\n' + line.replace('abc123', 'def456'), 'me');
    expect(g).toHaveLength(2);
    expect(g[0]).toMatchObject({ me: 'w', result: '0-1', url: 'https://lichess.org/abc123' }); expect(outcome(g[0])).toBe('Lost');
  });
  it('parses a PGN with clock comments into positions, and rejects junk and variants', () => {
    const p = parsePgn(SCHOLAR);
    expect(p.sans).toEqual(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#']);
    expect(p.fens).toHaveLength(8); expect(p.white).toBe('buddy');
    expect(() => parsePgn('[Variant "Crazyhouse"]\n\n1. e4 e5')).toThrow();
    expect(() => parsePgn('not a game at all')).toThrow();
    expect(fromPgn(SCHOLAR).id).toMatch(/^pgn-/);
  });
});
