import { useSettings } from '@/game/state/settings';
import { clamp } from '@/utils/math';

export type BusName = 'amb' | 'sfx' | 'ui' | 'music';
export interface Vec3 { x: number; y: number; z: number }

/** Decides how a sound in `sourceRoom` is heard from `listenerRoom` (walls, doors). */
export type OcclusionFn = (sourceRoom: string, listenerRoom: string) => { cutoff: number; gain: number };

/**
 * A positioned emitter: input → lowpass (occlusion) → gain → panner → bus.
 * Loops and one-shots both connect to `input`.
 */
export class SpatialSource {
  readonly input: GainNode;
  private filter: BiquadFilterNode;
  private occ: GainNode;
  private panner: PannerNode;
  constructor(private eng: AudioEngine, public pos: Vec3, public room: string, bus: BusName, hrtf = false, ref = 1.2) {
    const ctx = eng.ctx!;
    this.input = ctx.createGain();
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 20000;
    this.occ = ctx.createGain();
    this.panner = ctx.createPanner();
    this.panner.panningModel = hrtf ? 'HRTF' : 'equalpower';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = ref;
    this.panner.rolloffFactor = 1.1;
    this.panner.maxDistance = 40;
    this.setPos(pos);
    this.input.connect(this.filter).connect(this.occ).connect(this.panner).connect(eng.bus[bus]);
    eng.sources.add(this);
    this.applyOcclusion(true);
  }
  setPos(p: Vec3) {
    this.pos = p;
    const pn = this.panner;
    if (pn.positionX) {
      pn.positionX.value = p.x;
      pn.positionY.value = p.y;
      pn.positionZ.value = p.z;
    } else (pn as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(p.x, p.y, p.z);
  }
  applyOcclusion(instant = false) {
    const o = this.eng.occlusion(this.room, this.eng.listenerRoom);
    const t = this.eng.ctx!.currentTime;
    if (instant) {
      this.filter.frequency.value = o.cutoff;
      this.occ.gain.value = o.gain;
    } else {
      this.filter.frequency.setTargetAtTime(o.cutoff, t, 0.12);
      this.occ.gain.setTargetAtTime(o.gain, t, 0.12);
    }
  }
  dispose() {
    this.eng.sources.delete(this);
    try {
      this.input.disconnect();
      this.panner.disconnect();
    } catch {
      /* already gone */
    }
  }
}

/** Continuous sound (rain, hum) with a smoothed level. */
export class LoopVoice {
  readonly out: GainNode;
  private nodes: AudioScheduledSourceNode[] = [];
  constructor(private eng: AudioEngine, build: (ctx: AudioContext, out: GainNode, keep: (n: AudioScheduledSourceNode) => void) => void, dest: AudioNode, level = 0) {
    const ctx = eng.ctx!;
    this.out = ctx.createGain();
    this.out.gain.value = level;
    this.out.connect(dest);
    build(ctx, this.out, (n) => {
      this.nodes.push(n);
      n.start();
    });
  }
  level(v: number, time = 0.4) {
    const t = this.eng.ctx!.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(v, t, Math.max(0.01, time / 3));
  }
  stop() {
    this.nodes.forEach((n) => {
      try {
        n.stop();
      } catch {
        /* noop */
      }
    });
    this.out.disconnect();
  }
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  bus!: Record<BusName, GainNode>;
  noise!: { white: AudioBuffer; pink: AudioBuffer; brown: AudioBuffer };
  sources = new Set<SpatialSource>();
  listenerRoom = 'room';
  occlusion: OcclusionFn = () => ({ cutoff: 20000, gain: 1 });
  private unsub?: () => void;
  private duck = 1;

  /** Must be called from a user gesture (iOS requirement). */
  unlock() {
    if (!this.ctx) this.create();
    const ctx = this.ctx!;
    // iOS 17+: play through the ringer switch like a game should.
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) {
      try {
        nav.audioSession.type = 'playback';
      } catch {
        /* unsupported */
      }
    }
    if (ctx.state !== 'running') void ctx.resume();
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(ctx.destination);
    s.start();
  }

  private create() {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = (this.ctx = new Ctx({ latencyHint: 'interactive' }));
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.3;
    this.master.connect(comp).connect(ctx.destination);
    this.bus = { amb: ctx.createGain(), sfx: ctx.createGain(), ui: ctx.createGain(), music: ctx.createGain() };
    Object.values(this.bus).forEach((g) => g.connect(this.master));
    this.noise = { white: this.makeNoise('white'), pink: this.makeNoise('pink'), brown: this.makeNoise('brown') };
    this.applySettings();
    this.unsub = useSettings.subscribe(() => this.applySettings());
  }

  private makeNoise(kind: 'white' | 'pink' | 'brown') {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.5;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    // crossfade the loop seam
    const f = 2048;
    for (let i = 0; i < f; i++) d[len - f + i] = d[len - f + i] * (1 - i / f) + d[i] * (i / f);
    return buf;
  }

  applySettings() {
    if (!this.ctx) return;
    const s = useSettings.getState();
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master * this.duck, t, 0.05);
    this.bus.amb.gain.setTargetAtTime(s.ambience, t, 0.05);
    this.bus.sfx.gain.setTargetAtTime(s.sfx, t, 0.05);
    this.bus.ui.gain.setTargetAtTime(s.sfx * 0.8, t, 0.05);
    this.bus.music.gain.setTargetAtTime(s.music, t, 0.05);
  }

  /** Pause menu / background: lower everything smoothly. */
  setDuck(v: number) {
    this.duck = v;
    this.applySettings();
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }
  resume() {
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
  }
  get ready() {
    return !!this.ctx;
  }
  get now() {
    return this.ctx?.currentTime ?? 0;
  }

  noiseSource(kind: 'white' | 'pink' | 'brown' = 'white', loop = true) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise[kind];
    s.loop = loop;
    if (loop) s.loopStart = Math.random() * 2;
    return s;
  }

  updateListener(p: Vec3, fwd: Vec3, room: string) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(p.x, t, 0.02);
      l.positionY.setTargetAtTime(p.y, t, 0.02);
      l.positionZ.setTargetAtTime(p.z, t, 0.02);
      l.forwardX.setTargetAtTime(fwd.x, t, 0.02);
      l.forwardY.setTargetAtTime(fwd.y, t, 0.02);
      l.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    } else {
      const ll = l as unknown as { setPosition(...a: number[]): void; setOrientation(...a: number[]): void };
      ll.setPosition(p.x, p.y, p.z);
      ll.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
    if (room !== this.listenerRoom) {
      this.listenerRoom = room;
      this.sources.forEach((s) => s.applyOcclusion());
    }
  }

  /** Re-evaluate occlusion (e.g. after a door opened/closed). */
  refreshOcclusion() {
    this.sources.forEach((s) => s.applyOcclusion());
  }

  dispose() {
    this.unsub?.();
    this.sources.forEach((s) => s.dispose());
    void this.ctx?.close();
    this.ctx = null;
  }
}

export const clamp01 = (v: number) => clamp(v, 0, 1);
