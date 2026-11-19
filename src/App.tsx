import { useState } from 'react';
import { seedOpenings } from './data/openings';
import { usePersisted } from './lib/store';
import { Opening, allLines } from './lib/tree';
import { Dashboard } from './pages/Dashboard';
import { Editor } from './pages/Editor';
import { Explore } from './pages/Explore';
import { Learn } from './pages/Learn';
import { Library } from './pages/Library';
import { OpeningHub } from './pages/OpeningHub';
import { Play } from './pages/Play';
import { Practice } from './pages/Practice';
import { PuzzlePage } from './pages/Puzzle';
import { ReviewPage } from './pages/Review';
import { Settings } from './pages/Settings';
import { Stats } from './pages/Stats';

type V = 'dash' | 'explore' | 'lib' | 'hub' | 'puzzle' | 'review' | 'play' | 'stats' | 'settings' | 'edit' | 'learn' | 'practice';
type View = { v: V; id?: string; drill?: boolean; line?: number };
const NAV: [V, string][] = [['dash', 'Dashboard'], ['explore', 'Explore'], ['lib', 'My openings'], ['puzzle', 'Puzzles'], ['review', 'Review'], ['play', 'Play'], ['stats', 'Statistics'], ['settings', 'Settings']];
const GROUP: Partial<Record<V, V>> = { edit: 'lib', practice: 'lib', learn: 'lib', hub: 'lib' };

export default function App() {
  const [list, setList] = usePersisted<Opening[]>('openings', seedOpenings);
  const [favs, setFavs] = usePersisted<string[]>('favs', () => []);
  const [view, setView] = useState<View>({ v: 'dash' });
  if (!list || !favs) return <p className="muted" style={{ padding: 24 }}>Loading your openings…</p>;

  const cur = list.find(o => o.id === view.id);
  const go = (v: V, id?: string, x?: { drill?: boolean; line?: number }) => setView({ v, id, ...x });
  const save = (n: Opening) => setList(l => (l ?? []).map(o => (o.id === n.id ? n : o)));
  const toggleFav = (id: string) => setFavs(f => { const a = f ?? []; return a.includes(id) ? a.filter(x => x !== id) : [...a, id]; });
  const active = GROUP[view.v] ?? view.v;
  const hub = (id: string) => go('hub', id);

  return (
    <>
      <header className="top">
        <button className="brand" onClick={() => go('dash')}><span className="logo">♞</span>Chess Academy</button>
        <nav>{NAV.map(([v, label]) => <button key={v} className={active === v ? 'active' : ''} onClick={() => go(v)}>{label}</button>)}</nav>
      </header>
      <main key={view.v + (view.id ?? '') + (view.line ?? '')} className="page">
        {view.v === 'settings' ? (
          <Settings list={list} setList={setList} onStats={() => go('stats')} />
        ) : view.v === 'dash' ? (
          <Dashboard list={list} favs={favs} go={{ hub, learn: (id, line) => go('learn', id, { line }), drill: id => go('practice', id, { drill: true }), play: () => go('play'), puzzle: () => go('puzzle'), review: () => go('review'), explore: () => go('explore'), imp: () => go('lib', 'new') }} />
        ) : view.v === 'explore' ? (
          <Explore list={list} setList={setList} favs={favs} toggleFav={toggleFav} open={hub} />
        ) : view.v === 'review' ? (
          <ReviewPage />
        ) : view.v === 'puzzle' ? (
          <PuzzlePage />
        ) : view.v === 'stats' ? (
          <Stats list={list} />
        ) : view.v === 'play' ? (
          <Play list={list} />
        ) : view.v === 'hub' && cur ? (
          <OpeningHub key={cur.id} o={cur} fav={favs.includes(cur.id)} toggleFav={() => toggleFav(cur.id)}
            go={{ learn: line => go('learn', cur.id, { line }), practice: (line, drill) => go('practice', cur.id, { line, drill }), edit: () => go('edit', cur.id), back: () => go('lib') }} />
        ) : view.v === 'edit' && cur ? (
          <Editor key={cur.id} o={cur} save={save} onBack={() => hub(cur.id)} onPractice={() => go('practice', cur.id)} />
        ) : view.v === 'learn' && cur ? (
          <Learn key={cur.id} o={cur} startLine={view.line} onExit={() => hub(cur.id)} onPractice={() => go('practice', cur.id)} />
        ) : view.v === 'practice' && cur ? (
          <Practice key={cur.id} o={cur} onExit={() => hub(cur.id)} drill={view.drill} line={view.line != null ? allLines(cur.tree)[view.line] : undefined} />
        ) : (
          <Library list={list} setList={setList} favs={favs} toggleFav={toggleFav} hub={hub} edit={id => go('edit', id)} startNew={view.id === 'new'} />
        )}
      </main>
    </>
  );
}
