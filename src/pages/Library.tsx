import { useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { Leanings } from '../components/Leanings';
import { MiniBoard } from '../components/MiniBoard';
import { leaning } from '../data/leanings';
import { lineInfo, progress } from '../lib/lines';
import { useData } from '../lib/store';
import { N, Opening, allLines, parseTree, uid, validFen } from '../lib/tree';

type Props = {
  list: Opening[]; setList: Dispatch<SetStateAction<Opening[] | null>>; favs: string[]; toggleFav: (id: string) => void;
  hub: (id: string) => void; edit: (id: string) => void; startNew?: boolean;
};

/** My openings: your favorites, your own openings and anything you have trained. */
export function Library({ list, setList, favs, toggleFav, hub, edit, startNew }: Props) {
  const d = useData();
  const [q, setQ] = useState('');
  const [side, setSide] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [adding, setAdding] = useState(!!startNew);
  const [f, setF] = useState({ name: '', eco: '', side: 'w', text: '', fen: '' });
  const [err, setErr] = useState('');

  const trained = (o: Opening) => !!d && Object.keys(d.cards).some(k => k.startsWith(o.id + ':'));
  const shown = list.filter(o => (!o.tmp || favs.includes(o.id) || trained(o)) && (!side || o.side === side) && (!favOnly || favs.includes(o.id))
    && (o.name + ' ' + o.eco).toLowerCase().includes(q.toLowerCase()));

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
      edit(o.id);
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
      <h1>My openings</h1>
      <p className="lead">Star openings in Explore to keep them here, or add your own from a PGN.</p>
      <div className="bar">
        <input placeholder="Search your openings" value={q} onChange={e => setQ(e.target.value)} aria-label="Search openings" />
        <select value={side} onChange={e => setSide(e.target.value)} aria-label="Filter by side"><option value="">Both sides</option><option value="w">White</option><option value="b">Black</option></select>
        <button className={'chipbtn' + (favOnly ? ' on' : '')} aria-pressed={favOnly} onClick={() => setFavOnly(!favOnly)}>★ Favorites</button>
        <button className="primary" onClick={() => setAdding(!adding)}>New opening</button>
        <button onClick={exportAll}>Export</button>
      </div>

      {adding && (
        <form className="panel" onSubmit={create} style={{ marginBottom: 18 }}>
          <input placeholder="Opening name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} aria-label="Opening name" />
          <div className="row">
            <input placeholder="ECO (optional)" value={f.eco} onChange={e => setF({ ...f, eco: e.target.value })} aria-label="ECO code" />
            <select value={f.side} onChange={e => setF({ ...f, side: e.target.value })} aria-label="Side you play"><option value="w">I play White</option><option value="b">I play Black</option></select>
          </div>
          <input placeholder="Start position FEN (optional)" value={f.fen} onChange={e => setF({ ...f, fen: e.target.value })} aria-label="Start position FEN" />
          <textarea rows={4} placeholder="Paste PGN (variations and comments are kept) or moves like 1. e4 e5 2. Nf3, or leave empty to build on the board" value={f.text} onChange={e => setF({ ...f, text: e.target.value })} />
          <input type="file" accept=".pgn,.txt" aria-label="Import PGN file" onChange={async e => { const t = await e.target.files?.[0]?.text(); if (t) setF(s => ({ ...s, text: t })); }} />
          {err && <p className="err" role="alert">{err}</p>}
          <div className="row"><button className="primary">Create opening</button><button type="button" onClick={() => setAdding(false)}>Cancel</button></div>
        </form>
      )}

      {shown.length ? (
        <div className="grid cat">
          {shown.map(o => {
            const p = d ? progress(lineInfo(o, d.cards)) : { learned: 0, total: allLines(o.tree).length };
            const fav = favs.includes(o.id);
            return (
              <article className="card oc" key={o.id}>
                <div className="preview click" onClick={() => hub(o.id)}><MiniBoard sans={(allLines(o.tree)[0] ?? []).slice(0, 10)} side={o.side} fen={o.fen} /></div>
                <header><h3>{o.name}</h3><button className={'star' + (fav ? ' on' : '')} onClick={() => toggleFav(o.id)} aria-pressed={fav} aria-label={fav ? `Remove ${o.name} from favorites` : `Add ${o.name} to favorites`}>★</button></header>
                <div className="chips"><span className={'chip ' + o.side}>{o.side === 'w' ? 'White' : 'Black'}</span>{o.eco && <span className="chip plain">{o.eco}</span>}</div>
                <div className="progress sm">
                  <span className="muted">{p.learned} of {p.total} {p.total === 1 ? 'line' : 'lines'} learned</span>
                  <div className="bar2"><i style={{ width: `${p.total ? (p.learned / p.total) * 100 : 0}%` }} /></div>
                </div>
                <Leanings compact l={leaning(o.name.split(':')[0], o.side, p.total)} />
                <div className="row">
                  <button className="primary" onClick={() => hub(o.id)}>Open</button>
                  <button onClick={() => edit(o.id)}>Edit</button>
                  <button onClick={() => setList(l => [...(l ?? []), { ...structuredClone(o), id: uid(), name: o.name + ' (copy)', tmp: undefined }])}>Duplicate</button>
                  <button onClick={() => confirm(`Delete “${o.name}”?`) && setList(l => (l ?? []).filter(x => x.id !== o.id))}>Delete</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty"><h3>Nothing here yet</h3><p className="muted">Open the Explore page, try some openings and star the ones you like, or create your own.</p></div>
      )}
    </>
  );
}
