import { useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { N, Opening, lines, parseTree, uid, validFen } from '../lib/tree';

type Props = {
  list: Opening[];
  setList: Dispatch<SetStateAction<Opening[] | null>>;
  open: (id: string) => void;
  practice: (id: string) => void;
  learn: (id: string) => void;
  startNew?: boolean;
};

export function Library({ list, setList, open, practice, learn, startNew }: Props) {
  const [q, setQ] = useState('');
  const [side, setSide] = useState('');
  const [adding, setAdding] = useState(!!startNew);
  const [f, setF] = useState({ name: '', eco: '', side: 'w', text: '', fen: '' });
  const [err, setErr] = useState('');

  const shown = list.filter(o => (!side || o.side === side) && (o.name + ' ' + o.eco).toLowerCase().includes(q.toLowerCase()));

  const create = (e: FormEvent) => {
    e.preventDefault();
    try {
      const o: Opening = { id: uid(), name: f.name.trim() || 'Untitled opening', eco: f.eco.trim(), side: f.side as 'w' | 'b', tree: [] };
      const fen = f.fen.trim() || undefined;
      if (fen && !validFen(fen)) throw new Error('the start position is not a valid FEN');
      const g = f.text.trim() ? parseTree(f.text, fen) : { tree: [] as N[], fen };
      o.fen = g.fen;
      o.tree = g.tree;
      setList(l => [...(l ?? []), o]);
      setAdding(false); setErr(''); setF({ name: '', eco: '', side: 'w', text: '', fen: '' });
      open(o.id);
    } catch (x) {
      setErr('Those moves could not be read: ' + (x instanceof Error ? x.message : 'invalid notation') + '. Check the move order and try again.');
    }
  };

  const exportAll = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' }));
    a.download = 'chess-academy-backup.json';
    a.click();
  };

  return (
    <>
      <h1>Your openings</h1>
      <div className="bar">
        <input placeholder="Search by name or ECO code" value={q} onChange={e => setQ(e.target.value)} aria-label="Search openings" />
        <select value={side} onChange={e => setSide(e.target.value)} aria-label="Filter by side">
          <option value="">Both sides</option><option value="w">White</option><option value="b">Black</option>
        </select>
        <button className="primary" onClick={() => setAdding(!adding)}>New opening</button>
        <button onClick={exportAll}>Export backup</button>
      </div>

      {adding && (
        <form className="panel" onSubmit={create} style={{ marginBottom: 18 }}>
          <input placeholder="Opening name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} aria-label="Opening name" />
          <div className="row">
            <input placeholder="ECO (optional)" value={f.eco} onChange={e => setF({ ...f, eco: e.target.value })} aria-label="ECO code" />
            <select value={f.side} onChange={e => setF({ ...f, side: e.target.value })} aria-label="Side you play">
              <option value="w">I play White</option><option value="b">I play Black</option>
            </select>
          </div>
          <input placeholder="Start position FEN (optional)" value={f.fen} onChange={e => setF({ ...f, fen: e.target.value })} aria-label="Start position FEN" />
          <textarea rows={4} placeholder="Paste PGN (variations and comments are kept) or moves like 1. e4 e5 2. Nf3, or leave empty to build on the board" value={f.text} onChange={e => setF({ ...f, text: e.target.value })} />
          <input type="file" accept=".pgn,.txt" aria-label="Import PGN file" onChange={async e => { const t = await e.target.files?.[0]?.text(); if (t) setF(s => ({ ...s, text: t })); }} />
          {err && <p className="err" role="alert">{err}</p>}
          <div className="row"><button className="primary">Create opening</button><button type="button" onClick={() => setAdding(false)}>Cancel</button></div>
        </form>
      )}

      {shown.length ? (
        <div className="grid">
          {shown.map(o => (
            <article className="card" key={o.id}>
              <header><h3>{o.name}</h3><span className={'chip ' + o.side}>{o.side === 'w' ? 'White' : 'Black'}</span></header>
              <p className="muted">{o.eco || 'No ECO'} · {lines(o.tree)} {lines(o.tree) === 1 ? 'line' : 'lines'}{o.fen ? ' · custom start' : ''}</p>
              <div className="row">
                <button disabled={!lines(o.tree)} onClick={() => learn(o.id)}>Learn</button>
                <button className="primary" disabled={!lines(o.tree)} onClick={() => practice(o.id)}>Practice</button>
                <button onClick={() => open(o.id)}>Edit</button>
                <button onClick={() => setList(l => [...(l ?? []), { ...structuredClone(o), id: uid(), name: o.name + ' (copy)' }])}>Duplicate</button>
                <button onClick={() => confirm(`Delete “${o.name}”?`) && setList(l => (l ?? []).filter(x => x.id !== o.id))}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">No openings match. Clear the search, or create a new opening.</p>
      )}
    </>
  );
}
