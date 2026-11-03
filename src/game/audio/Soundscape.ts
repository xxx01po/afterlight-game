import { AudioEngine, LoopVoice, SpatialSource, type Vec3, type BusName } from './AudioEngine';
import * as S from './synth';

type Synth = (e: AudioEngine, dest: AudioNode) => void;

/**
 * The living sound of the building: positioned loops (rain at windows,
 * fridge, vents, TV, tap, lamp buzz), a near-silent room tone, and helpers to
 * fire positioned one-shots. "Silence" is a state, not an absence of code.
 */
export class Soundscape {
  private loops: Record<string, { voice: LoopVoice; src: SpatialSource | null; level: number }> = {};
  private fridgeTimer = 30;
  private fridgeOn = true;
  power = true;
  rainLevel = 1;

  constructor(readonly eng: AudioEngine, private roomAt: (p: Vec3) => string, anchors: Record<string, Vec3>) {
    const e = eng;
    const add = (id: string, pos: Vec3 | null, level: number, bus: BusName, build: (ctx: AudioContext, out: GainNode, keep: (n: AudioScheduledSourceNode) => void) => void, ref = 1.2) => {
      const src = pos ? new SpatialSource(e, pos, this.roomAt(pos), bus, false, ref) : null;
      const voice = new LoopVoice(e, build, src ? src.input : e.bus[bus], level);
      this.loops[id] = { voice, src, level };
    };
    const noiseThrough = (kind: 'white' | 'pink' | 'brown', type: BiquadFilterType, f: number, q: number, gain: number) => (ctx: AudioContext, out: GainNode, keep: (n: AudioScheduledSourceNode) => void) => {
      const n = e.noiseSource(kind);
      const bf = ctx.createBiquadFilter();
      bf.type = type;
      bf.frequency.value = f;
      bf.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      n.connect(bf).connect(g).connect(out);
      keep(n);
    };
    // rain on the facade, heard through the windows
    const rain = (ctx: AudioContext, out: GainNode, keep: (n: AudioScheduledSourceNode) => void) => {
      noiseThrough('pink', 'bandpass', 1400, 0.4, 0.9)(ctx, out, keep);
      noiseThrough('white', 'highpass', 5000, 0.5, 0.08)(ctx, out, keep);
      noiseThrough('brown', 'lowpass', 300, 0.7, 0.5)(ctx, out, keep);
    };
    add('rainRoom', anchors.rainRoom, 0.5, 'amb', rain, 2);
    add('rainKitchen', anchors.rainKitchen, 0.45, 'amb', rain, 2);
    add('rainLanding', anchors.rainLanding, 0.3, 'amb', rain, 2);
    // room tone: what an apartment sounds like when "silent"
    add('roomTone', null, 0.05, 'amb', noiseThrough('brown', 'lowpass', 140, 0.7, 1));
    // fridge compressor hum
    add('fridge', anchors.fridge, 0.12, 'amb', (ctx, out, keep) => {
      for (const [f, g] of [[50, 0.5], [100, 0.35], [150, 0.12], [233, 0.04]] as const) {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        const gg = ctx.createGain();
        gg.gain.value = g;
        o.connect(gg).connect(out);
        keep(o);
      }
      noiseThrough('pink', 'bandpass', 600, 2, 0.15)(ctx, out, keep);
    });
    add('ventBath', anchors.ventBath, 0.06, 'amb', noiseThrough('brown', 'bandpass', 220, 0.8, 1));
    add('ventKitchen', anchors.ventKitchen, 0.05, 'amb', noiseThrough('brown', 'bandpass', 260, 0.8, 1));
    add('tv', anchors.tv, 0, 'sfx', noiseThrough('white', 'bandpass', 3200, 0.6, 0.6));
    add('tap', anchors.tap, 0, 'sfx', (ctx, out, keep) => {
      noiseThrough('white', 'bandpass', 2600, 0.8, 0.7)(ctx, out, keep);
      noiseThrough('pink', 'lowpass', 700, 0.7, 0.4)(ctx, out, keep);
    });
    add('lampBuzz', anchors.hallLamp, 0, 'sfx', (ctx, out, keep) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 100;
      const lp = ctx.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.value = 1800;
      lp.Q.value = 2;
      o.connect(lp).connect(out);
      keep(o);
    });
    add('kettle', anchors.kettle, 0, 'sfx', noiseThrough('pink', 'bandpass', 900, 1.5, 0.8));
  }

  level(id: string, v: number, time = 0.4) {
    const l = this.loops[id];
    if (!l) return;
    l.level = v;
    l.voice.level(v, time);
  }

  setRain(v: number, time = 1.5) {
    this.rainLevel = v;
    this.level('rainRoom', 0.5 * v, time);
    this.level('rainKitchen', 0.45 * v, time);
    this.level('rainLanding', 0.3 * v, time);
  }

  setPower(on: boolean) {
    this.power = on;
    this.level('fridge', on && this.fridgeOn ? 0.12 : 0, on ? 1 : 0.05);
    this.level('ventBath', on ? 0.06 : 0, 0.3);
    this.level('ventKitchen', on ? 0.05 : 0, 0.3);
    this.level('roomTone', on ? 0.05 : 0.0, 0.5);
    if (!on) {
      this.level('tv', 0, 0.05);
      this.level('lampBuzz', 0, 0.05);
    }
  }

  /** Positioned one-shot. A temporary emitter is created and freed afterwards. */
  at(pos: Vec3, fn: Synth, life = 4, hrtf = false, bus: BusName = 'sfx') {
    if (!this.eng.ready) return;
    const src = new SpatialSource(this.eng, pos, this.roomAt(pos), bus, hrtf);
    fn(this.eng, src.input);
    setTimeout(() => src.dispose(), life * 1000);
  }

  /** Non-positional (the player's own body / phone in hand). */
  local(fn: Synth, bus: BusName = 'sfx') {
    if (!this.eng.ready) return;
    fn(this.eng, this.eng.bus[bus]);
  }

  /** Re-map positioned loops after rooms changed (not needed for static anchors). */
  refresh() {
    this.eng.refreshOcclusion();
  }

  update(dt: number) {
    // fridge cycles on and off, like a real one
    this.fridgeTimer -= dt;
    if (this.fridgeTimer <= 0) {
      this.fridgeOn = !this.fridgeOn;
      this.fridgeTimer = this.fridgeOn ? 70 : 35;
      if (this.power) {
        this.level('fridge', this.fridgeOn ? 0.12 : 0, this.fridgeOn ? 2 : 0.6);
        if (!this.fridgeOn) this.at(this.loops.fridge.src!.pos, (e, d) => S.pipeKnock(e, d, 0.5));
      }
    }
  }

  dispose() {
    Object.values(this.loops).forEach((l) => {
      l.voice.stop();
      l.src?.dispose();
    });
  }
}
