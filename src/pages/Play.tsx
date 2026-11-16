import { useEffect, useRef, useState } from 'react';
import { Board } from '../components/Board';
import { ANALYSIS, Engine, LEVELS, fromUci, toUci } from '../lib/engine';
import { getSettings } from '../lib/settings';
import { play } from '../lib/sound';
import { N, Opening, colorAt, kidsAt, plyLabel, replay, validFen } from '../lib/tree';

type Mode = 'strict' | 'flexible' | 'random' | 'engine';
const PIECE: Record<string, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const cont = (n: N): string[] => (n.kids.length ? [n.san, ...cont(n.kids[0])] : [n.san]);

/** Walks the game through the opening tree and reports where (and if) the line was left. */
function review(tree: N[], path: string[]): { followed: number; dev?: number; expected?: N[] } {
  let lvl = tree;
  for (let i = 0; i < path.length; i++) {
    if (!lvl.length) return { followed: i };
    const n = lvl.find(k => k.san === path[i]);
    if (!n) return { followed: i, dev: i, expected: lvl };
    lvl = n.kids;
  }
  return { followed: path.length };
}

export function Play({ list }: { list: Opening[] }) {
  const [cfg, setCfg] = useState({ color: (getSettings().side === 'b' ? 'b' : 'w') as 'w' | 'b', level: getSettings().engineLevel, mode: 'strict' as Mode, id: list[0]?.id ?? '', fen: '' });
  const [started, setStarted] = useState(false);
  const [path, setPath] = useState<string[]>([]);
  const [flip, setFlip] = useState(false);
  const [end, setEnd] = useState('');
  const [msg, setMsg] = useState('');
  const [verdict, setVerdict] = useState('');
  const engRef = useRef<Engine | null>(null);
  const eng = () => (engRef.current ??= new Engine());
  useEffect(() => () => engRef.current?.kill(), []);

  const { color, level, mode } = cfg;
  const open = list.find(o => o.id === cfg.id);
  // Opening modes start from the opening's own start position; engine-only games can start from any FEN.
  const startFen = mode === 'engine' ? cfg.fen.trim() || undefined : mode === 'random' ? undefined : open?.fen;
  const c = replay(path, startFen);
  const turn = c.turn();
  const natural = c.isCheckmate() ? `Checkmate. ${turn === 'w' ? 'Black' : 'White'} wins.`
    : c.isStalemate() ? 'Draw by stalemate.'
    : c.isThreefoldRepetition() ? 'Draw by repetition.'
    : c.isInsufficientMaterial() ? 'Draw: insufficient material.'
    : c.isDraw() ? 'Draw by the fifty-move rule.' : '';
  const result = end || natural;
  const over = !!result;
  const thinking = started && !over && turn !== color;
  const h = c.history({ verbose: true });
  const caps = (by: string) => h.filter(m => m.color === by && m.captured).map(m => PIECE[m.captured!]).join(' ') || 'none';
  const rv = open && (mode === 'strict' || mode === 'flexible') ? review(open.tree, path) : null;

  // Bot move: follow the repertoire while the game is still inside it, then hand over to Stockfish.
  useEffect(() => {
    if (!thinking) return;
    let live = true;
    const t0 = Date.now();
    const book = mode === 'engine' ? [] : mode === 'random' ? list.filter(o => !o.fen).flatMap(o => kidsAt(o.tree, path)) : open ? kidsAt(open.tree, path) : [];
    (async () => {
      const san = book.length
        ? (mode === 'strict' ? book[0] : book[Math.floor(Math.random() * book.length)]).san
        : fromUci(path, (await eng().search(toUci(path, startFen), { ...LEVELS[level], ms: LEVELS[level].ms * getSettings().think }, startFen)).move, startFen);
      await sleep(Math.max(0, 800 - (Date.now() - t0))); // never answer instantly
      if (live) setPath(p => [...p, san]);
    })().catch(() => setMsg('Stockfish could not start. Make sure the public/stockfish folder is deployed with the app.'));
    return () => { live = false; eng().cancel(); };
  }, [path, thinking]);

  // After the game: did leaving the book line cost anything? Compare engine scores of the two moves.
  useEffect(() => {
    if (!over || !rv || rv.dev === undefined || !rv.expected) return;
    let live = true;
    const dev = rv.dev, book = rv.expected[0].san;
    (async () => {
      const score = async (m: string[]) => -(await eng().search(toUci(m, startFen), ANALYSIS, startFen)).cp; // from the mover's view
      const d = ((await score([...path.slice(0, dev), book])) - (await score(path.slice(0, dev + 1)))) / 100;
      if (live) setVerdict(d > 0.5 ? `Mistake: your move scores about ${d.toFixed(1)} pawns worse than the book move.` : 'Not a mistake: the engine rates your move about as well as the book move.');
    })().catch(() => {});
    return () => { live = false; };
  }, [over]);

  useEffect(() => { if (started && over) play('end'); }, [over]);

  const start = () => {
    if (mode === 'engine' && cfg.fen.trim() && !validFen(cfg.fen.trim())) { setMsg('That FEN is not a valid position.'); return; }
    setPath([]); setEnd(''); setMsg(''); setVerdict(''); setFlip(false); setStarted(true); };
  const drop = (f: string, t: string) => {
    try { setPath([...path, c.move({ from: f, to: t, promotion: 'q' }).san]); return true; } catch { return false; }
  };
  const undo = () => { let n = path.length - 1; if (n > 0 && colorAt(n, startFen) !== color) n--; setPath(path.slice(0, Math.max(0, n))); setMsg(''); };
  const offerDraw = async () => {
    setMsg('The bot is considering your draw offer…');
    try {
      const { cp } = await eng().search(toUci(path, startFen), ANALYSIS, startFen); // score for you; the bot accepts unless it is better
      if (cp >= -20) { setEnd('Draw agreed.'); setMsg(''); } else setMsg('Draw declined.');
    } catch { setMsg('Stockfish is not available.'); }
  };
  const pick = <K extends keyof typeof cfg>(k: K, v: (typeof cfg)[K]) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="split">
      <Board path={path} fen={startFen} side={(color === 'w') !== flip ? 'w' : 'b'} onDrop={started && !over && !thinking ? drop : undefined} />
      <div className="panel">
        {!started ? (
          <>
            <h2>Play against Stockfish</h2>
            <label>Play as
              <select value={color} onChange={e => pick('color', e.target.value as 'w' | 'b')}><option value="w">White</option><option value="b">Black</option></select>
            </label>
            <label>Difficulty
              <select value={level} onChange={e => pick('level', e.target.value)}>{Object.keys(LEVELS).map(l => <option key={l}>{l}</option>)}</select>
            </label>
            <label>Opening mode
              <select value={mode} onChange={e => pick('mode', e.target.value as Mode)}>
                <option value="strict">Strict: bot plays the main line exactly</option>
                <option value="flexible">Flexible: bot picks any variation of the opening</option>
                <option value="random">Random: bot picks any opening in my repertoire</option>
                <option value="engine">Engine only</option>
              </select>
            </label>
            {(mode === 'strict' || mode === 'flexible') && (
              <label>Opening
                <select value={cfg.id} onChange={e => setCfg({ ...cfg, id: e.target.value, color: list.find(o => o.id === e.target.value)?.side ?? color })}>
                  {list.map(o => <option key={o.id} value={o.id}>{o.name} ({o.side === 'w' ? 'White' : 'Black'})</option>)}
                </select>
              </label>
            )}
            {mode === 'engine' && (
              <label>Start position (FEN, optional)
                <input value={cfg.fen} onChange={e => pick('fen', e.target.value)} placeholder="Standard position" />
              </label>
            )}
            {msg && <p className="err" role="alert">{msg}</p>}
            <button className="primary" onClick={start}>Start game</button>
          </>
        ) : (
          <>
            <h2>{rv && open ? open.name : 'Game'} vs {level}</h2>
            <p className={msg.includes('could not') ? 'err' : 'muted'} role="status">
              {result || msg || (c.inCheck() ? 'Check! ' : '') + (thinking ? 'The bot is thinking…' : 'Your move.')}
            </p>
            <p className="muted">You captured: {caps(color)} · Bot captured: {caps(color === 'w' ? 'b' : 'w')}</p>
            <div className="tree">{path.map((s, i) => (colorAt(i, startFen) === 'w' || i === 0 ? `${plyLabel(i, startFen)} ${s}` : s)).join(' ') || 'No moves yet.'}</div>
            <div className="row">
              <button onClick={undo} disabled={!path.length || over}>Undo</button>
              <button onClick={() => setFlip(!flip)}>Flip board</button>
              <button onClick={offerDraw} disabled={over || thinking || !path.length}>Offer draw</button>
              <button onClick={() => setEnd(`You resigned. ${color === 'w' ? 'Black' : 'White'} wins.`)} disabled={over}>Resign</button>
            </div>
            {over && rv && open && (
              <div>
                <h3>Opening report</h3>
                {rv.dev === undefined ? (
                  <p>You followed {open.name} for {rv.followed} {rv.followed === 1 ? 'move' : 'moves'}{rv.followed < path.length ? ', until the line ended' : ''}.</p>
                ) : (
                  <>
                    <p>You left the line at move {plyLabel(rv.dev, startFen)} {path[rv.dev]}.</p>
                    <p>Your repertoire plays {rv.expected!.map(k => k.san).join(' or ')} there. It continues: {cont(rv.expected![0]).join(' ')}</p>
                    <p>{verdict || 'Checking your move with Stockfish…'}</p>
                  </>
                )}
              </div>
            )}
            <button className="primary" onClick={() => { engRef.current?.cancel(); setStarted(false); setPath([]); setEnd(''); }}>New game</button>
          </>
        )}
      </div>
    </div>
  );
}
