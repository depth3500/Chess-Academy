import { useEffect, useState } from 'react';
import { Bars } from '../components/Bars';
import { Cfg, DAY, MASTERY, dayKey, level } from '../lib/srs';
import { getCfg, saveCfg, useData } from '../lib/store';
import type { Opening } from '../lib/tree';

const fmt = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}m ${s % 60}s`);

export function Stats({ list }: { list: Opening[] }) {
  const d = useData();
  const [days, setDays] = useState(30);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { getCfg().then(setCfg); }, []);
  if (!d || !cfg) return <p className="muted">Loading statistics…</p>;

  const from = days ? Date.now() - days * DAY : 0;
  const ss = d.sessions.filter(s => s.at >= from);
  const lessons = d.lessons.filter(l => l.at >= from);
  const by: Record<string, { name: string; ok: number; tries: number; secs: number; n: number }> = {};
  for (const s of ss) {
    const r = (by[s.opening] ??= { name: list.find(o => o.id === s.opening)?.name ?? s.name, ok: 0, tries: 0, secs: 0, n: 0 });
    r.ok += s.ok; r.tries += s.tries; r.secs += s.seconds; r.n++;
  }
  const rows = Object.values(by).sort((a, b) => a.ok / (a.tries || 1) - b.ok / (b.tries || 1)); // hardest first
  const daily = new Map<string, { ok: number; tries: number }>();
  for (const s of ss) { const k = dayKey(s.at); const r = daily.get(k) ?? { ok: 0, tries: 0 }; r.ok += s.ok; r.tries += s.tries; daily.set(k, r); }
  const cards = Object.values(d.cards);
  const missed = cards.filter(c => c.lapses > 0).sort((a, b) => b.lapses - a.lapses).slice(0, 8);
  const tries = ss.reduce((a, s) => a + s.tries, 0), ok = ss.reduce((a, s) => a + s.ok, 0);
  const num = (k: keyof Cfg, min: number, step: number, label: string) => (
    <label>{label}<input type="number" min={min} step={step} value={cfg[k]} onChange={e => { setCfg({ ...cfg, [k]: Math.max(min, +e.target.value || min) }); setSaved(false); }} /></label>
  );

  return (
    <>
      <h1>Statistics</h1>
      <div className="bar">
        <select value={days} onChange={e => setDays(+e.target.value)} aria-label="Date range">
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={0}>All time</option>
        </select>
      </div>
      <dl className="stats stats3">
        <div><dt>Accuracy</dt><dd>{tries ? `${Math.round((ok / tries) * 1000) / 10}%` : '—'}</dd></div>
        <div><dt>Sessions</dt><dd>{ss.length}</dd></div>
        <div><dt>Lessons completed</dt><dd>{lessons.length}</dd></div>
        <div><dt>Practice time</dt><dd>{fmt(ss.reduce((a, s) => a + s.seconds, 0))}</dd></div>
      </dl>
      <div className="cols">
        <section className="panel">
          <h3>Accuracy by day</h3>
          <Bars values={[...daily.values()].map(r => Math.round((r.ok / (r.tries || 1)) * 100))} labels={[...daily.keys()]} empty="No sessions in this range." />
        </section>
        <section className="panel">
          <h3>Mastery levels</h3>
          {cards.length ? MASTERY.map((m, i) => {
            const n = cards.filter(c => level(c) === i + 1).length;
            return <div className="row between" key={m}><span>{m}</span><span className="muted">{n} {n === 1 ? 'move' : 'moves'}</span></div>;
          }) : <p className="muted">Mastery appears after your first practice session.</p>}
        </section>
        <section className="panel">
          <h3>Most frequently missed moves</h3>
          {missed.length ? missed.map((c, i) => <div className="row between" key={i}><span>{c.label}</span><span className="muted">missed {c.lapses}×</span></div>) : <p className="muted">No misses recorded.</p>}
        </section>
      </div>
      <h3 style={{ margin: '24px 0 8px' }}>Accuracy by opening, hardest first</h3>
      {rows.length ? (
        <div className="scroll"><table><thead><tr><th>Opening</th><th>Sessions</th><th>Accuracy</th><th>Time</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.name}><td>{r.name}</td><td>{r.n}</td><td>{Math.round((r.ok / (r.tries || 1)) * 1000) / 10}%</td><td>{fmt(r.secs)}</td></tr>)}</tbody></table></div>
      ) : <p className="muted">Practice an opening to see accuracy by opening.</p>}

      <h3 style={{ margin: '24px 0 8px' }}>Review schedule</h3>
      <section className="panel">
        <p className="muted">Each move you play is a card. Correct without a hint: due after 1 day (your first interval), then 6 days, then the last interval times the card's ease. Correct with a hint: the interval grows only 1.2× and ease drops 0.15. A miss: due again now and ease drops 0.2. Levels by interval: Learning under 3 days, Developing under 10, Familiar under 30, Mastered 30 or more.</p>
        <div className="row">
          {num('ease', 1.3, 0.1, 'Starting ease')}{num('first', 1, 1, 'First interval (days)')}{num('max', 7, 1, 'Longest interval (days)')}
        </div>
        <div className="row"><button className="primary" onClick={() => saveCfg(cfg).then(() => setSaved(true))}>Save schedule</button>{saved && <span className="ok" role="status">Saved. New settings apply to your next review.</span>}</div>
      </section>
    </>
  );
}
