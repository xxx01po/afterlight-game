import * as THREE from 'three';
import type { Game } from '@/smena/Game';
import * as S from '@/smena/audio/synth';
import { rng } from '@/utils/math';
import { heightAt } from '@/smena/world/layout';

/**
 * Psychological horror layer: events that make the player doubt what they see
 * and hear. Each has its own trigger condition; some are rare (decided per run
 * by the save's seed, so every playthrough differs but a reload doesn't reroll).
 * No jump-scare spam: at most one active anomaly at a time, with cooldowns.
 */
export class Anomalies {
  private R = rng(1);
  private roll: Record<string, boolean> = {};
  private done = new Set<string>();
  private echoSteps = 0;
  private echoActive = 0;
  private figureT = 0;
  private windowT = 0;
  private cooldown = 0;
  private darkT = 0;
  private dupSign: THREE.Object3D | null = null;
  /** 0..1 — makes the flashlight stutter and the image warp a little. */
  disturb = 0;

  constructor(private g: Game) {}

  reseed(seed: number) {
    this.R = rng(seed);
    // which rare events happen this run
    this.roll = {
      footsteps: this.R() < 0.85,
      roadFigure: this.R() < 0.9,
      roadFigureAlt: this.R() < 0.5,
      window: this.R() < 0.7,
      moved: this.R() < 0.8,
      roadChange: this.R() < 0.75,
      whisper: this.R() < 0.5,
      returnFigure: this.R() < 0.35,
    };
  }

  reset() {
    this.done.clear();
    this.echoActive = 0;
    this.figureT = 0;
    this.windowT = 0;
    this.cooldown = 0;
    this.disturb = 0;
    if (this.dupSign) this.dupSign.visible = false;
  }

  private markDone(k: string) {
    this.done.add(k);
    this.g.setFlag('an_' + k);
    this.cooldown = 20;
  }
  private isDone(k: string) {
    return this.done.has(k) || this.g.flag('an_' + k) > 0;
  }

  /** "You hear your own footsteps behind you": echo each step a beat late, from behind. */
  onFootstep(running: boolean) {
    if (this.echoActive <= 0 || running) return;
    const g = this.g;
    this.echoSteps++;
    const back = g.player.forward().multiplyScalar(-3.5).add(g.player.pos).setY(g.player.pos.y + 0.2);
    setTimeout(() => g.sfx((d) => S.footstep(g.audio, d, g.player.surface, 0.55), back), 260 + Math.random() * 60);
  }

  private looking(p: THREE.Vector3, cos = 0.9) {
    const cam = this.g.engine.camera;
    const d = p.clone().sub(cam.position).normalize();
    return d.dot(new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)) > cos;
  }

  update(dt: number, _t: number) {
    const g = this.g;
    if (g.mode !== 'play') return;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.disturb = Math.max(0, this.disturb - dt * 0.4);
    const sp = g.world.ctx.spots;
    const pp = g.player.pos;
    const st = g.stage;

    // 1) footsteps behind you on the forest road
    if (this.roll.footsteps && !this.isDone('footsteps') && st >= 7 && this.cooldown <= 0) {
      if (sp.footstepsBehind.position.distanceTo(pp) < 6) {
        this.echoActive = 14;
        this.echoSteps = 0;
        this.markDone('footsteps');
      }
    }
    if (this.echoActive > 0) {
      this.echoActive -= dt;
      // turning around ends it instantly — there is nobody there
      const back = g.player.forward().multiplyScalar(-4).add(pp).setY(pp.y + 1.5);
      if (this.looking(back, 0.6) || g.player.running) this.echoActive = 0;
    }

    // 2) distant figure on the road that vanishes as you approach or light it
    const figSpot = this.roll.roadFigureAlt ? sp.fork : sp.figureFar;
    if (this.roll.roadFigure && !this.isDone('roadFigure') && st >= 7 && st <= 9 && this.cooldown <= 0) {
      const d = figSpot.position.distanceTo(pp);
      if (d < 42 && d > 26 && this.looking(figSpot.position.clone().setY(figSpot.position.y + 1.2), 0.82)) {
        const f = g.figures.roadMan;
        g.figures.place(f, figSpot.position.x, figSpot.position.y, figSpot.position.z, pp.x, pp.z);
        this.figureT = 14;
        this.markDone('roadFigure');
      }
    }
    // a second, rarer appearance on the way back
    if (this.roll.returnFigure && !this.isDone('returnFigure') && st === 12 && this.cooldown <= 0) {
      const s = sp.complexRoad.position;
      if (s.distanceTo(pp) < 40 && s.distanceTo(pp) > 24 && this.looking(s.clone().setY(s.y + 1.2), 0.85)) {
        g.figures.place(g.figures.roadMan, s.x, s.y, s.z, pp.x, pp.z);
        this.figureT = 8;
        this.markDone('returnFigure');
      }
    }
    if (this.figureT > 0) {
      this.figureT -= dt;
      const f = g.figures.roadMan.root;
      f.rotation.y = Math.atan2(pp.x - f.position.x, pp.z - f.position.z);
      const d = f.position.distanceTo(pp);
      const lit = g.flashlight.illuminates(f.position.clone().setY(f.position.y + 1.2), 40) && d < 30;
      if (d < 18 || lit || this.figureT <= 0) {
        // vanish only when not looked at directly, or with a burst of static if lit
        if (lit || !this.looking(f.position, 0.95) || d < 12) {
          f.visible = false;
          this.figureT = 0;
          if (lit || d < 18) {
            g.sfx((x) => S.radioSquelch(g.audio, x, 0.5), undefined, 'voice');
            g.engine.post.u.uStatic.value = 0.35;
            setTimeout(() => (g.engine.post.u.uStatic.value = 0), 180);
            this.disturb = 0.6;
          }
        }
      }
    }

    // 3) the road changes behind you: lamps die and the fork sign appears again ahead
    if (this.roll.roadChange && !this.isDone('roadChange') && st >= 7 && st <= 9 && sp.roadChange.position.distanceTo(pp) < 4) {
      this.markDone('roadChange');
      for (const l of g.world.ctx.lamps) if (l.id.startsWith('roadLamp') && l.pos.z > pp.z + 5) l.on = false;
      if (!this.dupSign) {
        // reuse the fork sign's look: a lone sign pointing back where you came from
        const sign = g.world.ctx.dynamic.forkSign;
        if (sign) {
          this.dupSign = sign.clone();
          g.world.ctx.root.add(this.dupSign);
        }
      }
      if (this.dupSign) {
        const p = sp.creatureCross.position, dir = sp.creatureCross.userData.dir as THREE.Vector3;
        const x = p.x - dir.z * 2.6 + dir.x * 6, z = p.z + dir.x * 2.6 + dir.z * 6;
        this.dupSign.position.set(x, heightAt(x, z), z);
        this.dupSign.rotation.y = Math.atan2(-dir.x, -dir.z);
        this.dupSign.visible = true;
      }
    }
    if (this.dupSign?.visible && this.dupSign.position.distanceTo(pp) < 7 && !this.looking(this.dupSign.position, 0.4)) this.dupSign.visible = false;

    // 4) silhouette in the boarded house's window
    if (this.roll.window && !this.isDone('window') && st >= 8 && st <= 9 && this.cooldown <= 0) {
      const w = sp.h2Window.position;
      const d = w.distanceTo(pp);
      if (d < 24 && d > 8 && this.looking(w, 0.88)) {
        const f = g.figures.windowMan;
        g.figures.place(f, w.x, 0.3, w.z - 1.0, pp.x, pp.z);
        const candle = g.world.ctx.lamps.find((l) => l.id === 'h2Candle');
        if (candle) {
          candle.on = true;
          candle.intensity = 2.5;
        }
        this.windowT = 5;
        this.markDone('window');
      }
    }
    if (this.windowT > 0) {
      this.windowT -= dt;
      const f = g.figures.windowMan.root;
      const lit = g.flashlight.illuminates(f.position.clone().setY(1.6), 30);
      if (lit || this.windowT <= 0 || f.position.distanceTo(pp) < 7) {
        f.visible = false;
        const candle = g.world.ctx.lamps.find((l) => l.id === 'h2Candle');
        if (candle) candle.on = false;
        this.windowT = 0;
        if (lit) this.disturb = 0.5;
      }
    }

    // 5) things move in the radio house when you're not looking
    if (this.roll.moved && !this.isDone('moved') && st >= 8) {
      const inside = g.world.indoorAt(pp)?.name === 'h3';
      if (inside) g.setFlag('visitedH3');
      if (g.flag('visitedH3') && !inside && sp.h3Chair.position.distanceTo(pp) > 5 && !this.looking(sp.h3Chair.position, 0.3)) {
        const stool = g.ph?.props.find((p) => p.id.startsWith('stool') && p.home.distanceTo(sp.h3Chair.position) < 4);
        if (stool) {
          const c = sp.h3Chair.position;
          stool.body.setEnabled(true);
          stool.body.setTranslation({ x: c.x + 0.3, y: c.y + 0.3, z: c.z + 1.4 }, true);
          stool.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        }
        // the photo of the guards turns face-down
        const photo = g.world.ctx.docs.find((dd) => dd.docId === 'photoGuards');
        if (photo) photo.mesh.rotation.y += Math.PI;
        this.markDone('moved');
      }
    }

    // 6) whisper in the dark: too long in the forest with the flashlight off
    if (this.roll.whisper && !this.isDone('whisper') && g.zone() === 'forest' && st >= 7) {
      this.darkT = g.flashlight.on ? 0 : this.darkT + dt;
      if (this.darkT > 18) {
        const p = g.player.forward().multiplyScalar(-1.2).add(pp).setY(pp.y + 1.6);
        g.sfx((d) => S.radioVoice(g.audio, d, 2.2, 160, true), p);
        this.markDone('whisper');
      }
    }
  }
}
