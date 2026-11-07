import { AudioEngine, LoopVoice, SpatialSource, type Vec3 } from './AudioEngine';
import * as S from './synth';

export type Zone = 'base' | 'forest' | 'village' | 'complex';

/**
 * Background soundscape: rain (outdoor hiss + roof patter indoors), wind with
 * gusts, positioned one-shots (tree creaks, twigs, distant cries, knocks) chosen
 * by zone, the generator loop, electrical hum and the fear heartbeat.
 * Silence is used deliberately: event density drops near story moments.
 */
export class Ambience {
  private rainOut!: LoopVoice;
  private rainRoof!: LoopVoice;
  private wind!: LoopVoice;
  private windFilter!: BiquadFilterNode;
  private hum!: LoopVoice;
  private gen: { src: SpatialSource; loop: LoopVoice } | null = null;
  private nextEvent = 6;
  private beat = 0;
  private t = 0;
  /** 0..1, set by story to thin out random events (silence before a scare). */
  quiet = 0;
  rainLevel = 1;
  humOn = false;
  started = false;

  constructor(private e: AudioEngine) {}

  start() {
    this.started = true;
    const e = this.e;
    this.rainOut = new LoopVoice(e, (ctx, out, keep) => {
      const n = e.noiseSource('pink');
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 700;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 9000;
      n.connect(hp).connect(lp).connect(out);
      keep(n);
      const n2 = e.noiseSource('white');
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 4500;
      bp.Q.value = 0.5;
      const g2 = ctx.createGain();
      g2.gain.value = 0.25;
      n2.connect(bp).connect(g2).connect(out);
      keep(n2);
    }, e.bus.amb, 0);
    this.rainRoof = new LoopVoice(e, (ctx, out, keep) => {
      const n = e.noiseSource('brown');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      n.connect(lp).connect(out);
      keep(n);
      // drumming on tin/roof
      const n2 = e.noiseSource('pink');
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      bp.Q.value = 1.5;
      const am = ctx.createGain();
      am.gain.value = 0.2;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 7.3;
      const lg = ctx.createGain();
      lg.gain.value = 0.15;
      lfo.connect(lg).connect(am.gain);
      n2.connect(bp).connect(am).connect(out);
      keep(n2);
      keep(lfo);
    }, e.bus.amb, 0);
    this.wind = new LoopVoice(e, (ctx, out, keep) => {
      const n = e.noiseSource('brown');
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 380;
      bp.Q.value = 0.8;
      this.windFilter = bp;
      n.connect(bp).connect(out);
      keep(n);
    }, e.bus.amb, 0);
    this.hum = new LoopVoice(e, (ctx, out, keep) => {
      const o = ctx.createOscillator();
      o.frequency.value = 50;
      const o2 = ctx.createOscillator();
      o2.frequency.value = 100;
      const g = ctx.createGain();
      g.gain.value = 0.4;
      o.connect(out);
      o2.connect(g).connect(out);
      const n = e.noiseSource('white');
      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 7000;
      const ng = ctx.createGain();
      ng.gain.value = 0.1;
      n.connect(hp).connect(ng).connect(out);
      keep(o);
      keep(o2);
      keep(n);
    }, e.bus.amb, 0);
  }

  setGenerator(on: boolean, pos: Vec3) {
    if (on && !this.gen) {
      const src = new SpatialSource(this.e, pos, 'amb', 2.5, 1.2);
      const loop = new LoopVoice(this.e, (_c, out, keep) => S.generatorLoop(this.e, out, keep), src.input, 0);
      loop.level(0.55, 2.5);
      this.gen = { src, loop };
    } else if (!on && this.gen) {
      const g = this.gen;
      g.loop.level(0, 1.5);
      setTimeout(() => {
        g.loop.stop();
        g.src.dispose();
      }, 2000);
      this.gen = null;
    }
  }

  /** Positioned one-shot helper. */
  private oneShot(listener: Vec3, dist: number, play: (d: AudioNode) => void, muffle = 1) {
    const a = Math.random() * Math.PI * 2;
    const p = { x: listener.x + Math.cos(a) * dist, y: listener.y + Math.random() * 3, z: listener.z + Math.sin(a) * dist };
    this.e.at(p, play, 'amb', 4, muffle, 3);
  }

  update(dt: number, listener: Vec3, zone: Zone, indoorClosed: number, fear: number, wind: number) {
    if (!this.e.ready || !this.rainOut) return;
    this.t += dt;
    const out = 1 - indoorClosed;
    this.rainOut.level((0.08 + 0.32 * out) * this.rainLevel, 0.6);
    this.rainRoof.level(indoorClosed * 0.25 * this.rainLevel, 0.6);
    const gust = 0.5 + 0.5 * Math.sin(this.t * 0.21) * Math.sin(this.t * 0.07 + 1);
    this.wind.level((0.05 + 0.2 * gust * wind) * (0.3 + 0.7 * out), 1.2);
    this.windFilter?.frequency.setTargetAtTime(260 + gust * 420, this.e.now, 0.8);
    this.hum.level(this.humOn && zone === 'complex' && indoorClosed > 0.5 ? 0.025 : 0, 0.8);
    // random positioned events
    this.nextEvent -= dt * (1 - this.quiet * 0.9);
    if (this.nextEvent <= 0) {
      this.nextEvent = 5 + Math.random() * 12;
      const roll = Math.random();
      const m = indoorClosed > 0.5 ? 0.35 : 1;
      if (zone === 'forest' || zone === 'village') {
        if (roll < 0.35) this.oneShot(listener, 12 + Math.random() * 20, (d) => S.creak(this.e, d, 1.4 + Math.random() * 1.5, 0.45, 1.2), m);
        else if (roll < 0.6) this.oneShot(listener, 8 + Math.random() * 18, (d) => S.branchSnap(this.e, d), m);
        else if (roll < 0.7) this.oneShot(listener, 40, (d) => S.distantScream(this.e, d), m * 0.6);
        else if (roll < 0.8) this.oneShot(listener, 25, (d) => S.woodKnock(this.e, d, 2 + Math.floor(Math.random() * 3)), m);
        else if (roll < 0.86) this.oneShot(listener, 35, (d) => S.whistle(this.e, d), m);
      } else if (zone === 'base') {
        if (roll < 0.3) this.oneShot(listener, 15, (d) => S.creak(this.e, d, 0.8, 0.6, 0.6), m);
        else if (roll < 0.45) this.oneShot(listener, 40, (d) => S.branchSnap(this.e, d), 0.6);
      } else if (zone === 'complex') {
        if (roll < 0.3) this.oneShot(listener, 10, (d) => S.metalBang(this.e, d, 0.25), 0.5);
        else if (roll < 0.55) this.oneShot(listener, 8, (d) => S.creak(this.e, d, 1.2, 0.35, 0.8), 0.7);
      }
    }
    // heartbeat when afraid
    if (fear > 0.25) {
      this.beat -= dt;
      if (this.beat <= 0) {
        this.beat = 1.1 - fear * 0.55;
        S.heartbeat(this.e, this.e.bus.sfx, fear * 0.9);
      }
    }
  }
}
