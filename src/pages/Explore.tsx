import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Leanings } from '../components/Leanings';
import { MiniBoard } from '../components/MiniBoard';
import { DESC } from '../data/descriptions';
import { Leaning, leaning } from '../data/leanings';
import { Opening, addLine } from '../lib/tree';

type Fam = { n: string; e: string; s: 'w' | 'b'; c: number; l: [string, string][] };
export const slug = (f: Fam) => `cat-${f.n.toLowerCase().replace(/\W+/g, '-')}-${f.s}`;

const TAGS: [string, string, (l: Leaning) => boolean][] = [
  ['tactical', 'Tactical', l => l.pt >= 20], ['positional', 'Positional', l => l.pt <= -20],
  ['aggressive', 'Aggressive', l => l.da >= 20], ['solid', 'Solid', l => l.da <= -20],
  ['easy', 'Easy to learn', l => l.eb <= -20], ['deep', 'Deep theory', l => l.eb >= 40],
];
const FIRST: [string, string][] = [['', 'Any first move'], ['e4', '1.e4'], ['d4', '1.d4'], ['c4', '1.c4'], ['Nf3', '1.Nf3'], ['other', 'Other']];
const SORTS: [string, string][] = [['lines', 'Most lines'], ['name', 'A to Z'], ['tactical', 'Most tactical'], ['positional', 'Most positional'], ['easy', 'Easiest first']];

type Props = { list: Opening[]; setList: Dispatch<SetStateAction<Opening[] | null>>; favs: string[]; toggleFav: (id: string) => void; open: (id: string) => void };

/** Browse every opening family from the open lichess database. Opening one (or favoriting it) adds it to your openings. */
export function Explore({ list, setList, favs, toggleFav, open }: Props) {
  const [cat, setCat] = useState<Fam[] | null>(null);
  const [q, setQ] = useState('');
  const [side, setSide] = useState('');
  const [first, setFirst] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState('lines');
  const [shown, setShown] = useState(24);
  useEffect(() => { import('../data/catalog.json').then(m => setCat(m.default as Fam[])); }, []);

  const items = useMemo(() => (cat ?? []).map(f => {
    const main = (f.l.find(x => x[0] === '') ?? f.l[0])[1].split(' ');
    const m = main[0];
    return { f, main, lean: leaning(f.n, f.s, f.c), first: ['e4', 'd4', 'c4', 'Nf3'].includes(m) ? m : 'other' };
  }), [cat]);
  if (!cat) return <p className="muted">Loading the opening catalog…</p>;

  const rows = items.filter(x => (!side || x.f.s === side) && (!first || x.first === first) && (!favOnly || favs.includes(slug(x.f)))
    && tags.every(t => TAGS.find(g => g[0] === t)![2](x.lean)) && (x.f.n + ' ' + x.f.e).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === 'name' ? a.f.n.localeCompare(b.f.n) : sort === 'tactical' ? b.lean.pt - a.lean.pt : sort === 'positional' ? a.lean.pt - b.lean.pt : sort === 'easy' ? a.lean.eb - b.lean.eb : b.f.c - a.f.c);

  const ensure = (f: Fam) => {
    const o: Opening = { id: slug(f), name: f.n, eco: f.e, side: f.s, tree: [], tmp: true };
    f.l.forEach(([name, m]) => addLine(o.tree, m.split(' '), name || f.n));
    setList(l => ((l ?? []).some(x => x.id === o.id) ? l : [...(l ?? []), o]));
  };
  const go = (f: Fam) => { ensure(f); open(slug(f)); };
  const star = (f: Fam) => { ensure(f); toggleFav(slug(f)); };
  const set = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setShown(24); };
  const toggleTag = (t: string) => { setTags(x => (x.includes(t) ? x.filter(y => y !== t) : [...x, t])); setShown(24); };

  return (
    <>
      <h1>Explore openings</h1>
      <p className="lead">{cat.length} opening families and {cat.reduce((a, f) => a + f.l.length, 0).toLocaleString()} named lines. Open any of them to try it, and star the ones you want to keep in My openings.</p>
      <div className="bar">
        <input placeholder="Search openings or ECO codes" value={q} onChange={e => set(setQ)(e.target.value)} aria-label="Search the catalog" />
        <select value={side} onChange={e => set(setSide)(e.target.value)} aria-label="Side"><option value="">Both sides</option><option value="w">Play as White</option><option value="b">Play as Black</option></select>
        <select value={first} onChange={e => set(setFirst)(e.target.value)} aria-label="First move">{FIRST.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">{SORTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
      </div>
      <div className="chips" role="group" aria-label="Style filters">
        <button className={'chipbtn' + (favOnly ? ' on' : '')} aria-pressed={favOnly} onClick={() => { setFavOnly(!favOnly); setShown(24); }}>★ Favorites</button>
        {TAGS.map(([id, label]) => <button key={id} className={'chipbtn' + (tags.includes(id) ? ' on' : '')} aria-pressed={tags.includes(id)} onClick={() => toggleTag(id)}>{label}</button>)}
        {(tags.length > 0 || favOnly || side || first || q) && <button className="link" onClick={() => { setTags([]); setFavOnly(false); setSide(''); setFirst(''); setQ(''); }}>Clear filters</button>}
      </div>
      <p className="muted" style={{ marginBottom: 14 }}>{rows.length} {rows.length === 1 ? 'opening' : 'openings'}</p>
      <div className="grid cat">
        {rows.slice(0, shown).map(({ f, main, lean }) => {
          const fav = favs.includes(slug(f));
          return (
            <article className="card oc" key={f.n}>
              <div className="preview click" onClick={() => go(f)}><MiniBoard sans={main} side={f.s} /></div>
              <header><h3>{f.n}</h3><button className={'star' + (fav ? ' on' : '')} onClick={() => star(f)} aria-pressed={fav} aria-label={fav ? `Remove ${f.n} from favorites` : `Add ${f.n} to favorites`}>★</button></header>
              <div className="chips"><span className={'chip ' + f.s}>{f.s === 'w' ? 'White' : 'Black'}</span><span className="chip plain">{f.e} · {f.c} {f.c === 1 ? 'line' : 'lines'}</span></div>
              <p className="muted desc">{DESC[f.n] ?? `A ${f.s === 'w' ? 'White' : 'Black'} system from ECO ${f.e}.`}</p>
              <Leanings compact l={lean} />
              <button className="primary" onClick={() => go(f)}>Open</button>
            </article>
          );
        })}
      </div>
      {!rows.length && <p className="muted">No openings match these filters.</p>}
      {shown < rows.length && <div className="row center"><button onClick={() => setShown(shown + 24)}>Show more ({rows.length - shown} left)</button></div>}
    </>
  );
}
