import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { del, get, set } from 'idb-keyval';
import { download, validOpening } from '../lib/files';
import { LEVELS } from '../lib/engine';
import { Settings as S, saveSettings as up, useSettings } from '../lib/settings';
import { play } from '../lib/sound';
import { Opening, uid } from '../lib/tree';

type Props = { list: Opening[]; setList: Dispatch<SetStateAction<Opening[] | null>>; onStats: () => void };

export function Settings({ list, setList, onStats }: Props) {
  const s = useSettings();
  const [note, setNote] = useState('');
  const sel = <K extends keyof S>(k: K, label: string, opts: [string, string][], num = false) => (
    <label className="set">{label}
      <select value={String(s[k])} onChange={e => up({ [k]: num ? +e.target.value : e.target.value } as Partial<S>)}>{opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
    </label>
  );
  const check = (k: 'coords' | 'sound' | 'hints', label: string) => (
    <label className="set">{label}<input type="checkbox" checked={s[k]} onChange={e => up({ [k]: e.target.checked })} /></label>
  );

  const importRep = async (f?: File) => {
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const arr: unknown[] = Array.isArray(j) ? j : j.openings;
      const ok = arr.filter(validOpening);
      if (!ok.length) throw new Error('none');
      setList(l => { const have = new Set((l ?? []).map(o => o.id)); return [...(l ?? []), ...ok.map(o => (have.has(o.id) ? { ...o, id: uid() } : o))]; });
      setNote(`Imported ${ok.length} of ${arr.length} openings.`);
    } catch { setNote('That file is not a Chess Academy repertoire or backup.'); }
  };
  const exportBackup = async () => download('chess-academy-backup.json', {
    version: 1, openings: list, settings: s,
    sessions: (await get('sessions')) ?? [], lessons: (await get('lessons')) ?? [], cards: (await get('cards')) ?? {}, srs: (await get('srs')) ?? null,
  });
  const restore = async (f?: File) => {
    if (!f || !confirm('Restoring replaces your current openings and progress. Continue?')) return;
    try {
      const j = JSON.parse(await f.text());
      const ops: Opening[] = (j.openings ?? []).filter(validOpening);
      if (!ops.length) throw new Error('none');
      setList(ops);
      await Promise.all([set('sessions', j.sessions ?? []), set('lessons', j.lessons ?? []), set('cards', j.cards ?? {}), j.srs ? set('srs', j.srs) : del('srs')]);
      if (j.settings) up(j.settings);
      setNote('Backup restored.');
    } catch { setNote('That file is not a valid backup.'); }
  };
  const reset = async () => {
    if (!confirm('Reset all training progress? Your openings are kept.')) return;
    await Promise.all([del('sessions'), del('lessons'), del('cards')]);
    setNote('Training progress reset.');
  };

  return (
    <>
      <h1>Settings</h1>
      <div className="cols">
        <section className="panel">
          <h3>Appearance</h3>
          {sel('theme', 'Theme', [['midnight', 'Midnight'], ['charcoal', 'Charcoal'], ['aurora', 'Aurora (animated)'], ['light', 'Light']])}
          {sel('accent', 'Accent colour', [['indigo', 'Indigo'], ['cyan', 'Cyan'], ['green', 'Green'], ['amber', 'Amber'], ['rose', 'Rose']])}
          {sel('board', 'Board theme', [['green', 'Green'], ['brown', 'Brown'], ['blue', 'Blue']])}
          {sel('pieces', 'Piece style', [['classic', 'Classic'], ['glyph', 'Outlined glyphs']])}
          {check('coords', 'Board coordinates')}
          <label className="set">Interface scale ({s.scale}%)<input type="range" min={90} max={125} step={5} value={s.scale} onChange={e => up({ scale: +e.target.value })} /></label>
        </section>
        <section className="panel">
          <h3>Sound</h3>
          {check('sound', 'Sound effects')}
          <label className="set">Volume<input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={e => up({ volume: +e.target.value })} /></label>
          <div className="row"><button onClick={() => play('move')}>Test move</button><button onClick={() => play('capture')}>Test capture</button></div>
        </section>
        <section className="panel">
          <h3>Training</h3>
          {sel('side', 'Default practice side', [['opening', "The opening's side"], ['w', 'White'], ['b', 'Black']])}
          {check('hints', 'Hints on by default')}
          <div className="row"><button onClick={onStats}>Review schedule</button></div>
        </section>
        <section className="panel">
          <h3>Engine</h3>
          {sel('engineLevel', 'Default difficulty', Object.keys(LEVELS).map(l => [l, l]))}
          {sel('think', 'Thinking time', [['0.5', 'Faster (0.5×)'], ['1', 'Normal'], ['2', 'Longer (2×)']], true)}
        </section>
        <section className="panel">
          <h3>Data</h3>
          <div className="row">
            <button onClick={() => download('chess-academy-repertoire.json', list)}>Export repertoire</button>
            <button onClick={exportBackup}>Export backup</button>
            <button onClick={reset}>Reset training progress</button>
          </div>
          <label>Import repertoire (adds to yours)<input type="file" accept=".json" onChange={e => { importRep(e.target.files?.[0]); e.target.value = ''; }} /></label>
          <label>Restore backup (replaces everything)<input type="file" accept=".json" onChange={e => { restore(e.target.files?.[0]); e.target.value = ''; }} /></label>
          {note && <p className="ok" role="status">{note}</p>}
        </section>
      </div>
    </>
  );
}
