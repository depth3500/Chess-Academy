import { Chess } from 'chess.js';

export type GameRef = {
  id: string; source: 'chesscom' | 'lichess' | 'pgn'; white: string; black: string; wr?: number; br?: number;
  result: '1-0' | '0-1' | '1/2-1/2' | '*'; at: number; speed?: string; pgn: string; me?: 'w' | 'b'; acc?: { w?: number; b?: number }; url?: string;
};

async function request(url: string, init?: RequestInit) {
  let r: Response;
  try { r = await fetch(url, init); } catch { throw new Error('Could not reach the server. Check your connection, or use the Paste PGN tab.'); }
  if (r.status === 404) throw new Error('User not found. Check the spelling of the username.');
  if (r.status === 429) throw new Error('Too many requests. Wait a minute and try again.');
  if (!r.ok) throw new Error(`The server answered ${r.status}.`);
  return r;
}

type CcPlayer = { username: string; rating: number; result: string };
type CcGame = { url: string; uuid?: string; pgn?: string; rules: string; time_class?: string; end_time: number; white: CcPlayer; black: CcPlayer; accuracies?: { white?: number; black?: number } };

/** Maps chess.com's monthly archive JSON to games (standard chess only), newest first. */
export function fromChesscom(json: { games?: CcGame[] }, user: string): GameRef[] {
  const u = user.toLowerCase();
  return [...(json.games ?? [])].reverse().filter(g => g.rules === 'chess' && g.pgn).map(g => ({
    id: g.uuid ?? g.url, source: 'chesscom' as const, white: g.white.username, black: g.black.username, wr: g.white.rating, br: g.black.rating,
    result: g.white.result === 'win' ? '1-0' : g.black.result === 'win' ? '0-1' : '1/2-1/2',
    at: g.end_time * 1000, speed: g.time_class, pgn: g.pgn!, url: g.url, acc: g.accuracies && { w: g.accuracies.white, b: g.accuracies.black },
    me: g.white.username.toLowerCase() === u ? 'w' : g.black.username.toLowerCase() === u ? 'b' : undefined,
  }));
}

export async function fetchChesscom(user: string, n = 25): Promise<GameRef[]> {
  const u = user.trim().toLowerCase();
  if (!u) throw new Error('Enter a chess.com username.');
  const a = await (await request(`https://api.chess.com/pub/player/${encodeURIComponent(u)}/games/archives`)).json();
  const out: GameRef[] = [];
  for (const url of [...((a.archives as string[]) ?? [])].reverse().slice(0, 4)) { // the newest months first
    out.push(...fromChesscom(await (await request(url)).json(), u));
    if (out.length >= n) break;
  }
  if (!out.length) throw new Error('No standard chess games found for this user yet.');
  return out.slice(0, n);
}

type LiGame = { id: string; createdAt: number; speed?: string; winner?: 'white' | 'black'; pgn?: string; variant?: string; players: { white: { user?: { name: string }; rating?: number }; black: { user?: { name: string }; rating?: number } } };

/** Maps lichess's newline-delimited JSON export (with pgnInJson) to games. */
export function fromLichess(text: string, user: string): GameRef[] {
  const u = user.toLowerCase();
  return text.split('\n').filter(l => l.trim()).map(l => JSON.parse(l) as LiGame).filter(g => g.pgn && (!g.variant || g.variant === 'standard')).map(g => {
    const w = g.players.white.user?.name ?? 'Anonymous', b = g.players.black.user?.name ?? 'Anonymous';
    return {
      id: g.id, source: 'lichess' as const, white: w, black: b, wr: g.players.white.rating, br: g.players.black.rating, at: g.createdAt, speed: g.speed, pgn: g.pgn!,
      result: g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '1/2-1/2', url: `https://lichess.org/${g.id}`,
      me: w.toLowerCase() === u ? 'w' : b.toLowerCase() === u ? 'b' : undefined,
    };
  });
}

export async function fetchLichess(user: string, n = 25): Promise<GameRef[]> {
  const u = user.trim();
  if (!u) throw new Error('Enter a lichess username.');
  const r = await request(`https://lichess.org/api/games/user/${encodeURIComponent(u)}?max=${n}&pgnInJson=true&opening=true`, { headers: { Accept: 'application/x-ndjson' } });
  const out = fromLichess(await r.text(), u);
  if (!out.length) throw new Error('No standard chess games found for this user yet.');
  return out;
}

export type Parsed = { sans: string[]; fens: string[]; white: string; black: string; result: string; start?: string };

/** Reads a PGN into SAN moves and the position before and after each move. Throws on illegal moves or chess variants. */
export function parsePgn(pgn: string): Parsed {
  const c = new Chess();
  c.loadPgn(pgn);
  const h = c.header();
  if (h.Variant && !/^standard$/i.test(h.Variant)) throw new Error(`${h.Variant} is not supported, only standard chess.`);
  const sans = c.history();
  if (!sans.length) throw new Error('That PGN has no moves.');
  const start = h.FEN || undefined;
  const r = new Chess(start);
  const fens = [r.fen()];
  for (const s of sans) { r.move(s); fens.push(r.fen()); }
  return { sans, fens, white: h.White ?? 'White', black: h.Black ?? 'Black', result: h.Result ?? '*', start };
}

/** Wraps pasted PGN text as a game reference. */
export function fromPgn(pgn: string): GameRef {
  const p = parsePgn(pgn);
  return { id: 'pgn-' + hash(p.sans.join(' ') + p.white + p.black), source: 'pgn', white: p.white, black: p.black, result: (['1-0', '0-1', '1/2-1/2'].includes(p.result) ? p.result : '*') as GameRef['result'], at: Date.now(), pgn };
}

const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

export const outcome = (g: GameRef) => (!g.me || g.result === '*' ? '' : g.result === '1/2-1/2' ? 'Draw' : (g.result === '1-0') === (g.me === 'w') ? 'Won' : 'Lost');
