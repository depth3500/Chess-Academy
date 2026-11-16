import { useState } from 'react';
import { Board } from '../components/Board';
import { N, Opening, addLine, colorAt, findNode, kidsAt, plyLabel, removeAt, replay, validFen } from '../lib/tree';

/** Renders the variation tree: the first continuation runs inline, alternatives appear in (brackets). */
function Line({ nodes, path, cur, pick, first, fen }: { nodes: N[]; path: string[]; cur: string[]; pick: (p: string[]) => void; first?: boolean; fen?: string }) {
  if (!nodes.length) return null;
  const [m, ...alts] = nodes;
  const p = [...path, m.san];
  const ply = path.length;
  const label = colorAt(ply, fen) === 'w' || first ? plyLabel(ply, fen) : '';
  return (
    <>
      <button className={'mv' + (p.join() === cur.join() ? ' on' : '')} onClick={() => pick(p)}>{label} {m.san}</button>
      {alts.map(a => <span className="alt" key={a.san}>(<Line nodes={[a]} path={path} cur={cur} pick={pick} first fen={fen} />)</span>)}
      <Line nodes={m.kids} path={p} cur={cur} pick={pick} first={alts.length > 0} fen={fen} />
    </>
  );
}

type Props = { o: Opening; save: (o: Opening) => void; onBack: () => void; onPractice: () => void };

export function Editor({ o, save, onBack, onPractice }: Props) {
  const [path, setPath] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [san, setSan] = useState('');
  const [fenText, setFenText] = useState(o.fen ?? '');
  const [fenErr, setFenErr] = useState('');
  const edit = (fn: (x: Opening) => void) => { const n = structuredClone(o); fn(n); save(n); };

  // Every move is validated by chess.js, then added to the tree at the current position.
  const play = (mv: string | { from: string; to: string; promotion?: string }) => {
    try {
      const m = replay(path, o.fen).move(mv);
      edit(x => addLine(x.tree, [...path, m.san]));
      setPath([...path, m.san]); setErr('');
      return true;
    } catch {
      setErr(`“${typeof mv === 'string' ? mv : mv.from + '-' + mv.to}” is not a legal move in this position.`);
      return false;
    }
  };

  const next = kidsAt(o.tree, path)[0];

  // A different start position invalidates the stored moves, so changing it clears them (after confirmation).
  const setStart = (v: string) => {
    if (v && !validFen(v)) { setFenErr('That is not a valid FEN.'); return; }
    if ((v || undefined) === o.fen) { setFenErr(''); return; }
    if (o.tree.length && !confirm('Changing the start position clears the moves in this opening. Continue?')) return;
    edit(x => { x.fen = v || undefined; x.tree = []; });
    setPath([]); setFenErr('');
  };

  return (
    <div className="split">
      <div>
        <Board path={path} fen={o.fen} side={o.side} onDrop={(f, t) => play({ from: f, to: t, promotion: 'q' })} />
        <div className="row">
          <button onClick={() => setPath([])} disabled={!path.length}>Start</button>
          <button onClick={() => setPath(path.slice(0, -1))} disabled={!path.length}>Back</button>
          <button onClick={() => next && setPath([...path, next.san])} disabled={!next}>Forward</button>
        </div>
        <form className="row" onSubmit={e => { e.preventDefault(); if (san.trim() && play(san.trim())) setSan(''); }}>
          <input value={san} onChange={e => setSan(e.target.value)} placeholder="Type a move, e.g. Nf3" aria-label="Move in algebraic notation" />
          <button>Add move</button>
        </form>
        {err && <p className="err" role="alert">{err}</p>}
      </div>
      <div className="panel">
        <input className="title" value={o.name} onChange={e => edit(x => { x.name = e.target.value; })} aria-label="Opening name" />
        <p className="muted">Play a move on the board to add it. Playing a different move from an earlier position creates a variation. Changes save automatically.</p>
        <form className="row" onSubmit={e => { e.preventDefault(); setStart(fenText.trim()); }}>
          <input value={fenText} onChange={e => setFenText(e.target.value)} placeholder="Start position FEN (blank = standard)" aria-label="Start position FEN" />
          <button>Set start</button>
        </form>
        {fenErr && <p className="err" role="alert">{fenErr}</p>}
        <div className="tree">
          {o.tree.length ? <Line nodes={o.tree} path={[]} cur={path} pick={setPath} fen={o.fen} /> : <span className="muted">No moves yet.</span>}
        </div>
        {path.length > 0 && (
          <textarea rows={3} placeholder="Add a note for this move (shown in lessons)" aria-label="Move note"
            value={findNode(o.tree, path)?.note ?? ''}
            onChange={e => edit(x => { const n = findNode(x.tree, path); if (n) n.note = e.target.value; })} />
        )}
        <div className="row">
          <button className="primary" onClick={onPractice} disabled={!o.tree.length}>Practice</button>
          <button disabled={!path.length} onClick={() => { edit(x => removeAt(x.tree, path)); setPath(path.slice(0, -1)); }}>Delete from here</button>
          <button onClick={onBack}>Back to openings</button>
        </div>
      </div>
    </div>
  );
}
