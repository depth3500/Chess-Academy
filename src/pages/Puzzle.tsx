import { useEffect, useRef, useState } from 'react';
import { Board } from '../components/Board';
import { play } from '../lib/sound';
import { logPuzzle } from '../lib/store';
import { Puzzle, RANGES, dailyPuzzle, randomPuzzle } from '../lib/puzzles';
import { replay } from '../lib/tree';

/** Find the winning move. Ratings are estimates from how deep the engine has to search, not rated-player statistics. */
export function PuzzlePage() {
  const [pz, setPz] = useState<Puzzle>(dailyPuzzle());
  const [daily, setDaily] = useState(true);
  const [range, setRange] = useState('any');
  const [path, setPath] = useState<string[]>([]);
  const [status, setStatus] = useState<'solving' | 'solved' | 'revealed'>('solving');
  const [msg, setMsg] = useState('');
  const [hint, setHint] = useState('');
  const misses = useRef(0);
  const logged = useRef(false);
  const mine = path.length % 2 === 0;

  const load = (p: Puzzle, isDaily: boolean) => { setPz(p); setDaily(isDaily); setPath([]); setStatus('solving'); setMsg(''); setHint(''); misses.current = 0; logged.current = false; };
  const finish = (ok: boolean, st: 'solved' | 'revealed') => {
    setStatus(st);
    if (!logged.current) { logged.current = true; void logPuzzle({ at: Date.now(), opening: String(pz.id), ok, daily }); }
    play(ok ? 'win' : 'lose');
  };

  // The opponent's replies in a mating sequence play themselves.
  useEffect(() => {
    if (status !== 'solving' || mine || path.length >= pz.sol.length) return;
    const id = setTimeout(() => setPath(p => [...p, pz.sol[p.length]]), 550);
    return () => clearTimeout(id);
  }, [path, status]);

  const drop = (f: string, t: string) => {
    if (status !== 'solving') return null;
    if (!mine) return null;
    try {
      const m = replay(path, pz.fen).move({ from: f, to: t, promotion: 'q' });
      const right = m.san === pz.sol[path.length] || (pz.mate > 0 && m.san.endsWith('#'));
      if (!right) { misses.current++; setMsg('Not the winning move. Try again.'); return false; }
      const np = [...path, m.san];
      setPath(np); setMsg(''); setHint('');
      if (np.length >= pz.sol.length || m.san.endsWith('#')) finish(misses.current === 0, 'solved');
      return true;
    } catch { return false; }
  };
  const showHint = () => setHint(replay(path, pz.fen).move(pz.sol[path.length]).from);
  const reveal = () => { setPath(pz.sol); setHint(''); finish(false, 'revealed'); };

  return (
    <>
      <h1>{daily ? 'Daily puzzle' : 'Puzzle'}</h1>
      <p className="lead">{daily ? 'A new puzzle every day, from easy to hard. Come back tomorrow for the next one.' : 'Pick a difficulty and keep going.'}</p>
      <div className="split">
        <div>
          <Board path={path} fen={pz.fen} side={pz.side} mine={pz.side} onDrop={status === 'solving' ? drop : undefined}
            extra={hint ? { [hint]: { boxShadow: 'inset 0 0 0 100px rgba(255,214,10,.45)' } } : undefined} />
        </div>
        <div className="panel">
          <div className="chips"><span className={'chip ' + pz.side}>{pz.side === 'w' ? 'White' : 'Black'} to move</span><span className="chip plain">≈ {pz.r} (estimated)</span><span className="chip plain">{pz.t}</span></div>
          <p role="status" className={status === 'solving' ? (msg ? 'err' : 'muted') : 'ok'}>
            {status === 'solved' ? (misses.current === 0 ? 'Solved on the first try. ' : 'Solved. ') + 'Well done.' : status === 'revealed' ? 'Solution shown.' : msg || (mine ? 'Find the best move.' : '…')}
          </p>
          {status !== 'solving' && <p className="muted">Winning line: {pz.line.join(' ')}</p>}
          <div className="row">
            <button onClick={showHint} disabled={status !== 'solving' || !mine}>Hint</button>
            <button onClick={reveal} disabled={status !== 'solving'}>Show solution</button>
          </div>
          <div className="row">
            <select value={range} onChange={e => setRange(e.target.value)} aria-label="Difficulty">{RANGES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
            <button className="primary" onClick={() => load(randomPuzzle(range, pz.id), false)}>Next puzzle</button>
            {!daily && <button onClick={() => load(dailyPuzzle(), true)}>Today's puzzle</button>}
          </div>
        </div>
      </div>
    </>
  );
}
