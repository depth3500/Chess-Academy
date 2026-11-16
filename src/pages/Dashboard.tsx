import { Bars } from '../components/Bars';
import { dueByOpening, level, streak } from '../lib/srs';
import { useData } from '../lib/store';
import { Opening, lines } from '../lib/tree';

type Go = { learn: (id: string) => void; practice: (id: string) => void; drill: (id: string) => void; play: () => void; imp: () => void };

export function Dashboard({ list, go }: { list: Opening[]; go: Go }) {
  const d = useData();
  if (!d) return <p className="muted">Loading your progress…</p>;
  const now = Date.now();
  const { sessions, lessons, cards } = d;
  const cs = Object.values(cards);
  const tries = sessions.reduce((a, s) => a + s.tries, 0);
  const ok = sessions.reduce((a, s) => a + s.ok, 0);
  const due = dueByOpening(cards, now);
  const dueTotal = Object.values(due).reduce((a, b) => a + b, 0);
  const byId = (id: string) => list.find(o => o.id === id);
  const topDue = Object.entries(due).filter(([id]) => byId(id)).sort((a, b) => b[1] - a[1])[0];
  const practiced = new Set(cs.filter(c => c.seen > 0).map(c => c.opening));
  const fresh = list.find(o => lines(o.tree) && !practiced.has(o.id));
  const next = topDue ? { o: byId(topDue[0])!, kind: 'drill' as const, why: `${topDue[1]} ${topDue[1] === 1 ? 'move is' : 'moves are'} due for review.` }
    : fresh ? { o: fresh, kind: 'learn' as const, why: 'You have not studied this opening yet.' }
    : list[0] ? { o: list[0], kind: 'practice' as const, why: 'Nothing is due. Keep your repertoire sharp.' } : null;
  const recent = sessions.slice(-12);
  const pct = (s: { ok: number; tries: number }) => (s.tries ? Math.round((s.ok / s.tries) * 100) : 0);
  const stat = (k: string, v: string | number) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>;

  return (
    <>
      <h1>Dashboard</h1>
      {next && (
        <section className="hero">
          <div><h2>{next.o.name}</h2><p className="muted">{next.why}</p></div>
          <button className="primary" onClick={() => go[next.kind](next.o.id)}>Continue learning</button>
        </section>
      )}
      <dl className="stats stats3">
        {stat('Openings', list.length)}
        {stat('Practice sessions', sessions.length)}
        {stat('Accuracy', tries ? `${Math.round((ok / tries) * 1000) / 10}%` : '—')}
        {stat('Day streak', streak([...sessions.map(s => s.at), ...lessons.map(l => l.at)], now))}
        {stat('Moves memorized', cs.filter(c => level(c) >= 4).length)}
        {stat('Due for review', dueTotal)}
      </dl>
      <div className="cols">
        <section className="panel">
          <h3>Needing review</h3>
          {topDue ? Object.entries(due).filter(([id]) => byId(id)).map(([id, n]) => (
            <div className="row between" key={id}><span>{byId(id)!.name} <span className="muted">({n} due)</span></span><button onClick={() => go.drill(id)}>Review</button></div>
          )) : <p className="muted">Nothing is due. Practice an opening to start building your review schedule.</p>}
        </section>
        <section className="panel">
          <h3>Recently practiced</h3>
          {recent.length ? [...recent].reverse().slice(0, 5).map((s, i) => (
            <div className="row between" key={i}><span>{s.name}</span><span className="muted">{pct(s)}% · {new Date(s.at).toLocaleDateString()}</span></div>
          )) : <p className="muted">No sessions yet.</p>}
        </section>
        <section className="panel">
          <h3>Recent accuracy</h3>
          <Bars values={recent.map(pct)} labels={recent.map(s => new Date(s.at).toLocaleDateString())} empty="Your last sessions will be charted here." />
        </section>
      </div>
      <h3 style={{ margin: '24px 0 8px' }}>Quick start</h3>
      <div className="row">
        <button disabled={!(fresh ?? next?.o)} onClick={() => go.learn((fresh ?? next!.o).id)}>Learn an opening</button>
        <button disabled={!next} onClick={() => go.practice(next!.o.id)}>Practice an opening</button>
        <button onClick={go.play}>Play against the bot</button>
        <button onClick={go.imp}>Import an opening</button>
      </div>
    </>
  );
}
