import { getSettings } from './settings';

// All sounds are synthesized with the Web Audio API: no audio files and no licensing questions.
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
const ac = () => (ctx ??= new AudioContext());

/** Browsers keep audio suspended until a user gesture, so every click or touch makes sure it is running. */
export function unlock() { try { if (ac().state !== 'running') void ac().resume(); } catch { /* audio unavailable */ } }
if (typeof document !== 'undefined') document.addEventListener('pointerdown', unlock, { passive: true });

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

export type Sfx = 'move' | 'capture' | 'check' | 'castle' | 'promote' | 'illegal' | 'end';

export function play(k: Sfx) {
  const { sound, volume: v } = getSettings();
  if (!sound || v <= 0) return;
  try {
    unlock();
    if (k === 'move') tap(0.9 * v, 1900, 0.09);
    else if (k === 'capture') { tap(1.1 * v, 1300, 0.15); tap(0.6 * v, 2800, 0.06, 0.025); }
    else if (k === 'check') { tap(0.9 * v, 1900, 0.09); tone(740, 0.16, 0.18 * v, 0.07); tone(988, 0.22, 0.16 * v, 0.14); }
    else if (k === 'castle') { tap(0.9 * v, 1900, 0.09); tap(0.8 * v, 1500, 0.09, 0.11); }
    else if (k === 'promote') { tap(0.9 * v, 1900, 0.09); [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 0.14 * v, 0.08 + i * 0.07)); }
    else if (k === 'illegal') tap(0.7 * v, 420, 0.16);
    else [523, 659, 784].forEach((f, i) => tone(f, 0.7, 0.16 * v, i * 0.04));
  } catch { /* audio unavailable */ }
}
