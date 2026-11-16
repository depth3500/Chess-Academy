import { useEffect, useRef, useState } from 'react';
import type { Square } from 'chess.js';
import { Board } from '../components/Board';
import { NAME, explain, idea, moveAt } from '../lib/explain';
import { logLesson } from '../lib/store';
import { Opening, allLines, colorAt, findNode, kidsAt, matchKid, plyLabel } from '../lib/tree';

const side = (c: string) => (c === 'w' ? 'White' : 'Black');
type Mode = 'study' | 'quiz';

export function Learn({ o, onExit, onPractice }: { o: Opening; onExit: () => void; onPractice: () => void }) {
  const all = allLines(o.tree);
  const [li, setLi] = useState(0);
  const [ply, setPly] = useState(0);
  const [mode, setMode] = useState<Mode>('study');
  const [skip, setSkip] = useState(false);
  const [peek, setPeek] = useState(false);
  const [hint, setHint] = useState(0);
  const [msg, setMsg] = useState('');
  const [score, setScore] = useState({ ok: 0, n: 0 });
  const missed = useRef(false);

  const L = all[li] ?? [];
  const cur = L.slice(0, ply);
  const turn = colorAt(ply, o.fen);
  const finished = ply >= L.length;
  const userTurn = mode === 'quiz' && !finished && turn === o.side;
  const go = (l: number, m: Mode) => { setLi(l); setMode(m); setPly(0); setHint(0); setMsg(''); setScore({ ok: 0, n: 0 }); missed.current = false; };

  // In the quiz the opponent's moves play themselves after a short pause.
  useEffect(() => {
    if (mode !== 'quiz' || finished || turn === o.side) return;
    const t = setTimeout(() => setPly(p => p + 1), 600);
    return () => clearTimeout(t);
  }, [mode, ply, li]);

  useEffect(() => {
    if (mode === 'quiz' && finished && score.n) logLesson({ opening: o.id, name: o.name, at: Date.now(), ok: score.ok, total: score.n });
  }, [finished]);

  const drop = (f: string, t: string) => {
    if (!userTurn) return null;
    const k = matchKid(o.tree, cur, { from: f, to: t, promotion: 'q' }, o.fen);
    if (k && k.san === L[ply]) {
      setScore(s => ({ ok: s.ok + (missed.current ? 0 : 1), n: s.n + 1 }));
      missed.current = false; setHint(0); setMsg('Correct!'); setPly(ply + 1);
      return true;
    }
    missed.current = true; setHint(h => Math.max(h, 1));
    setMsg(k ? 'That is a repertoire move, but this lesson follows a different variation. Try again.' : 'Not the book move. Try again.');
    return false;
  };

  const answer = userTurn ? moveAt([...cur, L[ply]], o.fen) : null;
  const upcoming = !userTurn && mode === 'study' && peek && ply < L.length ? moveAt([...cur, L[ply]], o.fen) : null;
  const arrows: [Square, Square][] | undefined = answer && hint >= 3 ? [[answer.from, answer.to]] : upcoming ? [[upcoming.from, upcoming.to]] : undefined;
  const node = findNode(o.tree, cur);
  const replies = kidsAt(o.tree, cur).map(k => k.san);

  return (
    <div className="split">
      <Board path={cur} fen={o.fen} arrows={arrows} side={o.side} onDrop={mode === 'quiz' && !finished ? drop : undefined} mine={o.side} />
      <div className="panel">
        <h2>{o.name}</h2>
        <div className="row">
          <button className={mode === 'study' ? 'primary' : ''} onClick={() => go(li, 'study')}>Study</button>
          <button className={mode === 'quiz' ? 'primary' : ''} onClick={() => go(li, 'quiz')}>Quiz</button>
        </div>
        <label>Line
          <select value={li} onChange={e => go(+e.target.value, mode)}>
            {all.map((l, i) => <option key={i} value={i}>{i + 1}. …{l.slice(-3).join(' ')} ({l.length} moves)</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={skip} onChange={e => setSkip(e.target.checked)} /> Skip explanations, just memorize</label>
        <label className="check"><input type="checkbox" checked={peek} onChange={e => setPeek(e.target.checked)} /> Show the next move on the board (study)</label>

        {answer && (
          <div>
            <p><strong>What is the best move for {side(turn)} here?</strong></p>
            {hint >= 1 && <p className="muted">Hint: {idea(answer)}</p>}
            {hint >= 2 && <p className="muted">Move your {NAME[answer.piece]}.</p>}
            {hint >= 3 && <p className="muted">The move is {answer.san}.</p>}
            <button onClick={() => setHint(h => Math.min(3, h + 1))} disabled={hint >= 3}>{hint ? 'Another hint' : 'Hint'}</button>
          </div>
        )}
        {msg && <p className={msg === 'Correct!' ? 'ok' : 'err'} role="status">{msg}</p>}
        {finished && <p><strong>{mode === 'quiz' ? `Lesson complete: ${score.ok} of ${score.n} correct on the first try.` : 'End of this line.'}</strong></p>}

        {!skip && ply > 0 && (
          <div>
            <h3>{side(turn === 'w' ? 'b' : 'w')} played {L[ply - 1]}</h3>
            <ul>{explain(cur, o.fen).map((t, i) => <li key={i}>{t}</li>)}</ul>
            {node?.note && <p><em>Your note:</em> {node.note}</p>}
            {mode === 'study' && replies.length > 0 && <p className="muted">Replies in your repertoire: {replies.join(' or ')}</p>}
          </div>
        )}

        <div className="tree">
          {L.slice(0, mode === 'quiz' ? ply : L.length).map((s, i) => (
            <button key={i} className={'mv' + (i === ply - 1 ? ' on' : '')} disabled={mode === 'quiz'} onClick={() => setPly(i + 1)}>{colorAt(i, o.fen) === 'w' || i === 0 ? plyLabel(i, o.fen) : ''} {s}</button>
          ))}
        </div>
        <div className="row">
          <button onClick={() => setPly(ply - 1)} disabled={mode === 'quiz' || !ply}>Back</button>
          <button onClick={() => setPly(ply + 1)} disabled={mode === 'quiz' || finished}>Next</button>
          <button className="primary" onClick={onPractice}>Practice this opening</button>
          <button onClick={onExit}>Back to openings</button>
        </div>
      </div>
    </div>
  );
}
