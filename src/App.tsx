import { useState } from 'react';
import { seedOpenings } from './data/openings';
import { usePersisted } from './lib/store';
import type { Opening } from './lib/tree';
import { Dashboard } from './pages/Dashboard';
import { Editor } from './pages/Editor';
import { Learn } from './pages/Learn';
import { Library } from './pages/Library';
import { Play } from './pages/Play';
import { Practice } from './pages/Practice';
import { Settings } from './pages/Settings';
import { Stats } from './pages/Stats';

type View = { drill?: boolean; v: 'dash' | 'stats' | 'settings' | 'lib' | 'edit' | 'practice' | 'play' | 'learn'; id?: string };

export default function App() {
  const [list, setList] = usePersisted<Opening[]>('openings', seedOpenings);
  const [view, setView] = useState<View>({ v: 'dash' });
  if (!list) return <p className="muted" style={{ padding: 24 }}>Loading your openings…</p>;

  const cur = list.find(o => o.id === view.id);
  const home = () => setView({ v: 'lib' });
  const save = (n: Opening) => setList(l => (l ?? []).map(o => (o.id === n.id ? n : o)));

  return (
    <>
      <header className="top">
        <button className="brand" onClick={() => setView({ v: 'dash' })}>Chess Academy</button>
        <button onClick={() => setView({ v: 'dash' })}>Dashboard</button>
        <button onClick={home}>Openings</button>
        <button onClick={() => setView({ v: 'play' })}>Play against bot</button>
        <button onClick={() => setView({ v: 'stats' })}>Statistics</button>
        <button onClick={() => setView({ v: 'settings' })}>Settings</button>
      </header>
      <main>
        {view.v === 'settings' ? (
          <Settings list={list} setList={setList} onStats={() => setView({ v: 'stats' })} />
        ) : view.v === 'dash' ? (
          <Dashboard list={list} go={{ learn: id => setView({ v: 'learn', id }), practice: id => setView({ v: 'practice', id }), drill: id => setView({ v: 'practice', id, drill: true }), play: () => setView({ v: 'play' }), imp: () => setView({ v: 'lib', id: 'new' }) }} />
        ) : view.v === 'stats' ? (
          <Stats list={list} />
        ) : view.v === 'play' ? (
          <Play list={list} />
        ) : view.v === 'edit' && cur ? (
          <Editor key={cur.id} o={cur} save={save} onBack={home} onPractice={() => setView({ v: 'practice', id: cur.id })} />
        ) : view.v === 'learn' && cur ? (
          <Learn key={cur.id} o={cur} onExit={home} onPractice={() => setView({ v: 'practice', id: cur.id })} />
        ) : view.v === 'practice' && cur ? (
          <Practice key={cur.id} o={cur} onExit={home} drill={view.drill} />
        ) : (
          <Library list={list} setList={setList} open={id => setView({ v: 'edit', id })} practice={id => setView({ v: 'practice', id })} learn={id => setView({ v: 'learn', id })} startNew={view.id === 'new'} />
        )}
      </main>
    </>
  );
}
