import { useEffect, useRef, useState } from 'react';
import { get, set } from 'idb-keyval';
import type { Square } from 'chess.js';
import { Board } from '../components/Board';
import { EvalGraph } from '../components/EvalGraph';
import { analyseFens } from '../lib/analyze';
import { GameRef, Parsed, fetchChesscom, fetchLichess, fromPgn, outcome, parsePgn } from '../lib/importers';
import { CLASS_INFO, CLASS_ORDER, MoveClass, Review, buildReview, evalText, makeBook, winPct } from '../lib/review';

const DEPTHS: Record<string, { label: string; depth: number; ms: number }> = {
  fast: { label: 'Fast (depth 12)', depth: 12, ms: 1200 },
  standard: { label: 'Standard (depth 16)', depth: 16, ms: 2500 },
  deep: { label: 'Deep (depth 20)', depth: 20, ms: 6000 },
};
const A: Record<MoveClass, string> = { brilliant: 'a brilliant move', great: 'a great move', best: 'the best move', excellent: 'an excellent move', good: 'a good move', book: 'a book move', inaccuracy: 'an inaccuracy', mistake: 'a mistake', miss: 'a miss', blunder: 'a blunder' };
const BAD: MoveClass[] = ['mistake', 'blunder', 'miss'];

let bookP: Promise<ReturnType<typeof makeBook>> | null = null;
const loadBook = () => (bookP ??= import('../data/catalog.json').then(m => makeBook(m.default as unknown as Parameters<typeof makeBook>[0])));
const ls = (k: string) => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } };

type Active = { ref: GameRef; parsed: Parsed; review: Review | null; progress: number };

/** Free game review: import from chess.com, lichess or a PGN, then step through Stockfish's verdict on every move. */
export function ReviewPage() {
  const [tab, setTab] = useState<'chesscom' | 'lichess' | 'pgn'>('chesscom');
  const [user, setUser] = useState({ chesscom: ls('ca-chesscom'), lichess: ls('ca-lichess') });
  const [games, setGames] = useState<GameRef[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pgn, setPgn] = useState('');
  const [depthKey, setDepthKey] = useState('standard');
  const [cache, setCache] = useState<Record<string, Review>>({});
  const [active, setActive] = useState<Active | null>(null);
  const [ply, setPly] = useState(0);
  const [flip, setFlip] = useState(false);
  const token = useRef({ cancelled: false });
  useEffect(() => { get('reviews').then(r => setCache(r ?? {})); return () => { token.current.cancelled = true; }; }, []);

  const load = async () => {
    if (tab === 'pgn') return;
    setLoading(true); setError(''); setGames(null);
    try {
      const name = user[tab];
      setGames(tab === 'chesscom' ? await fetchChesscom(name) : await fetchLichess(name));
      try { localStorage.setItem('ca-' + tab, name.trim()); } catch { /* storage unavailable */ }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load games.'); }
    setLoading(false);
  };

  const run = async (ref: GameRef) => {
    token.current.cancelled = true;
    const tk = { cancelled: false };
    token.current = tk;
    setError('');
    let parsed: Parsed;
    try { parsed = parsePgn(ref.pgn); } catch (e) { setError('Could not read this game: ' + (e instanceof Error ? e.message : 'invalid PGN')); return; }
    const cfg = DEPTHS[depthKey], key = `${ref.id}:${cfg.depth}`, hit = cache[key];
    setActive({ ref, parsed, review: hit ?? null, progress: hit ? 1 : 0 });
    setPly(0); setFlip(ref.me === 'b');
    if (hit) return;
    try {
      const evals = await analyseFens(parsed.fens, { depth: cfg.depth, ms: cfg.ms, signal: tk, onProgress: (d, t) => setActive(a => (a && a.ref.id === ref.id ? { ...a, progress: d / t } : a)) });
      if (tk.cancelled) return;
      const book = await loadBook();
      const review = buildReview(parsed.sans, parsed.fens, evals, p => book(parsed.sans, p), cfg.depth);
      setActive(a => (a && a.ref.id === ref.id ? { ...a, review, progress: 1 } : a));
      setCache(c => { const n = Object.fromEntries(Object.entries({ ...c, [key]: review }).slice(-40)); void set('reviews', n); return n; });
    } catch (e) { setError('The analysis failed: ' + (e instanceof Error ? e.message : 'engine error')); }
  };

  const rv = active?.review ?? null, P = active?.parsed, ref = active?.ref;
  const total = P?.sans.length ?? 0;
  useEffect(() => {
    if (!active) return;
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') setPly(p => Math.max(0, p - 1));
      else if (e.key === 'ArrowRight') setPly(p => Math.min(total, p + 1));
      else if (e.key === 'Home') setPly(0);
      else if (e.key === 'End') setPly(total);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [active, total]);

  if (active && P && ref) {
    const m = rv && ply > 0 ? rv.moves[ply - 1] : null;
    const info = m ? CLASS_INFO[m.cls] : null;
    const wps = rv ? rv.wcp.map(winPct) : [];
    const curWp = rv ? wps[ply] : 50;
    const arrows: ([Square, Square, string])[] = [];
    if (m && info) {
      if (m.bestUci && m.bestUci !== m.uci) arrows.push([m.bestUci.slice(0, 2) as Square, m.bestUci.slice(2, 4) as Square, '#81b64ccc']);
      arrows.push([m.uci.slice(0, 2) as Square, m.uci.slice(2, 4) as Square, info.color + 'cc']);
    }
    const extra = m && info ? { [m.uci.slice(2, 4)]: { boxShadow: `inset 0 0 0 100px ${info.color}77` } } : undefined;
    const marks = rv ? rv.moves.map((x, i) => ({ ply: i + 1, cls: x.cls })).filter(x => ['blunder', 'mistake', 'miss', 'brilliant', 'great'].includes(x.cls)).map(x => ({ ply: x.ply, color: CLASS_INFO[x.cls].color })) : [];
    const jump = (dir: 1 | -1) => {
      if (!rv) return;
      const ok = (k: number) => BAD.includes(rv.moves[k].cls) && (!ref.me || rv.moves[k].color === ref.me);
      for (let k = ply - 1 + dir; k >= 0 && k < rv.moves.length; k += dir) if (ok(k)) { setPly(k + 1); return; }
    };
    const name = (c: 'w' | 'b') => (c === 'w' ? ref.white : ref.black);
    const rows = Array.from({ length: Math.ceil(total / 2) }, (_, i) => i * 2);

    return (
      <>
        <button className="link" onClick={() => { token.current.cancelled = true; setActive(null); }}>← All games</button>
        <div className="hubhead">
          <div>
            <h1>{ref.white} <span className="muted">vs</span> {ref.black}</h1>
            <p className="muted">{ref.wr ? `${ref.wr} · ${ref.br} · ` : ''}{ref.result}{rv?.opening ? ` · ${rv.opening}` : ''}{ref.url && <> · <a href={ref.url} target="_blank" rel="noreferrer">view original</a></>}</p>
          </div>
        </div>
        <div className="rv">
          <div>
            <div className="boardwrap">
              <div className={'evalbar' + (flip ? ' flip' : '')} aria-label="Evaluation bar" title={rv ? evalText(rv.wcp[ply], rv.wmate[ply]) : ''}>
                <div className="eb-white" style={{ height: `${curWp}%` }} />
                <span className="eb-text">{rv ? evalText(rv.wcp[ply], rv.wmate[ply]) : '…'}</span>
              </div>
              <Board path={P.sans.slice(0, ply)} fen={P.start} side={flip ? 'b' : 'w'} arrows={arrows} extra={extra} />
            </div>
            <div className="row">
              <button onClick={() => setPly(0)} aria-label="First move">⏮</button>
              <button onClick={() => setPly(Math.max(0, ply - 1))} aria-label="Previous move">◀</button>
              <button onClick={() => setPly(Math.min(total, ply + 1))} aria-label="Next move">▶</button>
              <button onClick={() => setPly(total)} aria-label="Last move">⏭</button>
              <button onClick={() => jump(-1)} disabled={!rv}>← Mistake</button>
              <button onClick={() => jump(1)} disabled={!rv}>Mistake →</button>
              <button onClick={() => setFlip(!flip)}>Flip</button>
            </div>
            {rv && <EvalGraph wps={wps} ply={ply} onPick={setPly} marks={marks} />}
          </div>

          <div className="panel">
            {!rv ? (
              <div className="progress"><strong>Analyzing with Stockfish… {Math.round(active.progress * 100)}%</strong><div className="bar2"><i style={{ width: `${active.progress * 100}%` }} /></div>
                <p className="muted">You can already step through the moves. The verdicts appear when it finishes.</p></div>
            ) : (
              <>
                <div className="accs">
                  {(['w', 'b'] as const).map(c => (
                    <div className="acard" key={c}><span className="muted">{name(c)}{ref.me === c ? ' (you)' : ''}</span><strong>{rv.acc[c].toFixed(1)}</strong><small>accuracy</small></div>
                  ))}
                </div>
                {ref.acc && (ref.acc.w || ref.acc.b) && <p className="muted">chess.com's own review: {ref.acc.w ?? '—'} / {ref.acc.b ?? '—'}</p>}
                <div className="note">
                  {m && info ? (
                    <>
                      <p><span className="ico" style={{ background: info.color }}>{info.icon}</span> <strong style={{ color: info.color }}>{m.san} is {A[m.cls]}.</strong></p>
                      {m.cls === 'book' ? <p className="muted">{m.opening}</p> : m.best && m.bestUci !== m.uci ? <p className="muted">Best was <strong>{m.best}</strong>{m.line.length > 1 ? `. Engine line: ${m.line.join(' ')}` : ''}</p> : null}
                      <p className="muted">Evaluation {evalText(rv.wcp[ply], rv.wmate[ply])}</p>
                    </>
                  ) : <p className="muted">Step through the game with the arrow keys or the buttons.</p>}
                </div>
              </>
            )}
            <div className="mlist">
              {rows.map(i => (
                <div className="mrow" key={i}>
                  <span className="mn">{i / 2 + 1}.</span>
                  {[i, i + 1].filter(k => k < total).map(k => (
                    <button key={k} className={'mv2' + (ply === k + 1 ? ' on' : '')} onClick={() => setPly(k + 1)}>
                      {rv && <i className="ico" style={{ background: CLASS_INFO[rv.moves[k].cls].color }} title={CLASS_INFO[rv.moves[k].cls].label}>{CLASS_INFO[rv.moves[k].cls].icon}</i>}{P.sans[k]}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            {rv && (
              <table className="ctable">
                <thead><tr><th>Move type</th><th>{ref.white}</th><th>{ref.black}</th></tr></thead>
                <tbody>{CLASS_ORDER.filter(c => (rv.counts.w[c] ?? 0) + (rv.counts.b[c] ?? 0) > 0).map(c => (
                  <tr key={c}><td><i className="ico" style={{ background: CLASS_INFO[c].color }}>{CLASS_INFO[c].icon}</i> {CLASS_INFO[c].label}</td><td>{rv.counts.w[c] ?? 0}</td><td>{rv.counts.b[c] ?? 0}</td></tr>
                ))}</tbody>
              </table>
            )}
            {error && <p className="err" role="alert">{error}</p>}
          </div>
        </div>
      </>
    );
  }

  const cfgDepth = DEPTHS[depthKey].depth;
  return (
    <>
      <h1>Game review</h1>
      <p className="lead">Free Stockfish analysis of your games: accuracy, move-by-move verdicts (Brilliant to Blunder), an evaluation graph and the best moves. Everything runs in your browser.</p>
      <div className="chips" role="tablist" aria-label="Game source">
        {([['chesscom', 'chess.com'], ['lichess', 'Lichess'], ['pgn', 'Paste PGN']] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={'chipbtn' + (tab === id ? ' on' : '')} onClick={() => { setTab(id); setGames(null); setError(''); }}>{label}</button>
        ))}
        <select value={depthKey} onChange={e => setDepthKey(e.target.value)} aria-label="Analysis depth">{Object.entries(DEPTHS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
      </div>

      {tab === 'pgn' ? (
        <div className="panel">
          <textarea rows={8} placeholder="Paste a PGN here" value={pgn} onChange={e => setPgn(e.target.value)} aria-label="PGN" />
          <input type="file" accept=".pgn,.txt" aria-label="Open a PGN file" onChange={async e => { const t = await e.target.files?.[0]?.text(); if (t) setPgn(t); }} />
          <div className="row"><button className="primary" disabled={!pgn.trim()} onClick={() => { try { void run(fromPgn(pgn)); } catch (e) { setError('Could not read this PGN: ' + (e instanceof Error ? e.message : 'invalid')); } }}>Review this game</button></div>
        </div>
      ) : (
        <form className="bar" onSubmit={e => { e.preventDefault(); void load(); }}>
          <input placeholder={tab === 'chesscom' ? 'Your chess.com username' : 'Your lichess username'} value={user[tab]} onChange={e => setUser({ ...user, [tab]: e.target.value })} aria-label="Username" autoCapitalize="none" autoCorrect="off" />
          <button className="primary" disabled={loading || !user[tab].trim()}>{loading ? 'Loading…' : 'Load my games'}</button>
        </form>
      )}
      {error && <p className="err" role="alert">{error}</p>}

      {games && (
        <ul className="games">
          {games.map(g => {
            const r = cache[`${g.id}:${cfgDepth}`], opp = g.me === 'w' ? g.black : g.me === 'b' ? g.white : `${g.white} vs ${g.black}`;
            const oppR = g.me === 'w' ? g.br : g.me === 'b' ? g.wr : undefined;
            return (
              <li className="game" key={g.id}>
                <span className={'chip res ' + outcome(g).toLowerCase()}>{outcome(g) || g.result}</span>
                <div className="gm"><strong>{g.me ? 'vs ' : ''}{opp}</strong><span className="muted">{oppR ? `${oppR} · ` : ''}{g.speed ?? ''} · {new Date(g.at).toLocaleDateString()}{g.me ? ` · you were ${g.me === 'w' ? 'White' : 'Black'}` : ''}</span></div>
                {r && g.me && <span className="chip plain">Reviewed · {r.acc[g.me].toFixed(0)}%</span>}
                <button className="primary" onClick={() => void run(g)}>{r ? 'Open review' : 'Review'}</button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
