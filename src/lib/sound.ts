import { getSettings } from './settings';

// All sounds are synthesized with the Web Audio API, so there are no audio files and no licensing questions.
let ctx: AudioContext | null = null;

function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', at = 0, slide = 1) {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}

export type Sfx = 'move' | 'capture' | 'check' | 'castle' | 'promote' | 'illegal' | 'end';

export function play(k: Sfx) {
  const { sound, volume: v } = getSettings();
  if (!sound || v <= 0) return;
  try {
    if (k === 'move') tone(240, 0.07, 0.5 * v, 'triangle', 0, 0.5);
    else if (k === 'capture') { tone(170, 0.14, 0.8 * v, 'square', 0, 0.4); tone(340, 0.05, 0.4 * v, 'triangle'); }
    else if (k === 'check') { tone(660, 0.1, 0.4 * v); tone(880, 0.14, 0.4 * v, 'sine', 0.1); }
    else if (k === 'castle') { tone(240, 0.07, 0.5 * v, 'triangle', 0, 0.5); tone(300, 0.07, 0.5 * v, 'triangle', 0.1, 0.5); }
    else if (k === 'promote') [440, 554, 659, 880].forEach((f, i) => tone(f, 0.12, 0.35 * v, 'sine', i * 0.07));
    else if (k === 'illegal') tone(120, 0.18, 0.4 * v, 'sawtooth', 0, 0.8);
    else [523, 659, 784].forEach(f => tone(f, 0.6, 0.25 * v));
  } catch { /* audio unavailable */ }
}
