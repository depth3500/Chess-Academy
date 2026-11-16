import { useState } from 'react';
import { seedOpenings } from './data/openings';
import { usePersisted } from './lib/store';
import type { Opening } from './lib/tree';
import { Dashboard } from './pages/Dashboard';
import { Editor } from './pages/Editor';
import { Explore } from './pages/Explore';
import { Learn } from './pages/Learn';
import { Library } from './pages/Library';
import { Play } from './pages/Play';
import { Practice } from './pages/Practice';
import { Settings } from './pages/Settings';
import { Stats } from './pages/Stats';

type V = 'dash' | 'explore' | 'stats' | 'settings' | 'lib' | 'edit' | 'practice' | 'play' | 'learn';
type View = { v: V; id?: string; drill?: boolean };
const NAV: [V, string][] = [['dash', 'Dashboard'], ['explore', 'Explore'], ['lib', 'My openings'], ['play', 'Play'], ['stats', 'Statistics'], ['settings', 'Settings']];
const GROUP: Partial<Record<V, V>> = { edit: 'lib', practice: 'lib', learn: 'lib' };

export default function App() {
  const [list, setList] = usePersisted<Opening[]>('openings', seedOpenings);
  const [view, setView] = useState<View>({ v: 'dash' });
  if (!list) return <p className="muted" style={{ padding: 24 }}>Loading your openings…</p>;

  const cur = list.find(o => o.id === view.id);
  const go = (v: V, id?: string, drill?: boolean) => setView({ v, id, drill });
  const home = () => go('lib');
  const save = (n: Opening) => setList(l => (l ?? []).map(o => (o.id === n.id ? n : o)));
  const active = GROUP[view.v] ?? view.v;

  return (
    <>
      <header className="top">
        <button className="brand" onClick={() => go('dash')}><span className="logo">♞</span>Chess Academy</button>
        <nav>{NAV.map(([v, label]) => <button key={v} className={active === v ? 'active' : ''} onClick={() => go(v)}>{label}</button>)}</nav>
      </header>
      <main key={view.v + (view.id ?? '')} className="page">
        {view.v === 'settings' ? (
          <Settings list={list} setList={setList} onStats={() => go('stats')} />
        ) : view.v === 'dash' ? (
          <Dashboard list={list} go={{ learn: id => go('learn', id), practice: id => go('practice', id), drill: id => go('practice', id, true), play: () => go('play'), imp: () => go('lib', 'new') }} />
        ) : view.v === 'explore' ? (
          <Explore list={list} setList={setList} learn={id => go('learn', id)} />
        ) : view.v === 'stats' ? (
          <Stats list={list} />
        ) : view.v === 'play' ? (
          <Play list={list} />
        ) : view.v === 'edit' && cur ? (
          <Editor key={cur.id} o={cur} save={save} onBack={home} onPractice={() => go('practice', cur.id)} />
        ) : view.v === 'learn' && cur ? (
          <Learn key={cur.id} o={cur} onExit={home} onPractice={() => go('practice', cur.id)} />
        ) : view.v === 'practice' && cur ? (
          <Practice key={cur.id} o={cur} onExit={home} drill={view.drill} />
        ) : (
          <Library list={list} setList={setList} open={id => go('edit', id)} practice={id => go('practice', id)} learn={id => go('learn', id)} startNew={view.id === 'new'} />
        )}
      </main>
    </>
  );
}
