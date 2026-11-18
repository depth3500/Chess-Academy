import { getSettings } from './settings';

// Sounds come from a pack: "Wooden" is synthesized in the browser, the others are sample files in public/sounds/<pack>.
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
const ac = () => (ctx ??= new AudioContext());

export type Sfx = 'move' | 'capture' | 'check' | 'castle' | 'promote' | 'illegal' | 'end' | 'win' | 'lose' | 'draw';
const FILE: Record<Sfx, string> = { move: 'Move', capture: 'Capture', check: 'Check', castle: 'Move', promote: 'Move', illegal: 'Error', end: 'GenericNotify', win: 'Victory', lose: 'Defeat', draw: 'Draw' };
const buffers = new Map<string, AudioBuffer | 'loading'>();

function load(pack: string, name: string) {
  const k = `${pack}/${name}`;
  if (buffers.has(k)) return;
  buffers.set(k, 'loading');
  fetch(`${import.meta.env.BASE_URL}sounds/${pack}/${name}.mp3`)
    .then(r => { if (!r.ok) throw new Error('missing'); return r.arrayBuffer(); })
    .then(d => ac().decodeAudioData(d))
    .then(b => { buffers.set(k, b); })
    .catch(() => { buffers.delete(k); });
}

/** Starts loading the selected pack so the first move already sounds right. */
export function preload() {
  const { sounds } = getSettings();
  if (sounds !== 'synth') for (const n of new Set(Object.values(FILE))) load(sounds, n);
}

/** Browsers keep audio suspended until a user gesture, so every click or touch makes sure it is running. */
export function unlock() { try { if (ac().state !== 'running') void ac().resume(); preload(); } catch { /* audio unavailable */ } }
if (typeof document !== 'undefined') document.addEventListener('pointerdown', unlock, { passive: true });

function sample(name: string, vol: number) {
  const { sounds } = getSettings();
  const b = buffers.get(`${sounds}/${name}`);
  if (!b || b === 'loading') { load(sounds, name); return false; }
  const a = ac(); const s = a.createBufferSource(); const g = a.createGain();
  s.buffer = b; g.gain.value = vol; s.connect(g).connect(a.destination); s.start();
  return true;
}

/** A wooden "tap": a short band-passed noise burst on top of a low body thump. */
function tap(vol: number, freq: number, dur: number, at = 0) {
  const a = ac();
  const t = a.currentTime + at;
  noise ??= (() => { const b = a.createBuffer(1, a.sampleRate * 0.25, a.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
  const src = a.createBufferSource(); src.buffer = noise;
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 1.1;
  const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(a.destination); src.start(t); src.stop(t + dur);
  const o = a.createOscillator(); const og = a.createGain();
  o.frequency.setValueAtTime(freq / 7, t); o.frequency.exponentialRampToValueAtTime(freq / 14, t + dur);
  og.gain.setValueAtTime(vol * 0.9, t); og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(og).connect(a.destination); o.start(t); o.stop(t + dur);
}

function tone(freq: number, dur: number, vol: number, at = 0) {
  const a = ac(); const t = a.currentTime + at;
  const o = a.createOscillator(); const g = a.createGain();
  o.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
}

function synth(k: Sfx, v: number) {
  if (k === 'move') tap(0.9 * v, 1900, 0.09);
  else if (k === 'capture') { tap(1.1 * v, 1300, 0.15); tap(0.6 * v, 2800, 0.06, 0.025); }
  else if (k === 'check') { tap(0.9 * v, 1900, 0.09); tone(740, 0.16, 0.18 * v, 0.07); tone(988, 0.22, 0.16 * v, 0.14); }
  else if (k === 'castle') { tap(0.9 * v, 1900, 0.09); tap(0.8 * v, 1500, 0.09, 0.11); }
  else if (k === 'promote') { tap(0.9 * v, 1900, 0.09); [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 0.14 * v, 0.08 + i * 0.07)); }
  else if (k === 'illegal') tap(0.7 * v, 420, 0.16);
  else if (k === 'lose') [392, 330, 262].forEach((f, i) => tone(f, 0.5, 0.16 * v, i * 0.18));
  else if (k === 'draw') [440, 440].forEach((f, i) => tone(f, 0.4, 0.14 * v, i * 0.2));
  else [523, 659, 784].forEach((f, i) => tone(f, 0.7, 0.16 * v, i * 0.04));
}

export function play(k: Sfx) {
  const { sound, volume: v, sounds } = getSettings();
  if (!sound || v <= 0) return;
  try {
    unlock();
    if (sounds !== 'synth' && sample(FILE[k], v)) return;
    synth(k, v); // the wooden pack, or the pack's file is still loading
  } catch { /* audio unavailable */ }
}
