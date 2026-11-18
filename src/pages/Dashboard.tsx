import { Bars } from '../components/Bars';
import { MiniBoard } from '../components/MiniBoard';
import { lineInfo, progress } from '../lib/lines';
import { dailyPuzzle } from '../lib/puzzles';
import { dayKey, isDue, streak } from '../lib/srs';
import { useData } from '../lib/store';
import type { Opening } from '../lib/tree';

type Go = { hub: (id: string) => void; learn: (id: string, line: number) => void; drill: (id: string) => void; play: () => void; puzzle: () => void; explore: () => void; imp: () => void };

export function Dashboard({ list, favs, go }: { list: Opening[]; favs: string[]; go: Go }) {
  const d = useData();
  if (!d) return <p className="muted">Loading your progress…</p>;
  const now = Date.now();
  const { sessions, lessons, cards, puzzles } = d;
  const mine = list.filter(o => !o.tmp || favs.includes(o.id) || Object.keys(cards).some(k => k.startsWith(o.id + ':')));
  const infos = mine.map(o => ({ o, l: lineInfo(o, cards, now) }));
  const tot = infos.reduce((a, x) => { const p = progress(x.l); return { learned: a.learned + p.learned, total: a.total + p.total }; }, { learned: 0, total: 0 });
  const due = Object.values(cards).filter(c => isDue(c, now)).length;
  const tries = sessions.reduce((a, s) => a + s.tries, 0), ok = sessions.reduce((a, s) => a + s.ok, 0);
  const acts = [...sessions.map(s => s.at), ...lessons.map(l => l.at), ...puzzles.map(p => p.at)];
  const days = [...Array(7)].map((_, i) => { const t = new Date(now); t.setDate(t.getDate() - (6 - i)); return t; });
  const counts = days.map(t => acts.filter(a => dayKey(a) === dayKey(+t)).length);
  const peak = Math.max(1, ...counts);

  const lastId = sessions[sessions.length - 1]?.opening;
  const open = (x: (typeof infos)[number]) => x.l.some(l => l.status !== 'learned');
  const target = infos.find(x => x.o.id === lastId && open(x)) ?? infos.find(open) ?? infos[0];
  const nextLine = target?.l.find(l => l.status !== 'learned');
  const hour = new Date().getHours();
  const hello = hour < 5 ? 'Still up?' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const pz = dailyPuzzle();
  const solved = puzzles.some(p => p.daily && p.ok && dayKey(p.at) === dayKey(now));
  const s = streak(acts, now);
  const stat = (k: string, v: string | number, sub?: string) => <div key={k}><dt>{k}</dt><dd>{v}</dd>{sub && <small>{sub}</small>}</div>;

  return (
    <>
      <section className="hero2">
        <div>
          <p className="eyebrow">{hello}</p>
          <h1>{s > 0 ? `${s}-day streak` : 'Ready to train?'}</h1>
          <p className="lead" style={{ marginBottom: 0 }}>
            {target ? <>Next up: <strong>{target.o.name}</strong>{nextLine ? ` · ${nextLine.name}` : ''}. {due > 0 ? `${due} ${due === 1 ? 'move is' : 'moves are'} due for review.` : 'Nothing is due right now.'}</> : 'Add an opening from Explore to get started.'}
          </p>
        </div>
        <div className="row">
          {target && nextLine && <button className="primary" onClick={() => go.learn(target.o.id, nextLine.i)}>Continue learning</button>}
          {due > 0 && target && <button onClick={() => go.drill(infos.find(x => x.l.some(l => l.due))?.o.id ?? target.o.id)}>Review {due} due</button>}
          {!target && <button className="primary" onClick={go.explore}>Explore openings</button>}
        </div>
      </section>

      <div className="cols">
        <section className="panel pzcard">
          <div className="row between"><h3>Daily puzzle</h3><span className={'chip ' + (solved ? 'ok' : 'plain')}>{solved ? 'Solved ✓' : '≈ ' + pz.r}</span></div>
          <div className="preview click" onClick={go.puzzle}><MiniBoard sans={[]} fen={pz.fen} side={pz.side} /></div>
          <p className="muted">{pz.side === 'w' ? 'White' : 'Black'} to move · {pz.t}</p>
          <button className={solved ? '' : 'primary'} onClick={go.puzzle}>{solved ? 'Try another puzzle' : 'Solve today\'s puzzle'}</button>
        </section>
        <section className="panel">
          <h3>Your training</h3>
          <dl className="stats">
            {stat('Lines learned', tot.learned, tot.total ? `of ${tot.total}` : undefined)}
            {stat('Accuracy', tries ? `${Math.round((ok / tries) * 1000) / 10}%` : '—')}
            {stat('Sessions', sessions.length)}
            {stat('Due for review', due)}
          </dl>
          <div className="progress"><div className="bar2"><i style={{ width: `${tot.total ? (tot.learned / tot.total) * 100 : 0}%` }} /></div></div>
          <h3 style={{ marginTop: 6 }}>Last 7 days</h3>
          <Bars values={counts.map(c => Math.round((c / peak) * 100))} labels={days.map(t => t.toLocaleDateString(undefined, { weekday: 'short' }))} empty="" show />
        </section>
        <section className="panel">
          <div className="row between"><h3>Your openings</h3><button className="link" onClick={go.explore}>Explore more</button></div>
          {infos.length ? infos.slice(0, 6).map(({ o, l }) => {
            const p = progress(l);
            return (
              <div className="orow" key={o.id} onClick={() => go.hub(o.id)}>
                <div><strong>{o.name}</strong><div className="bar2 thin"><i style={{ width: `${p.total ? (p.learned / p.total) * 100 : 0}%` }} /></div></div>
                <span className="muted">{p.learned}/{p.total}</span>
              </div>
            );
          }) : <p className="muted">No openings yet.</p>}
          <div className="row"><button onClick={go.play}>Play the bot</button><button onClick={go.imp}>Import an opening</button></div>
        </section>
      </div>
    </>
  );
}
