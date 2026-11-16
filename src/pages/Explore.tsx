import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Chessboard } from 'react-chessboard';
import { BOARD_THEMES } from '../components/Board';
import { DESC } from '../data/descriptions';
import { useSettings } from '../lib/settings';
import { Opening, addLine, replay } from '../lib/tree';

type Fam = { n: string; e: string; s: 'w' | 'b'; c: number; l: [string, string][] };
const slug = (f: Fam) => `cat-${f.n.toLowerCase().replace(/\W+/g, '-')}-${f.s}`;

function Preview({ f }: { f: Fam }) {
  const [dark, light] = BOARD_THEMES[useSettings().board];
  const main = (f.l.find(x => x[0] === '') ?? f.l[0])[1].split(' ');
  return (
    <Chessboard position={replay(main).fen()} arePiecesDraggable={false} animationDuration={0} showBoardNotation={false}
      boardOrientation={f.s === 'w' ? 'white' : 'black'} customDarkSquareStyle={{ backgroundColor: dark }} customLightSquareStyle={{ backgroundColor: light }} />
  );
}

type Props = { list: Opening[]; setList: Dispatch<SetStateAction<Opening[] | null>>; learn: (id: string) => void };

/** Browse every opening family from the open lichess database and add it to your repertoire in one click. */
export function Explore({ list, setList, learn }: Props) {
  const [cat, setCat] = useState<Fam[] | null>(null);
  const [q, setQ] = useState('');
  const [side, setSide] = useState('');
  const [sort, setSort] = useState('lines');
  const [shown, setShown] = useState(24);
  useEffect(() => { import('../data/catalog.json').then(m => setCat(m.default as Fam[])); }, []);
  if (!cat) return <p className="muted">Loading the opening catalog…</p>;

  const rows = cat.filter(f => (!side || f.s === side) && (f.n + ' ' + f.e).toLowerCase().includes(q.toLowerCase()))
    .sort(sort === 'name' ? (a, b) => a.n.localeCompare(b.n) : (a, b) => b.c - a.c);
  const have = (f: Fam) => list.find(o => o.id === slug(f));
  const add = (f: Fam) => {
    const o: Opening = { id: slug(f), name: f.n, eco: f.e, side: f.s, tree: [] };
    f.l.forEach(([, m]) => addLine(o.tree, m.split(' ')));
    setList(l => [...(l ?? []), o]);
  };
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setShown(24); };

  return (
    <>
      <h1>Explore openings</h1>
      <p className="lead">{cat.length} opening families and {cat.reduce((a, f) => a + f.l.length, 0).toLocaleString()} named lines from the open lichess database. Add any family to your repertoire to learn and practice it.</p>
      <div className="bar">
        <input placeholder="Search openings or ECO codes" value={q} onChange={e => reset(setQ)(e.target.value)} aria-label="Search the catalog" />
        <select value={side} onChange={e => reset(setSide)(e.target.value)} aria-label="Filter by side">
          <option value="">Both sides</option><option value="w">Play as White</option><option value="b">Play as Black</option>
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">
          <option value="lines">Most lines</option><option value="name">A to Z</option>
        </select>
      </div>
      <div className="grid cat">
        {rows.slice(0, shown).map(f => (
          <article className="card oc" key={f.n}>
            <div className="preview"><Preview f={f} /></div>
            <header><h3>{f.n}</h3><span className={'chip ' + f.s}>{f.s === 'w' ? 'White' : 'Black'}</span></header>
            <p className="muted desc">{DESC[f.n] ?? `A ${f.s === 'w' ? 'White' : 'Black'} system from ECO ${f.e}.`}</p>
            <p className="meta">{f.e} · {f.c} {f.c === 1 ? 'line' : 'lines'}</p>
            {have(f) ? <button onClick={() => learn(have(f)!.id)}>In your repertoire · Learn</button> : <button className="primary" onClick={() => add(f)}>Add to repertoire</button>}
          </article>
        ))}
      </div>
      {!rows.length && <p className="muted">No openings match your search.</p>}
      {shown < rows.length && <div className="row center"><button onClick={() => setShown(shown + 24)}>Show more ({rows.length - shown} left)</button></div>}
    </>
  );
}
