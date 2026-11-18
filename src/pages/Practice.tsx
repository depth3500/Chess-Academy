import { useEffect, useRef, useState } from 'react';
import { Board } from '../components/Board';
import { lineName } from '../lib/lines';
import { getSettings } from '../lib/settings';
import { play } from '../lib/sound';
import { Entry, applyReviews, logSession } from '../lib/store';
import { get } from 'idb-keyval';
import { Card, isDue } from '../lib/srs';
import { N, Opening, colorAt, kidsAt, matchKid, plyLabel, replay } from '../lib/tree';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const ZERO = { tries: 0, ok: 0, hints: 0, missed: [] as string[] };

export function Practice({ o, onExit, drill, line }: { o: Opening; onExit: () => void; drill?: boolean; line?: string[] }) {
  const S = getSettings();
  const [side, setSide] = useState<'w' | 'b'>(S.side === 'opening' ? o.side : S.side);
  const [hintsOn, setHintsOn] = useState(S.hints);
  const [path, setPath] = useState<string[]>([]);
  const [st, setSt] = useState(ZERO);
  const [hint, setHint] = useState('');
  const [msg, setMsg] = useState('');
  const [secs, setSecs] = useState<number | null>(null);
  const [due, setDue] = useState<Set<string>>(new Set());
  const t0 = useRef(Date.now());
  const wrong = useRef(0); // misses on the current move
  const hinted = useRef(false);
  const log = useRef<Entry[]>([]); // one entry per move you played, for the review schedule

  // Review mode: load the moves that are due, and let the opponent steer toward them.
  useEffect(() => {
    if (!drill) return;
    get('cards').then((c: Record<string, Card> | undefined) => {
      const now = Date.now();
      setDue(new Set(Object.entries(c ?? {}).filter(([k, v]) => k.startsWith(o.id + ':') && isDue(v, now)).map(([k]) => k)));
    });
  }, []);
  const hasDue = (n: N, p: string[]): boolean => {
    const q = [...p, n.san];
    return colorAt(q.length - 1, o.fen) === side && due.has(`${o.id}:${q.join(' ')}`) || n.kids.some(k => hasDue(k, q));
  };
  const choose = (ks: N[]) => {
    if (line && path.every((s, i) => s === line[i])) { const k = ks.find(x => x.san === line[path.length]); if (k) return k; } // steer along the chosen line
    const d = drill ? ks.filter(k => hasDue(k, path)) : [];
    const pool = d.length ? d : ks;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const turn = replay(path, o.fen).turn();
  const kids = kidsAt(o.tree, path);
  const done = secs !== null;

  const reset = (s: 'w' | 'b') => { setSide(s); setPath([]); setSt(ZERO); setHint(''); setMsg(''); setSecs(null); t0.current = Date.now(); wrong.current = 0; hinted.current = false; log.current = []; };

  useEffect(() => {
    if (done) return;
    if (!kids.length) { // end of the line: finish and store the session
      const s = Math.round((Date.now() - t0.current) / 1000);
      setSecs(s);
      logSession({ opening: o.id, name: o.name, side, at: Date.now(), seconds: s, ...st });
      applyReviews(log.current);
      play('end');
      return;
    }
    if (turn !== side) { // opponent replies with a random repertoire move
      const t = setTimeout(() => setPath(p => [...p, choose(kids).san]), 500);
      return () => clearTimeout(t);
    }
  }, [path, done, side, due]);

  const drop = (from: string, to: string) => {
    if (done) return false;
    if (turn !== side) return null; // you can pick pieces up while the opponent moves, but not place them
    const mv = { from, to, promotion: 'q' };
    let san: string;
    try { san = replay(path, o.fen).move(mv).san; } catch { setMsg('That move is not legal.'); return false; }
    setHint('');
    const k = matchKid(o.tree, path, mv, o.fen); // compares resulting positions, not notation
    if (k) {
      log.current.push({ key: `${o.id}:${[...path, k.san].join(' ')}`, opening: o.id, label: `${o.name}: ${plyLabel(path.length, o.fen)} ${k.san}`, wrong: wrong.current, hint: hinted.current });
      wrong.current = 0; hinted.current = false;
      setSt(s => ({ ...s, tries: s.tries + 1, ok: s.ok + 1 })); setMsg(''); setPath([...path, k.san]);
      return true;
    }
    const n = path.length;
    wrong.current++;
    const where = `${plyLabel(n, o.fen)} ${san} (expected ${kids.map(x => x.san).join(' or ')})`;
    setSt(s => ({ ...s, tries: s.tries + 1, missed: [...s.missed, where] }));
    setMsg('That move is not in this opening. Try again.');
    return false;
  };

  const showHint = () => { hinted.current = true; setSt(s => ({ ...s, hints: s.hints + 1 })); setHint(replay(path, o.fen).move(kids[0].san).from); };
  const acc = st.tries ? Math.round((st.ok / st.tries) * 1000) / 10 : null;

  return (
    <div className="split">
      <div>
        <Board path={path} fen={o.fen} side={side} onDrop={done ? undefined : drop} mine={side} extra={hint ? { [hint]: { boxShadow: 'inset 0 0 0 100px rgba(129,182,76,.65)' } } : undefined} />
        <p className={msg ? 'err' : 'muted'} role="status" style={{ marginTop: 10 }}>
          {msg || (done ? 'Line complete.' : turn === side ? 'Your move.' : 'Opponent is moving…')}
        </p>
      </div>
      <div className="panel">
        <h2>{o.name}</h2>
        {line && <p className="muted">Line: {lineName(o.tree, line, 0)}</p>}
        {drill && <p className="muted">Review mode: the opponent steers toward your {due.size} due {due.size === 1 ? 'move' : 'moves'}.</p>}
        <div className="row">
          <button className={side === 'w' ? 'primary' : ''} onClick={() => reset('w')}>Play as White</button>
          <button className={side === 'b' ? 'primary' : ''} onClick={() => reset('b')}>Play as Black</button>
        </div>
        {!done ? (
          <>
            <p className="muted">Play the moves from memory. Correct: {st.ok} · Incorrect: {st.tries - st.ok} · Hints: {st.hints}</p>
            <div className="row">
              <button onClick={showHint} disabled={turn !== side || !hintsOn}>Hint</button>
              <label className="check"><input type="checkbox" checked={hintsOn} onChange={e => setHintsOn(e.target.checked)} /> Hints</label>
              <button onClick={() => reset(side)}>Restart</button>
            </div>
          </>
        ) : (
          <>
            <dl className="stats">
              <div><dt>Moves attempted</dt><dd>{st.tries}</dd></div>
              <div><dt>Accuracy</dt><dd>{acc === null ? '—' : acc + '%'}</dd></div>
              <div><dt>Correct / incorrect</dt><dd>{st.ok} / {st.tries - st.ok}</dd></div>
              <div><dt>Hints · Time</dt><dd>{st.hints} · {fmt(secs!)}</dd></div>
            </dl>
            {st.missed.length > 0 && (<><h3>Missed positions</h3><ul>{st.missed.map((m, i) => <li key={i}>{m}</li>)}</ul></>)}
            <div className="row"><button className="primary" onClick={() => reset(side)}>Practice again</button></div>
          </>
        )}
        <button onClick={onExit}>Back to opening</button>
      </div>
    </div>
  );
}
