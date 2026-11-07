/**
 * Procedural sound library — every sound in «Последняя смена» is synthesised
 * with Web Audio at runtime (noise bursts, filtered oscillators, envelopes).
 */
import type { AudioEngine } from './AudioEngine';

type Dest = AudioNode;
const r = (a: number, b: number) => a + Math.random() * (b - a);

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}
function osc(e: AudioEngine, type: OscillatorType, f: number, t: number, dur: number, dest: AudioNode) {
  const o = e.ctx!.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}
function burst(e: AudioEngine, kind: 'white' | 'pink' | 'brown', t: number, dur: number, ft: BiquadFilterType, f: number, q: number, peak: number, dest: Dest, attack = 0.002) {
  const ctx = e.ctx!;
  const s = e.noiseSource(kind, false);
  const bf = ctx.createBiquadFilter();
  bf.type = ft;
  bf.frequency.setValueAtTime(f, t);
  bf.Q.value = q;
  const g = ctx.createGain();
  env(g, t, peak, attack, dur);
  s.connect(bf).connect(g).connect(dest);
  s.start(t, Math.random() * 2);
  s.stop(t + attack + dur + 0.05);
  return { s, bf, g };
}
function tone(e: AudioEngine, type: OscillatorType, f: number, t: number, peak: number, attack: number, decay: number, dest: Dest) {
  const g = e.ctx!.createGain();
  env(g, t, peak, attack, decay);
  const o = osc(e, type, f, t, attack + decay, g);
  g.connect(dest);
  return o;
}

export type Surface = 'asphalt' | 'gravel' | 'mud' | 'grass' | 'forest' | 'wood' | 'concrete' | 'metal' | 'tile' | 'linoleum';

export function footstep(e: AudioEngine, dest: Dest, s: Surface, vol = 1, wet = true) {
  const t = e.now;
  const v = vol * r(0.8, 1.1);
  switch (s) {
    case 'gravel':
      for (let i = 0; i < 6; i++) burst(e, 'white', t + i * r(0.006, 0.018), 0.03, 'bandpass', r(2500, 5000), 2, 0.12 * v, dest);
      burst(e, 'brown', t, 0.09, 'lowpass', 300, 1, 0.4 * v, dest);
      break;
    case 'mud':
      burst(e, 'pink', t, 0.12, 'lowpass', 600, 2, 0.45 * v, dest, 0.01);
      burst(e, 'pink', t + 0.08, 0.14, 'bandpass', r(900, 1300), 4, 0.18 * v, dest, 0.02); // suck
      break;
    case 'grass':
    case 'forest':
      burst(e, 'white', t, 0.09, 'bandpass', r(3000, 4500), 1, 0.12 * v, dest, 0.01);
      burst(e, 'brown', t, 0.1, 'lowpass', 250, 1, 0.35 * v, dest);
      if (s === 'forest' && Math.random() < 0.15) burst(e, 'white', t + 0.03, 0.015, 'highpass', 2000, 1, 0.25 * v, dest); // twig
      break;
    case 'wood':
      burst(e, 'pink', t, 0.08, 'bandpass', r(380, 480), 3, 0.55 * v, dest);
      if (Math.random() < 0.35) creak(e, dest, r(0.15, 0.3), r(0.8, 1.2), 0.4 * v);
      break;
    case 'metal':
      burst(e, 'white', t, 0.05, 'bandpass', 900, 4, 0.3 * v, dest);
      [310, 777, 1210].forEach((f) => tone(e, 'sine', f * r(0.97, 1.03), t, 0.04 * v, 0.002, 0.3, dest));
      break;
    case 'tile':
    case 'concrete':
    case 'linoleum':
      burst(e, 'white', t, 0.05, 'bandpass', s === 'tile' ? r(2600, 3400) : r(1500, 2200), 1.2, 0.22 * v, dest);
      burst(e, 'brown', t, 0.08, 'lowpass', 320, 1, 0.45 * v, dest);
      break;
    default: // asphalt
      burst(e, 'white', t, 0.05, 'bandpass', r(1800, 2400), 1, 0.2 * v, dest);
      burst(e, 'brown', t, 0.08, 'lowpass', 300, 1, 0.4 * v, dest);
  }
  if (wet && (s === 'asphalt' || s === 'gravel' || s === 'mud' || s === 'grass' || s === 'forest' || s === 'concrete')) burst(e, 'white', t + 0.02, 0.06, 'highpass', 5000, 0.8, 0.05 * v, dest); // splash
}

export function creak(e: AudioEngine, dest: Dest, dur = 0.9, pitch = 1, vol = 1) {
  const ctx = e.ctx!;
  const t = e.now;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  const base = r(150, 230) * pitch;
  o.frequency.setValueAtTime(base, t);
  for (let tt = t; tt < t + dur; ) {
    tt += r(0.02, 0.06);
    o.frequency.linearRampToValueAtTime(base * r(0.85, 1.35), tt);
  }
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1100 * pitch;
  bp.Q.value = 5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  for (let gt = t; gt < t + dur; ) {
    gt += r(0.015, 0.05);
    g.gain.linearRampToValueAtTime(r(0.02, 0.15) * vol, gt);
  }
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
  o.connect(bp).connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.1);
}

export function doorLatch(e: AudioEngine, dest: Dest, heavy = false) {
  const t = e.now;
  burst(e, 'white', t, 0.03, 'bandpass', 2400, 2, 0.35, dest);
  burst(e, 'pink', t + 0.03, heavy ? 0.3 : 0.1, 'lowpass', heavy ? 240 : 600, 1, heavy ? 0.9 : 0.4, dest);
  if (heavy) tone(e, 'sine', 70, t + 0.03, 0.5, 0.004, 0.4, dest);
}

export function doorLocked(e: AudioEngine, dest: Dest) {
  const t = e.now;
  for (let i = 0; i < 3; i++) {
    burst(e, 'white', t + i * 0.09, 0.03, 'bandpass', r(1800, 2600), 3, 0.3, dest);
    burst(e, 'pink', t + i * 0.09, 0.05, 'lowpass', 500, 1, 0.3, dest);
  }
}

export function keyTurn(e: AudioEngine, dest: Dest) {
  const t = e.now;
  burst(e, 'white', t, 0.02, 'bandpass', 4000, 4, 0.25, dest);
  burst(e, 'white', t + 0.18, 0.04, 'bandpass', 2600, 3, 0.4, dest);
  tone(e, 'square', 2200, t + 0.18, 0.05, 0.001, 0.05, dest);
}

export function click(e: AudioEngine, dest: Dest, pitch = 1) {
  const t = e.now;
  burst(e, 'white', t, 0.012, 'highpass', 2500 * pitch, 0.7, 0.4, dest);
  tone(e, 'square', 1800 * pitch, t, 0.2, 0.001, 0.03, dest);
}

export function pickup(e: AudioEngine, dest: Dest) {
  const t = e.now;
  burst(e, 'pink', t, 0.08, 'bandpass', 900, 2, 0.3, dest, 0.01);
  burst(e, 'white', t + 0.05, 0.05, 'highpass', 3000, 1, 0.1, dest);
}

export function paper(e: AudioEngine, dest: Dest, dur = 0.5) {
  const t = e.now;
  for (let i = 0; i < 12; i++) burst(e, 'white', t + Math.random() * dur, r(0.01, 0.04), 'highpass', r(2500, 5000), 0.8, r(0.05, 0.16), dest);
}

export function impact(e: AudioEngine, dest: Dest, material: 'wood' | 'metal' | 'glass' | 'plastic' | 'cardboard', strength: number) {
  const t = e.now;
  const v = Math.min(1, strength);
  switch (material) {
    case 'metal':
      burst(e, 'white', t, 0.05, 'bandpass', r(1500, 2500), 3, 0.35 * v, dest);
      [420, 1033, 1730, 2650].forEach((f) => tone(e, 'sine', f * r(0.95, 1.05), t, 0.07 * v, 0.001, r(0.3, 0.8), dest));
      break;
    case 'glass':
      [2100, 3300, 4700].forEach((f) => tone(e, 'sine', f * r(0.97, 1.03), t, 0.06 * v, 0.001, 0.25, dest));
      if (v > 0.7) for (let i = 0; i < 10; i++) burst(e, 'white', t + Math.random() * 0.25, 0.03, 'highpass', 4000, 1, 0.2, dest);
      break;
    case 'wood':
      burst(e, 'pink', t, 0.1, 'bandpass', r(300, 500), 3, 0.6 * v, dest);
      tone(e, 'sine', r(160, 220), t, 0.2 * v, 0.002, 0.12, dest);
      break;
    default:
      burst(e, 'pink', t, 0.08, 'lowpass', 700, 1, 0.5 * v, dest);
  }
}

/** Diesel generator: rope pull, cough, catch. */
export function generatorStart(e: AudioEngine, dest: Dest, succeed: boolean) {
  const t = e.now;
  const pull = burst(e, 'pink', t, 0.5, 'bandpass', 400, 2, 0.5, dest, 0.05);
  pull.bf.frequency.linearRampToValueAtTime(1400, t + 0.45);
  for (let i = 0; i < (succeed ? 6 : 3); i++) burst(e, 'brown', t + 0.5 + i * r(0.12, 0.2), 0.12, 'lowpass', 200, 1, 0.9, dest);
}
export function generatorLoop(e: AudioEngine, out: GainNode, keep: (n: AudioScheduledSourceNode) => void) {
  const ctx = e.ctx!;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = 29;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 14.5;
  const lg = ctx.createGain();
  lg.gain.value = 0.5;
  const am = ctx.createGain();
  am.gain.value = 0.5;
  lfo.connect(lg).connect(am.gain);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 340;
  o.connect(am).connect(lp).connect(out);
  const n = e.noiseSource('brown');
  const nb = ctx.createBiquadFilter();
  nb.type = 'bandpass';
  nb.frequency.value = 160;
  const ng = ctx.createGain();
  ng.gain.value = 0.6;
  n.connect(nb).connect(ng).connect(out);
  keep(o);
  keep(lfo);
  keep(n);
}

/** Radio static burst + squelch. */
export function radioSquelch(e: AudioEngine, dest: Dest, dur = 0.25) {
  const t = e.now;
  burst(e, 'white', t, dur, 'bandpass', 2200, 0.7, 0.35, dest, 0.005);
  tone(e, 'square', 1400, t + dur, 0.06, 0.002, 0.05, dest);
}

/**
 * Speech-like radio voice: formant-filtered pulse train with syllable rhythm,
 * band-limited like a walkie-talkie. Words are shown as subtitles.
 */
export function radioVoice(e: AudioEngine, dest: Dest, dur: number, pitch = 115, clean = false) {
  const ctx = e.ctx!;
  const t = e.now + 0.05;
  const src = ctx.createOscillator();
  src.type = 'sawtooth';
  src.frequency.setValueAtTime(pitch, t);
  const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter();
  f1.type = f2.type = 'bandpass';
  f1.Q.value = 6;
  f2.Q.value = 8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  const vowels: [number, number][] = [[730, 1090], [530, 1840], [300, 2300], [570, 840], [440, 1020], [400, 1600]];
  let tt = t;
  while (tt < t + dur) {
    const syl = r(0.09, 0.22);
    const [a, b] = vowels[Math.floor(Math.random() * vowels.length)];
    f1.frequency.setTargetAtTime(a, tt, 0.02);
    f2.frequency.setTargetAtTime(b, tt, 0.02);
    src.frequency.setTargetAtTime(pitch * r(0.88, 1.15), tt, 0.04);
    g.gain.setTargetAtTime(r(0.35, 0.6), tt, 0.015);
    g.gain.setTargetAtTime(0.02, tt + syl * 0.75, 0.02);
    tt += syl + (Math.random() < 0.15 ? r(0.15, 0.35) : 0.02);
  }
  g.gain.setTargetAtTime(0.0001, t + dur, 0.03);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = clean ? 1200 : 1500;
  band.Q.value = clean ? 0.4 : 0.9;
  const sum = ctx.createGain();
  src.connect(f1).connect(sum);
  src.connect(f2).connect(sum);
  sum.connect(g).connect(band).connect(dest);
  src.start(t);
  src.stop(t + dur + 0.2);
  if (!clean) {
    const n = e.noiseSource('white', false);
    const nb = ctx.createBiquadFilter();
    nb.type = 'bandpass';
    nb.frequency.value = 2500;
    const ng = ctx.createGain();
    ng.gain.value = 0.05;
    n.connect(nb).connect(ng).connect(dest);
    n.start(t, Math.random());
    n.stop(t + dur + 0.1);
  }
}

export function distantScream(e: AudioEngine, dest: Dest) {
  const ctx = e.ctx!;
  const t = e.now;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(380, t);
  o.frequency.linearRampToValueAtTime(720, t + 0.4);
  o.frequency.linearRampToValueAtTime(520, t + 1.6);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1100;
  f.Q.value = 3;
  const g = ctx.createGain();
  env(g, t, 0.12, 0.15, 1.6);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  o.connect(f).connect(g).connect(lp).connect(dest);
  o.start(t);
  o.stop(t + 2);
}

export function woodKnock(e: AudioEngine, dest: Dest, n = 3) {
  const t = e.now;
  for (let i = 0; i < n; i++) {
    burst(e, 'pink', t + i * r(0.35, 0.5), 0.07, 'bandpass', 450, 3, 0.6, dest);
    tone(e, 'sine', 180, t + i * 0.42, 0.25, 0.002, 0.1, dest);
  }
}

export function branchSnap(e: AudioEngine, dest: Dest) {
  const t = e.now;
  burst(e, 'white', t, 0.02, 'highpass', 1800, 1, 0.8, dest);
  burst(e, 'white', t + 0.025, 0.04, 'bandpass', 2400, 2, 0.4, dest);
  burst(e, 'pink', t + 0.03, 0.12, 'lowpass', 700, 1, 0.3, dest);
}

export function whistle(e: AudioEngine, dest: Dest) {
  const ctx = e.ctx!;
  const t = e.now;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(1200, t);
  o.frequency.linearRampToValueAtTime(1500, t + 0.3);
  o.frequency.linearRampToValueAtTime(900, t + 1.0);
  const g = ctx.createGain();
  env(g, t, 0.05, 0.1, 1);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 1.3);
}

export function thunder(e: AudioEngine, dest: Dest, strength = 1) {
  const t = e.now;
  const a = burst(e, 'brown', t, 3.5 + strength * 2, 'lowpass', 160, 1, 0.9 * strength, dest, 0.25);
  a.bf.frequency.linearRampToValueAtTime(70, t + 4);
  for (let i = 0; i < 5; i++) burst(e, 'brown', t + r(0.1, 1.5), r(0.4, 1), 'lowpass', 120, 1, 0.6 * strength, dest, 0.05);
}

export function flareShot(e: AudioEngine, dest: Dest) {
  const t = e.now;
  burst(e, 'white', t, 0.15, 'lowpass', 3000, 0.7, 1, dest);
  tone(e, 'sine', 90, t, 0.8, 0.002, 0.25, dest);
  const w = burst(e, 'pink', t + 0.05, 1.2, 'bandpass', 900, 1, 0.3, dest, 0.05);
  w.bf.frequency.linearRampToValueAtTime(2500, t + 1);
}
export function flareBurn(e: AudioEngine, out: GainNode, keep: (n: AudioScheduledSourceNode) => void) {
  const ctx = e.ctx!;
  const n = e.noiseSource('white');
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 3000;
  f.Q.value = 0.6;
  n.connect(f).connect(out);
  keep(n);
}

// ---- creature
export function creatureBreath(e: AudioEngine, dest: Dest, dur = 1.6) {
  const t = e.now;
  const a = burst(e, 'pink', t, dur * 0.45, 'bandpass', 500, 2, 0.5, dest, dur * 0.35);
  a.bf.frequency.linearRampToValueAtTime(800, t + dur * 0.5);
  burst(e, 'pink', t + dur * 0.55, dur * 0.4, 'bandpass', 380, 3, 0.35, dest, 0.1);
  tone(e, 'sawtooth', 55, t, 0.06, 0.2, dur * 0.7, dest);
}
export function creatureClick(e: AudioEngine, dest: Dest) {
  const t = e.now;
  const n = Math.floor(r(3, 8));
  for (let i = 0; i < n; i++) burst(e, 'white', t + i * r(0.03, 0.06), 0.01, 'bandpass', r(1800, 3200), 6, 0.6, dest);
}
export function creatureRoar(e: AudioEngine, dest: Dest) {
  const ctx = e.ctx!;
  const t = e.now;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(90, t);
  o.frequency.linearRampToValueAtTime(150, t + 0.3);
  o.frequency.linearRampToValueAtTime(60, t + 1.8);
  const ws = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 128) - 1;
    curve[i] = Math.tanh(x * 4);
  }
  ws.curve = curve;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 600;
  f.Q.value = 1.2;
  const g = ctx.createGain();
  env(g, t, 0.6, 0.08, 1.8);
  o.connect(ws).connect(f).connect(g).connect(dest);
  o.start(t);
  o.stop(t + 2.1);
  const s = burst(e, 'pink', t, 1.8, 'bandpass', 900, 1, 0.5, dest, 0.08);
  s.bf.frequency.linearRampToValueAtTime(400, t + 1.8);
}
export function creatureStep(e: AudioEngine, dest: Dest, vol = 1) {
  const t = e.now;
  burst(e, 'brown', t, 0.12, 'lowpass', 220, 1, 0.7 * vol, dest);
  burst(e, 'pink', t + 0.02, 0.06, 'bandpass', r(600, 900), 2, 0.25 * vol, dest);
}

export function heartbeat(e: AudioEngine, dest: Dest, vol = 1) {
  const t = e.now;
  tone(e, 'sine', 55, t, 0.6 * vol, 0.01, 0.12, dest);
  tone(e, 'sine', 48, t + 0.22, 0.45 * vol, 0.01, 0.15, dest);
}

export function hurt(e: AudioEngine, dest: Dest) {
  const t = e.now;
  burst(e, 'pink', t, 0.25, 'lowpass', 900, 1, 0.9, dest);
  tone(e, 'sine', 70, t, 0.7, 0.003, 0.4, dest);
}

export function sting(e: AudioEngine, dest: Dest, vol = 1) {
  const t = e.now;
  [146.8, 155.6, 220, 311.1].forEach((f, i) => {
    const g = e.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06 * vol, t + 0.05 + i * 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    const o = osc(e, i % 2 ? 'sawtooth' : 'triangle', f, t, 2.7, g);
    o.detune.value = r(-15, 15);
    const lp = e.ctx!.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    g.connect(lp).connect(dest);
  });
  burst(e, 'white', t, 0.3, 'highpass', 6000, 0.7, 0.15 * vol, dest);
}

/** Low unsettling drone (a few seconds), used sparingly. */
export function drone(e: AudioEngine, dest: Dest, dur = 12, root = 55) {
  const t = e.now;
  [1, 1.5, 2.02].forEach((m) => {
    const g = e.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const o = osc(e, 'sine', root * m, t, dur, g);
    o.detune.linearRampToValueAtTime(r(-30, 30), t + dur);
    g.connect(dest);
  });
}

export function powerDown(e: AudioEngine, dest: Dest) {
  const t = e.now;
  const o = tone(e, 'sawtooth', 120, t, 0.25, 0.01, 1.4, dest);
  o.frequency.exponentialRampToValueAtTime(25, t + 1.4);
  burst(e, 'white', t, 0.08, 'bandpass', 3000, 2, 0.4, dest);
}
export function powerUp(e: AudioEngine, dest: Dest) {
  const t = e.now;
  const o = tone(e, 'sawtooth', 30, t, 0.12, 0.6, 1.4, dest);
  o.frequency.exponentialRampToValueAtTime(100, t + 1.2);
  for (let i = 0; i < 4; i++) burst(e, 'white', t + 0.2 + i * 0.15, 0.02, 'bandpass', 2800, 3, 0.25, dest);
}
export function breaker(e: AudioEngine, dest: Dest) {
  const t = e.now;
  burst(e, 'white', t, 0.03, 'bandpass', 1500, 2, 0.6, dest);
  burst(e, 'brown', t + 0.01, 0.1, 'lowpass', 300, 1, 0.7, dest);
}
export function buzzer(e: AudioEngine, dest: Dest, ok: boolean) {
  const t = e.now;
  if (ok) {
    tone(e, 'square', 880, t, 0.08, 0.002, 0.1, dest);
    tone(e, 'square', 1320, t + 0.12, 0.08, 0.002, 0.15, dest);
  } else tone(e, 'square', 180, t, 0.12, 0.002, 0.45, dest);
}
export function uiTick(e: AudioEngine, dest: Dest, f = 1200) {
  tone(e, 'sine', f, e.now, 0.08, 0.002, 0.05, dest);
}
export function glassBreak(e: AudioEngine, dest: Dest) {
  const t = e.now;
  burst(e, 'white', t, 0.3, 'highpass', 2500, 0.8, 0.9, dest);
  for (let i = 0; i < 18; i++) tone(e, 'sine', r(2500, 6000), t + Math.random() * 0.6, 0.05, 0.001, r(0.1, 0.3), dest);
  burst(e, 'pink', t, 0.2, 'lowpass', 500, 1, 0.7, dest);
}
export function metalBang(e: AudioEngine, dest: Dest, strength = 1) {
  const t = e.now;
  burst(e, 'white', t, 0.1, 'bandpass', 900, 1, strength, dest);
  [97, 160, 233, 410].forEach((f) => tone(e, 'sine', f, t, 0.3 * strength, 0.002, 1.6, dest));
}
