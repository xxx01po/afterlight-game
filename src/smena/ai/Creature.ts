import * as THREE from 'three';
import type * as RAPIER_NS from '@dimforge/rapier3d-compat';
import { FSM } from './fsm';
import type { NavGraph } from './NavGraph';
import { stepAwareness, visibility, hears } from './perception';
import { animateRig, buildHumanoid, type Gait, type Rig } from '@/smena/horror/rig';
import { G, groups, type Physics } from '@/smena/core/Physics';
import type { Door } from '@/smena/world/Door';
import type { P2 } from '@/smena/world/layout';

export type CState = 'Idle' | 'Patrol' | 'Investigate' | 'Chase' | 'Search' | 'Attack' | 'Return' | 'Flee';
export type CMode = 'off' | 'passive' | 'hunt';

export interface CreatureEnv {
  ph: Physics;
  nav: NavGraph;
  doors: Door[];
  playerPos: () => THREE.Vector3; // feet
  playerEye: () => THREE.Vector3;
  playerState: () => { crouching: boolean; moving: boolean; flashlightOn: boolean; inLight: boolean; inCover: boolean; dead: boolean };
  litByFlashlight: (p: THREE.Vector3) => boolean;
  damagePlayer: (n: number, from: THREE.Vector3) => void;
  /** Areas the creature refuses to enter (the lit compound). */
  forbidden: (x: number, z: number) => boolean;
  sound: (kind: 'step' | 'breath' | 'click' | 'roar' | 'hit', pos: THREE.Vector3) => void;
  onState?: (s: CState) => void;
}

const SPEED: Record<CState, number> = { Idle: 0, Patrol: 1.25, Investigate: 2.0, Chase: 4.35, Search: 1.6, Attack: 0.6, Return: 1.5, Flee: 4.8 };

/**
 * The thing in the forest. FSM: Idle → Patrol ↔ Investigate → Chase → Attack,
 * Chase → Search (lost sight) → Return → Patrol; Flee when hit by a flare.
 * It walks the nav graph, steers around obstacles with a character controller,
 * opens doors it bumps into, and never teleports while the player can see it.
 */
export class Creature {
  readonly rig: Rig;
  readonly root: THREE.Group;
  readonly pos = new THREE.Vector3();
  private yaw = 0;
  mode: CMode = 'off';
  readonly fsm: FSM<CState, Creature>;
  awareness = 0;
  lastKnown = new THREE.Vector3();
  private noisePos: THREE.Vector3 | null = null;
  private path: THREE.Vector3[] = [];
  private patrol: THREE.Vector3[] = [];
  private patrolIdx = 0;
  private searchLeft = 0;
  private attackCd = 0;
  private attackT = 0;
  private hitDone = false;
  private gait: Gait = 'idle';
  private phase = 0;
  private stuckT = 0;
  private stuckRef = new THREE.Vector3();
  private senseT = 0;
  private soundT = 0;
  private twitch = 0;
  private lostT = 0;
  private kcc: RAPIER_NS.KinematicCharacterController | null = null;
  private collider: RAPIER_NS.Collider | null = null;
  private vy = 0;
  seesPlayer = false;
  /** Difficulty assist (lowered after repeated deaths). */
  speedScale = 1;
  distToPlayer = 999;
  /** Story hook: passive sightings end by walking off and despawning. */
  onLeave?: () => void;

  constructor(private env: CreatureEnv) {
    const skin = new THREE.MeshStandardMaterial({ color: 0x24221f, roughness: 0.32, metalness: 0.1 });
    const body = new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 0.45 });
    const eyes = new THREE.MeshBasicMaterial({ color: 0x9a9a88 });
    this.rig = buildHumanoid({ height: 2.45, girth: 0.62, arms: 1.55, body, skin, eyes });
    this.root = this.rig.root;
    this.root.visible = false;
    this.fsm = new FSM<CState, Creature>(this, {
      Idle: { enter: (c) => (c.gait = 'stand'), update: (c, _dt, t) => (t > 2.5 ? 'Patrol' : c.senseState()) },
      Patrol: {
        enter: (c) => c.pathToPatrol(),
        update: (c) => {
          const s = c.senseState();
          if (s) return s;
          if (c.followPath()) {
            c.patrolIdx = (c.patrolIdx + 1) % Math.max(1, c.patrol.length);
            if (c.mode === 'passive' && c.patrolIdx === 0) {
              c.despawn();
              c.onLeave?.();
              return;
            }
            c.pathToPatrol();
          }
        },
      },
      Investigate: {
        enter: (c) => c.pathTo(c.noisePos ?? c.lastKnown),
        update: (c, _dt, t) => {
          const s = c.senseState(true);
          if (s) return s;
          if (c.followPath() || t > 14) return c.mode === 'passive' ? 'Return' : 'Search';
        },
      },
      Chase: {
        enter: (c) => {
          c.env.sound('roar', c.pos);
          c.twitch = 1;
          c.lostT = 0;
        },
        update: (c, dt) => {
          if (c.mode === 'passive') return 'Return';
          const pp = c.env.playerPos();
          if (c.env.forbidden(pp.x, pp.z)) return 'Search';
          if (c.seesPlayer) {
            c.lastKnown.copy(pp);
            c.lostT = 0;
            c.path = [pp.clone()];
          } else {
            c.lostT += dt;
            if (c.path.length === 0) c.pathTo(c.lastKnown);
          }
          c.followPath();
          if (c.distToPlayer < 1.7 && c.seesPlayer && c.attackCd <= 0) return 'Attack';
          if (c.lostT > 4.5) return 'Search';
          c.sense(dt);
        },
      },
      Attack: {
        enter: (c) => {
          c.attackT = 0;
          c.hitDone = false;
          c.gait = 'attack';
        },
        update: (c, dt) => {
          c.attackT += dt;
          c.faceTo(c.env.playerPos(), dt, 10);
          if (!c.hitDone && c.attackT > 0.45) {
            c.hitDone = true;
            if (c.distToPlayer < 2.3) {
              c.env.damagePlayer(34, c.pos);
              c.env.sound('hit', c.pos);
            }
          }
          if (c.attackT > 0.9) {
            c.attackCd = 1.3;
            return 'Chase';
          }
        },
      },
      Search: {
        enter: (c) => {
          c.searchLeft = 12;
          c.pathTo(c.randomNear(c.lastKnown, 7));
        },
        update: (c, dt) => {
          const s = c.senseState(true);
          if (s) return s;
          c.searchLeft -= dt;
          if (c.followPath()) c.pathTo(c.randomNear(c.lastKnown, 9));
          if (c.searchLeft <= 0) return 'Return';
        },
      },
      Return: {
        enter: (c) => c.pathToPatrol(true),
        update: (c) => {
          const s = c.mode === 'hunt' ? c.senseState() : undefined;
          if (s) return s;
          if (c.followPath()) return 'Patrol';
        },
      },
      Flee: {
        enter: (c) => {
          c.env.sound('roar', c.pos);
          const away = c.pos.clone().sub(c.env.playerPos()).setY(0).normalize().multiplyScalar(25).add(c.pos);
          c.pathTo(away);
          c.awareness = 0;
        },
        update: (c, _dt, t) => {
          c.followPath();
          if (t > 6) return 'Return';
        },
      },
    }, 'Idle');
    this.fsm.onChange = (_f, to) => this.env.onState?.(to);
  }

  attach(scene: THREE.Scene) {
    scene.add(this.root);
    const ph = this.env.ph;
    const R = ph.R;
    this.collider = ph.world.createCollider(R.ColliderDesc.capsule(0.75, 0.32).setTranslation(0, -50, 0).setCollisionGroups(groups(G.CREATURE, G.STATIC | G.DOOR | G.PROP | G.PLAYER)));
    ph.owners.set(this.collider.handle, this);
    const k = ph.world.createCharacterController(0.05);
    k.enableAutostep(0.4, 0.2, false);
    k.enableSnapToGround(0.5);
    k.setMaxSlopeClimbAngle(1);
    k.setApplyImpulsesToDynamicBodies(true);
    k.setCharacterMass(90);
    this.kcc = k;
  }

  spawn(x: number, y: number, z: number, mode: CMode, patrol: P2[]) {
    this.mode = mode;
    this.pos.set(x, y, z);
    this.collider?.setTranslation({ x, y: y + 1.07, z });
    this.patrol = patrol.map(([px, pz]) => new THREE.Vector3(px, 0, pz));
    this.patrolIdx = 0;
    this.awareness = 0;
    this.root.visible = true;
    this.fsm.go('Idle');
    this.path = [];
  }

  despawn() {
    this.mode = 'off';
    this.root.visible = false;
    this.collider?.setTranslation({ x: 0, y: -50, z: 0 });
  }

  /** Noise events from the player (footsteps, thrown objects, shots). */
  hearNoise(p: THREE.Vector3, radius: number) {
    if (this.mode === 'off') return;
    const d = p.distanceTo(this.pos);
    const walls = !this.env.ph.clearLine(new THREE.Vector3(this.pos.x, this.pos.y + 1.5, this.pos.z), new THREE.Vector3(p.x, p.y + 1, p.z));
    if (!hears(d, radius, walls)) return;
    if (this.fsm.state === 'Chase' || this.fsm.state === 'Attack' || this.fsm.state === 'Flee') return;
    this.noisePos = p.clone();
    this.lastKnown.copy(p);
    this.twitch = 0.6;
    if (this.fsm.state === 'Investigate') this.pathTo(p);
    else this.fsm.go('Investigate');
  }

  /** Flare hit / blinding light. */
  stun() {
    if (this.mode === 'off') return;
    this.fsm.go('Flee');
  }

  private sense(dt: number) {
    const ps = this.env.playerState();
    const eye = new THREE.Vector3(this.pos.x, this.pos.y + 2.2, this.pos.z);
    const pe = this.env.playerEye();
    const d = pe.distanceTo(eye);
    this.distToPlayer = this.pos.distanceTo(this.env.playerPos());
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const dir = pe.clone().sub(eye).setY(0).normalize();
    const los = d < 40 && this.env.ph.clearLine(eye, pe);
    const vis = ps.dead
      ? 0
      : visibility({ dist: d, cosAngle: fwd.dot(dir), lineOfSight: los, flashlightOn: ps.flashlightOn, litByFlashlight: this.env.litByFlashlight(eye.clone().setY(this.pos.y + 1.6)), crouching: ps.crouching, moving: ps.moving, inLight: ps.inLight, inCover: ps.inCover });
    this.seesPlayer = vis > 0.05;
    this.awareness = stepAwareness(this.awareness, vis, dt);
    if (this.seesPlayer) this.lastKnown.copy(this.env.playerPos());
  }

  /** Perception-driven transitions shared by calm states. */
  private senseState(alert = false): CState | void {
    if (this.mode === 'passive') {
      // in the first sighting it notices you, stares, and leaves
      if (this.awareness > 0.6) {
        this.awareness = 0;
        return 'Return';
      }
      return;
    }
    if (this.awareness >= 1 || (alert && this.awareness > 0.7)) return 'Chase';
    if (this.awareness > 0.35 && this.fsm.state !== 'Investigate') {
      this.noisePos = this.lastKnown.clone();
      return 'Investigate';
    }
  }

  private pathTo(target: THREE.Vector3) {
    const nav = this.env.nav;
    const blocked = (n: { x: number; z: number }) => this.env.forbidden(n.x, n.z);
    const a = nav.nearest(this.pos.x, this.pos.z, (n) => !blocked(n));
    const b = nav.nearest(target.x, target.z, (n) => !blocked(n));
    const ids = nav.path(a, b, blocked);
    this.path = ids.map((i) => new THREE.Vector3(nav.nodes[i].x, 0, nav.nodes[i].z));
    // skip the first node if it's behind us
    if (this.path.length > 1 && this.path[1].distanceTo(this.pos) < this.path[0].distanceTo(this.path[1])) this.path.shift();
    if (!this.env.forbidden(target.x, target.z)) this.path.push(target.clone());
  }

  private pathToPatrol(nearest = false) {
    if (!this.patrol.length) return;
    if (nearest) {
      let bi = 0, bd = Infinity;
      this.patrol.forEach((p, i) => {
        const d = p.distanceToSquared(this.pos);
        if (d < bd) (bd = d), (bi = i);
      });
      this.patrolIdx = bi;
    }
    this.pathTo(this.patrol[this.patrolIdx]);
  }

  private randomNear(p: THREE.Vector3, r: number) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const q = new THREE.Vector3(p.x + Math.cos(a) * r * Math.random(), 0, p.z + Math.sin(a) * r * Math.random());
      if (!this.env.forbidden(q.x, q.z)) return q;
    }
    return p.clone();
  }

  /** Returns true when the path is finished. */
  private followPath(): boolean {
    while (this.path.length && Math.hypot(this.path[0].x - this.pos.x, this.path[0].z - this.pos.z) < 1.1) this.path.shift();
    return this.path.length === 0;
  }

  private faceTo(p: THREE.Vector3, dt: number, k = 5) {
    const ty = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    let d = ty - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, dt * k);
  }

  update(dt: number, t: number) {
    if (this.mode === 'off' || dt <= 0) return;
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.twitch = Math.max(0, this.twitch - dt);
    this.senseT -= dt;
    if (this.fsm.state !== 'Chase' && this.senseT <= 0) {
      this.senseT = 0.15;
      this.sense(0.15);
    }
    this.fsm.update(dt);
    const st = this.fsm.state;
    // movement
    let speed = SPEED[st] * this.speedScale;
    const target = this.path[0];
    let mx = 0, mz = 0;
    if (target && speed > 0 && st !== 'Attack') {
      this.faceTo(target, dt, st === 'Chase' ? 7 : 3.5);
      const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
      const L = Math.hypot(dx, dz) || 1;
      // head towards the waypoint but only along where we face (no moon-walking)
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      const align = Math.max(0.2, (fx * dx + fz * dz) / L);
      speed *= align;
      mx = fx * speed * dt;
      mz = fz * speed * dt;
      this.openDoorsAhead();
    } else if (st === 'Idle' || st === 'Search') {
      this.yaw += Math.sin(t * 0.7) * dt * 0.6;
    }
    this.vy = Math.max(-20, this.vy - 9.8 * dt);
    if (this.kcc && this.collider) {
      const n = Math.min(5, Math.max(1, Math.ceil(Math.hypot(mx, mz) / 0.15)));
      let ax = 0, az = 0;
      for (let i = 0; i < n; i++) {
        this.kcc.computeColliderMovement(this.collider, { x: mx / n, y: (this.vy * dt) / n, z: mz / n }, this.env.ph.R.QueryFilterFlags.EXCLUDE_SENSORS, groups(G.CREATURE, G.STATIC | G.DOOR | G.PROP));
        const m = this.kcc.computedMovement();
        const c = this.collider.translation();
        this.collider.setTranslation({ x: c.x + m.x, y: c.y + m.y, z: c.z + m.z });
        ax += m.x;
        az += m.z;
      }
      if (this.kcc.computedGrounded()) this.vy = 0;
      const c = this.collider.translation();
      this.pos.set(c.x, c.y - 1.07, c.z);
      const mv = { x: ax, z: az };
      const moved = Math.hypot(mv.x, mv.z);
      this.phase += moved * 2.4;
      // stuck detection: sidestep / skip waypoint
      this.stuckT += dt;
      if (this.stuckT > 1.5) {
        if (target && this.pos.distanceTo(this.stuckRef) < 0.4 * speed) {
          this.yaw += (Math.random() < 0.5 ? -1 : 1) * 1.2;
          if (this.path.length > 1) this.path.shift();
        }
        this.stuckRef.copy(this.pos);
        this.stuckT = 0;
      }
    }
    this.gait = st === 'Attack' ? 'attack' : st === 'Chase' || st === 'Flee' ? 'run' : speed > 0.05 ? 'walk' : 'stand';
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    animateRig(this.rig, this.phase, this.gait, t, this.twitch);
    // sounds
    this.soundT -= dt;
    if (this.soundT <= 0) {
      const chasing = st === 'Chase';
      this.soundT = chasing ? 0.34 : 0.7 + Math.random() * 0.4;
      if (this.gait === 'walk' || this.gait === 'run') this.env.sound('step', this.pos);
      if (Math.random() < (chasing ? 0.25 : 0.08)) this.env.sound(Math.random() < 0.5 ? 'breath' : 'click', this.pos);
    }
  }

  private openDoorsAhead() {
    for (const d of this.env.doors) {
      if (d.open || d.locked || d.opts.small) continue;
      const c = d.center();
      if (Math.hypot(c.x - this.pos.x, c.z - this.pos.z) < 1.6) d.setOpen(true);
    }
  }

  serialize() {
    return { mode: this.mode, x: this.pos.x, y: this.pos.y, z: this.pos.z, state: this.fsm.state };
  }
}
