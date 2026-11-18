import { useMemo, useState } from 'react';
import { Leanings } from '../components/Leanings';
import { MiniBoard } from '../components/MiniBoard';
import { describe, leaning } from '../data/leanings';
import { lineInfo, progress } from '../lib/lines';
import { useData } from '../lib/store';
import type { Opening } from '../lib/tree';

type Status = 'all' | 'new' | 'learning' | 'learned';
const LABEL = { new: 'New', learning: 'Learning', learned: 'Learned' };
type Props = {
  o: Opening; fav: boolean; toggleFav: () => void;
  go: { learn: (line: number) => void; practice: (line?: number, drill?: boolean) => void; edit: () => void; back: () => void };
};

/** One opening's home: progress, style, and every named line you can learn or practice. */
export function OpeningHub({ o, fav, toggleFav, go }: Props) {
  const d = useData();
  const [q, setQ] = useState('');
  const [f, setF] = useState<Status>('all');
  const [sel, setSel] = useState(0);
  const [shown, setShown] = useState(40);
  const infos = useMemo(() => (d ? lineInfo(o, d.cards) : []), [o, d]);
  if (!d) return <p className="muted">Loading…</p>;

  const { learned, total } = progress(infos);
  const lean = leaning(o.name.split(':')[0], o.side, total);
  const next = infos.find(l => l.status !== 'learned');
  const due = infos.filter(l => l.due).length;
  const cur = infos[sel] ?? infos[0];
  const rows = infos.filter(l => (f === 'all' || l.status === f) && (l.name + ' ' + l.sans.join(' ')).toLowerCase().includes(q.toLowerCase()));
  const count = (s: Status) => (s === 'all' ? infos.length : infos.filter(l => l.status === s).length);

  return (
    <>
      <button className="link" onClick={go.back}>← My openings</button>
      <div className="hubhead">
        <div><h1>{o.name}</h1><p className="muted">{o.eco || 'Custom'} · you play {o.side === 'w' ? 'White' : 'Black'}{o.fen ? ' · custom start' : ''}</p></div>
        <button className={'star big' + (fav ? ' on' : '')} onClick={toggleFav} aria-pressed={fav} aria-label={fav ? 'Remove from favorites' : 'Add to favorites'} title="Favorite">★</button>
      </div>
      <div className="split">
        <div className="panel">
          <div className="preview"><MiniBoard sans={cur?.sans ?? []} side={o.side} fen={o.fen} /></div>
          <p className="muted">{cur ? `${cur.name} · ${cur.sans.length} moves` : 'No lines yet. Add some in the editor.'}</p>
          <Leanings l={lean} />
          <p className="muted">{describe(lean)}</p>
        </div>
        <div className="panel">
          <div className="progress">
            <div className="row between"><strong>{learned} of {total} {total === 1 ? 'line' : 'lines'} learned</strong><span className="muted">{total ? Math.round((learned / total) * 100) : 0}%</span></div>
            <div className="bar2"><i style={{ width: `${total ? (learned / total) * 100 : 0}%` }} /></div>
          </div>
          <div className="row">
            <button className="primary" disabled={!next} onClick={() => next && go.learn(next.i)}>{learned ? 'Continue learning' : 'Start learning'}</button>
            <button disabled={!total} onClick={() => go.practice()}>Practice all lines</button>
            {due > 0 && <button onClick={() => go.practice(undefined, true)}>Review {due} due</button>}
            <button onClick={go.edit}>Edit lines</button>
          </div>
          <div className="bar">
            <input placeholder="Search lines or moves" value={q} onChange={e => { setQ(e.target.value); setShown(40); }} aria-label="Search lines" />
          </div>
          <div className="chips" role="group" aria-label="Filter by status">
            {(['all', 'new', 'learning', 'learned'] as Status[]).map(s => (
              <button key={s} className={'chipbtn' + (f === s ? ' on' : '')} aria-pressed={f === s} onClick={() => { setF(s); setShown(40); }}>{s === 'all' ? 'All' : LABEL[s]} · {count(s)}</button>
            ))}
          </div>
          <ul className="lines">
            {rows.slice(0, shown).map(l => (
              <li key={l.i} className={sel === l.i ? 'on' : ''} onClick={() => setSel(l.i)}>
                <div className="lname"><strong>{l.name}</strong><span className="muted">{l.sans.length} moves · …{l.sans.slice(-4).join(' ')}</span></div>
                <span className={'chip st ' + l.status}>{l.due ? 'Due' : LABEL[l.status]}</span>
                <button onClick={e => { e.stopPropagation(); go.learn(l.i); }}>Learn</button>
                <button onClick={e => { e.stopPropagation(); go.practice(l.i); }}>Practice</button>
              </li>
            ))}
          </ul>
          {!rows.length && <p className="muted">No lines match.</p>}
          {shown < rows.length && <div className="row center"><button onClick={() => setShown(shown + 60)}>Show more ({rows.length - shown} left)</button></div>}
        </div>
      </div>
    </>
  );
}
