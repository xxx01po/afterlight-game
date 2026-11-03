/**
 * Procedural sound library. Every sound in AFTERLIGHT is synthesised at runtime
 * with Web Audio — no recorded samples ship with the demo.
 */
import type { AudioEngine } from './AudioEngine';

type Dest = AudioNode;
const r = (a: number, b: number) => a + Math.random() * (b - a);

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function osc(e: AudioEngine, type: OscillatorType, freq: number, t: number, dur: number, dest: AudioNode) {
  const o = e.ctx!.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

function noiseBurst(e: AudioEngine, kind: 'white' | 'pink' | 'brown', t: number, dur: number, filterType: BiquadFilterType, f: number, q: number, peak: number, dest: Dest, attack = 0.002) {
  const ctx = e.ctx!;
  const s = e.noiseSource(kind, false);
  const bf = ctx.createBiquadFilter();
  bf.type = filterType;
  bf.frequency.setValueAtTime(f, t);
  bf.Q.value = q;
  const g = ctx.createGain();
  env(g, t, peak, attack, dur);
  s.connect(bf).connect(g).connect(dest);
  s.start(t, Math.random() * 2);
  s.stop(t + attack + dur + 0.05);
  return { s, bf, g };
}

/** Knock on a padded (дерматин) front door: dull body thump + knuckle tap. */
export function knock(e: AudioEngine, dest: Dest, t = e.now, strength = 1) {
  const ctx = e.ctx!;
  const g = ctx.createGain();
  env(g, t, 0.9 * strength, 0.003, 0.22);
  const o = osc(e, 'sine', 120, t, 0.3, g);
  o.frequency.exponentialRampToValueAtTime(62, t + 0.14);
  g.connect(dest);
  noiseBurst(e, 'pink', t, 0.06, 'bandpass', 380, 3, 0.7 * strength, dest);
  noiseBurst(e, 'white', t, 0.02, 'lowpass', 1800, 0.7, 0.25 * strength, dest);
}

export function knockSeq(e: AudioEngine, dest: Dest, count = 3, gap = 0.62, strength = 1, t0 = e.now + 0.05) {
  for (let i = 0; i < count; i++) knock(e, dest, t0 + i * gap + r(-0.03, 0.03), strength * r(0.85, 1.05));
}

export type Surface = 'linoleum' | 'tile' | 'laminate' | 'concrete' | 'metal';
export function footstep(e: AudioEngine, dest: Dest, surface: Surface, volume = 1) {
  const t = e.now;
  const v = volume * r(0.8, 1.1);
  switch (surface) {
    case 'tile':
      noiseBurst(e, 'white', t, 0.05, 'bandpass', r(2600, 3400), 1.5, 0.22 * v, dest);
      noiseBurst(e, 'pink', t, 0.08, 'lowpass', 500, 1, 0.3 * v, dest);
      break;
    case 'laminate':
      noiseBurst(e, 'pink', t, 0.09, 'bandpass', r(420, 520), 2.5, 0.5 * v, dest);
      noiseBurst(e, 'white', t + 0.01, 0.03, 'highpass', 3000, 0.7, 0.05 * v, dest);
      break;
    case 'concrete':
      noiseBurst(e, 'white', t, 0.07, 'bandpass', r(1500, 2200), 0.9, 0.22 * v, dest);
      noiseBurst(e, 'brown', t, 0.1, 'lowpass', 300, 1, 0.5 * v, dest);
      break;
    case 'metal':
      noiseBurst(e, 'white', t, 0.06, 'bandpass', 900, 4, 0.3 * v, dest);
      [310, 777].forEach((f) => {
        const g = e.ctx!.createGain();
        env(g, t, 0.05 * v, 0.002, 0.25);
        osc(e, 'sine', f * r(0.97, 1.03), t, 0.3, g);
        g.connect(dest);
      });
      break;
    default: // linoleum: soft, slightly sticky
      noiseBurst(e, 'pink', t, 0.08, 'bandpass', r(700, 900), 1.2, 0.35 * v, dest);
      noiseBurst(e, 'white', t + 0.04, 0.04, 'highpass', 4000, 0.6, 0.03 * v, dest);
  }
}

export function click(e: AudioEngine, dest: Dest, pitch = 1) {
  const t = e.now;
  noiseBurst(e, 'white', t, 0.012, 'highpass', 2500 * pitch, 0.7, 0.4, dest);
  const g = e.ctx!.createGain();
  env(g, t, 0.25, 0.001, 0.03);
  osc(e, 'square', 1800 * pitch, t, 0.04, g);
  g.connect(dest);
  noiseBurst(e, 'pink', t + 0.012, 0.02, 'bandpass', 1200, 2, 0.15, dest);
}

/** Stick-slip hinge creak. */
export function creak(e: AudioEngine, dest: Dest, dur = 0.9, pitch = 1) {
  const ctx = e.ctx!;
  const t = e.now;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  const base = r(160, 230) * pitch;
  o.frequency.setValueAtTime(base, t);
  let tt = t;
  while (tt < t + dur) {
    tt += r(0.02, 0.06);
    o.frequency.linearRampToValueAtTime(base * r(0.85, 1.35), tt);
  }
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1100 * pitch;
  bp.Q.value = 5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  let gt = t;
  while (gt < t + dur) {
    gt += r(0.015, 0.05);
    g.gain.linearRampToValueAtTime(r(0.02, 0.16), gt);
  }
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
  o.connect(bp).connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.1);
}

export function doorLatch(e: AudioEngine, dest: Dest, heavy = false) {
  const t = e.now;
  noiseBurst(e, 'white', t, 0.03, 'bandpass', 2400, 2, 0.35, dest);
  noiseBurst(e, 'pink', t + 0.03, heavy ? 0.25 : 0.1, 'lowpass', heavy ? 260 : 600, 1, heavy ? 0.9 : 0.4, dest);
}

export function doorSlam(e: AudioEngine, dest: Dest) {
  const t = e.now;
  const g = e.ctx!.createGain();
  env(g, t, 1, 0.003, 0.5);
  const o = osc(e, 'sine', 90, t, 0.6, g);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.4);
  g.connect(dest);
  noiseBurst(e, 'pink', t, 0.35, 'lowpass', 700, 1, 0.8, dest);
  noiseBurst(e, 'white', t + 0.05, 0.25, 'bandpass', 3000, 3, 0.08, dest); // rattle of the frame
}

export function drawer(e: AudioEngine, dest: Dest, open = true) {
  const ctx = e.ctx!;
  const t = e.now;
  const { bf } = noiseBurst(e, 'pink', t, 0.35, 'bandpass', open ? 350 : 800, 3, 0.45, dest, 0.06);
  bf.frequency.linearRampToValueAtTime(open ? 800 : 350, t + 0.35);
  noiseBurst(e, 'pink', t + 0.38, 0.08, 'lowpass', 400, 1, 0.5, dest);
  void ctx;
}

export function paper(e: AudioEngine, dest: Dest, dur = 0.5) {
  const t = e.now;
  for (let i = 0; i < 14; i++) noiseBurst(e, 'white', t + Math.random() * dur, r(0.01, 0.04), 'highpass', r(2500, 5000), 0.8, r(0.05, 0.18), dest);
}

export function paperSlide(e: AudioEngine, dest: Dest) {
  const t = e.now;
  const { bf } = noiseBurst(e, 'white', t, 0.7, 'bandpass', 2500, 1.2, 0.18, dest, 0.15);
  bf.frequency.linearRampToValueAtTime(4200, t + 0.7);
}

/** Neighbour's furniture/body thump through a concrete wall. */
export function thump(e: AudioEngine, dest: Dest, strength = 1, t = e.now) {
  const g = e.ctx!.createGain();
  env(g, t, 0.8 * strength, 0.005, 0.35);
  const o = osc(e, 'sine', 70, t, 0.45, g);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.3);
  g.connect(dest);
  noiseBurst(e, 'brown', t, 0.25, 'lowpass', 250, 1, 0.6 * strength, dest);
}

export function drag(e: AudioEngine, dest: Dest, dur = 1.6) {
  const ctx = e.ctx!;
  const t = e.now;
  const s = e.noiseSource('brown', false);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 260;
  bp.Q.value = 1.6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  let tt = t;
  while (tt < t + dur) {
    tt += r(0.04, 0.12);
    g.gain.linearRampToValueAtTime(r(0.2, 0.9), tt);
  }
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.1);
  s.connect(bp).connect(g).connect(dest);
  s.start(t, Math.random());
  s.stop(t + dur + 0.2);
}

/** Water riser: metallic tick with inharmonic partials. */
export function pipeKnock(e: AudioEngine, dest: Dest, strength = 1) {
  const t = e.now;
  [523, 1307, 2460, 3911].forEach((f, i) => {
    const g = e.ctx!.createGain();
    env(g, t, (0.12 / (i + 1)) * strength, 0.001, 0.4 - i * 0.07);
    osc(e, 'sine', f * r(0.98, 1.02), t, 0.45, g);
    g.connect(dest);
  });
}

export function gurgle(e: AudioEngine, dest: Dest, dur = 2.2) {
  const ctx = e.ctx!;
  const t = e.now;
  const s = e.noiseSource('pink', false);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 12;
  bp.frequency.setValueAtTime(400, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  let tt = t;
  while (tt < t + dur) {
    tt += r(0.03, 0.09);
    bp.frequency.linearRampToValueAtTime(r(250, 950), tt);
    g.gain.linearRampToValueAtTime(r(0.1, 0.9), tt);
  }
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.1);
  s.connect(bp).connect(g).connect(dest);
  s.start(t, Math.random());
  s.stop(t + dur + 0.2);
}

/** Wet tyres on asphalt passing under the window. */
export function carPass(e: AudioEngine, dest: Dest, dur = 6) {
  const ctx = e.ctx!;
  const t = e.now;
  const s = e.noiseSource('pink', false);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(250, t);
  lp.frequency.linearRampToValueAtTime(1600, t + dur * 0.5);
  lp.frequency.linearRampToValueAtTime(250, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.5, t + dur * 0.5);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  s.connect(lp).connect(g).connect(dest);
  s.start(t);
  s.stop(t + dur + 0.1);
}

/** Old elevator: relay clunk, motor drone, cable rattle, stop. */
export function elevatorRun(e: AudioEngine, dest: Dest, dur = 7, arriveDoors = true) {
  const ctx = e.ctx!;
  const t = e.now;
  noiseBurst(e, 'pink', t, 0.15, 'lowpass', 300, 1, 0.8, dest); // relay
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.35, t + 1.2);
  g.gain.setValueAtTime(0.35, t + dur - 1);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 260;
  g.connect(lp).connect(dest);
  const o1 = osc(e, 'sawtooth', 48, t, dur, g);
  o1.frequency.linearRampToValueAtTime(56, t + dur * 0.5);
  o1.frequency.linearRampToValueAtTime(46, t + dur);
  osc(e, 'sawtooth', 96.5, t, dur, g);
  const rat = e.noiseSource('white', false);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 700;
  bp.Q.value = 3;
  const rg = ctx.createGain();
  rg.gain.setValueAtTime(0.0001, t);
  rg.gain.linearRampToValueAtTime(0.05, t + 1.5);
  rg.gain.linearRampToValueAtTime(0.0001, t + dur);
  rat.connect(bp).connect(rg).connect(dest);
  rat.start(t);
  rat.stop(t + dur);
  const stop = t + dur;
  setTimeout(() => {
    if (!e.ctx) return;
    noiseBurst(e, 'pink', e.now, 0.3, 'lowpass', 200, 1, 1, dest); // stop clunk
    if (arriveDoors) setTimeout(() => e.ctx && elevatorDoors(e, dest), 900);
  }, (stop - e.now) * 1000);
}

export function elevatorDoors(e: AudioEngine, dest: Dest) {
  const t = e.now;
  const { bf } = noiseBurst(e, 'brown', t, 1.4, 'bandpass', 180, 2, 0.6, dest, 0.2);
  bf.frequency.linearRampToValueAtTime(320, t + 1.2);
  noiseBurst(e, 'white', t, 1.2, 'bandpass', 1500, 6, 0.04, dest, 0.3);
  noiseBurst(e, 'pink', t + 1.35, 0.2, 'lowpass', 400, 1, 0.6, dest);
}

/** Old intercom handset buzz (pattern: buzz–pause). */
export function intercomBuzz(e: AudioEngine, dest: Dest, dur = 1.1) {
  const ctx = e.ctx!;
  const t = e.now;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.14, t + 0.02);
  g.gain.setValueAtTime(0.14, t + dur);
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.03);
  const am = ctx.createGain();
  am.gain.value = 0.5;
  const lfo = osc(e, 'square', 50, t, dur, am.gain as unknown as AudioNode);
  void lfo;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 500;
  osc(e, 'square', 420, t, dur, am);
  am.connect(hp).connect(g).connect(dest);
}

/** Phone on vibrate lying on a wooden surface. */
export function vibrate(e: AudioEngine, dest: Dest, dur = 0.5) {
  const ctx = e.ctx!;
  const t = e.now;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.35, t + 0.03);
  g.gain.setValueAtTime(0.35, t + dur - 0.03);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 600;
  osc(e, 'sawtooth', 165, t, dur, lp);
  lp.connect(g).connect(dest);
  noiseBurst(e, 'white', t, dur, 'bandpass', 2200, 8, 0.04, dest, 0.02);
}

/** Original ringtone: soft mallet motif (not any manufacturer's). */
export function ringtone(e: AudioEngine, dest: Dest) {
  const notes = [659.25, 987.77, 830.61, 659.25, 739.99, 987.77];
  const t0 = e.now + 0.02;
  notes.forEach((f, i) => mallet(e, dest, f, t0 + i * 0.18, 0.18));
}

export function mallet(e: AudioEngine, dest: Dest, f: number, t: number, peak = 0.2, decay = 0.6) {
  const g = e.ctx!.createGain();
  env(g, t, peak, 0.004, decay);
  osc(e, 'sine', f, t, decay + 0.1, g);
  const g2 = e.ctx!.createGain();
  env(g2, t, peak * 0.25, 0.002, decay * 0.3);
  osc(e, 'sine', f * 3.98, t, decay * 0.4, g2);
  g.connect(dest);
  g2.connect(dest);
}

export function uiTick(e: AudioEngine, dest: Dest, f = 1200) {
  const t = e.now;
  const g = e.ctx!.createGain();
  env(g, t, 0.06, 0.002, 0.05);
  osc(e, 'sine', f, t, 0.08, g);
  g.connect(dest);
}

export function messageChime(e: AudioEngine, dest: Dest) {
  const t = e.now + 0.01;
  mallet(e, dest, 1174.66, t, 0.12, 0.35);
  mallet(e, dest, 1567.98, t + 0.11, 0.1, 0.5);
}

/**
 * Speech-like murmur heard through a door: a glottal sawtooth with a pitch
 * contour, run through switching vowel formants and heavy muffling.
 * It is deliberately unintelligible — the words live in the subtitles.
 */
export function murmur(e: AudioEngine, dest: Dest, dur: number, pitch = 210, muffle = 900, level = 0.5) {
  const ctx = e.ctx!;
  const t = e.now + 0.02;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(pitch, t);
  const f1 = ctx.createBiquadFilter();
  const f2 = ctx.createBiquadFilter();
  f1.type = f2.type = 'bandpass';
  f1.Q.value = 7;
  f2.Q.value = 9;
  const vowels = [[700, 1200], [400, 2000], [300, 800], [500, 1700], [600, 1000]];
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  let tt = t;
  while (tt < t + dur) {
    const syl = r(0.11, 0.24);
    const [a, b] = vowels[Math.floor(Math.random() * vowels.length)];
    f1.frequency.setTargetAtTime(a, tt, 0.02);
    f2.frequency.setTargetAtTime(b, tt, 0.02);
    o.frequency.setTargetAtTime(pitch * r(0.88, 1.18), tt, 0.05);
    g.gain.setTargetAtTime(r(0.5, 1) * level, tt, 0.015);
    g.gain.setTargetAtTime(0.02, tt + syl * 0.75, 0.02);
    tt += syl + (Math.random() < 0.15 ? r(0.1, 0.25) : 0);
  }
  g.gain.setTargetAtTime(0.0001, t + dur, 0.03);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = muffle;
  const mix = ctx.createGain();
  mix.gain.value = 1;
  o.connect(f1).connect(mix);
  o.connect(f2).connect(mix);
  mix.connect(g).connect(lp).connect(dest);
  // breath noise layer
  const n = e.noiseSource('pink', false);
  const ng = ctx.createGain();
  ng.gain.value = 0.15;
  n.connect(ng).connect(g);
  n.start(t);
  n.stop(t + dur + 0.2);
  o.start(t);
  o.stop(t + dur + 0.2);
}

/** Slow breathing heard over a line (intercom / phone). */
export function breathing(e: AudioEngine, dest: Dest, dur = 6) {
  const ctx = e.ctx!;
  const t = e.now;
  const s = e.noiseSource('pink', false);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 900;
  bp.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  for (let tt = t; tt < t + dur; tt += 2.6) {
    g.gain.linearRampToValueAtTime(0.25, tt + 0.9);
    g.gain.linearRampToValueAtTime(0.02, tt + 1.4);
    g.gain.linearRampToValueAtTime(0.15, tt + 2.0);
    g.gain.linearRampToValueAtTime(0.01, tt + 2.6);
  }
  s.connect(bp).connect(g).connect(dest);
  s.start(t);
  s.stop(t + dur + 0.1);
}

/** Rare music: low detuned pad. */
export function drone(e: AudioEngine, dest: Dest, dur = 18, root = 55) {
  const ctx = e.ctx!;
  const t = e.now;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.16, t + dur * 0.35);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(180, t);
  lp.frequency.linearRampToValueAtTime(520, t + dur * 0.5);
  lp.frequency.linearRampToValueAtTime(160, t + dur);
  [root, root * 1.007, root * 1.498, root * 2.01].forEach((f) => osc(e, 'sawtooth', f, t, dur, lp));
  lp.connect(g).connect(dest);
}

/** Ending motif — sparse plucked piano-like tones in D minor. */
export function endingMotif(e: AudioEngine, dest: Dest) {
  const seq: [number, number][] = [[440, 0], [349.23, 0.9], [329.63, 1.8], [293.66, 2.7], [293.66, 4.4], [220, 5.3], [261.63, 6.2], [233.08, 7.6]];
  const t0 = e.now + 0.1;
  seq.forEach(([f, dt]) => {
    mallet(e, dest, f, t0 + dt, 0.18, 2.4);
    mallet(e, dest, f / 2, t0 + dt, 0.07, 3);
  });
}

/** Mains hum surge when the power fails. */
export function powerDown(e: AudioEngine, dest: Dest) {
  const t = e.now;
  const g = e.ctx!.createGain();
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  const o = osc(e, 'sawtooth', 100, t, 1.7, g);
  o.frequency.exponentialRampToValueAtTime(30, t + 1.5);
  const lp = e.ctx!.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 300;
  g.connect(lp).connect(dest);
  noiseBurst(e, 'white', t, 0.05, 'highpass', 3000, 0.7, 0.3, dest);
}

export function bulbPop(e: AudioEngine, dest: Dest) {
  const t = e.now;
  noiseBurst(e, 'white', t, 0.04, 'highpass', 2000, 0.7, 0.5, dest);
  for (let i = 0; i < 5; i++) noiseBurst(e, 'white', t + 0.05 + Math.random() * 0.4, 0.01, 'bandpass', 5000, 2, 0.15, dest);
}

export function sting(e: AudioEngine, dest: Dest) {
  // Subtle pressure rise, not a jump-scare blast.
  const ctx = e.ctx!;
  const t = e.now;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.2, t + 2.5);
  g.gain.linearRampToValueAtTime(0.0001, t + 3.2);
  [41.2, 43.65, 82.41].forEach((f) => osc(e, 'sine', f, t, 3.3, g));
  g.connect(dest);
  noiseBurst(e, 'pink', t, 2.8, 'bandpass', 3000, 0.8, 0.04, dest, 2.4);
}
