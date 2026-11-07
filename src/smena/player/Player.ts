import * as THREE from 'three';
import type * as RAPIER_NS from '@dimforge/rapier3d-compat';
import { G, groups, type Physics } from '@/smena/core/Physics';
import type { Input } from '@/smena/core/Input';
import { useSettings } from '@/smena/state/settings';
import { groundSurface } from '@/smena/world/layout';
import { clamp, damp } from '@/utils/math';

export type Surface = 'asphalt' | 'gravel' | 'mud' | 'grass' | 'forest' | 'wood' | 'concrete' | 'metal' | 'tile' | 'linoleum';

const R_CAPSULE = 0.3;
const HH_STAND = 0.55;
const HH_CROUCH = 0.22;
const EYE_STAND = 1.62;
const EYE_CROUCH = 0.98;

export interface PlayerEvents {
  footstep?: (s: Surface, volume: number, running: boolean) => void;
  noise?: (pos: THREE.Vector3, radius: number) => void;
  land?: (speed: number) => void;
  hurt?: (amount: number) => void;
}

/**
 * First-person controller on a Rapier kinematic character controller:
 * acceleration-based movement (a person, not a hovercraft), sprint with stamina,
 * crouch with capsule resize and ceiling check, moderate head bob, landing dip,
 * footsteps by surface and a noise level the creature can hear.
 */
export class Player {
  readonly pos = new THREE.Vector3(); // feet
  yaw = 0;
  pitch = 0;
  private vel = new THREE.Vector3();
  private vy = 0;
  grounded = true;
  crouching = false;
  running = false;
  stamina = 100;
  private staminaLock = false;
  health = 100;
  dead = false;
  private eye = EYE_STAND;
  private bobPhase = 0;
  private bobAmt = 0;
  private stepAcc = 0;
  private landDip = 0;
  private shake = 0;
  private roll = 0;
  noise = 0; // 0..1 for HUD
  speed = 0;
  surface: Surface = 'gravel';
  private kcc: RAPIER_NS.KinematicCharacterController | null = null;
  collider: RAPIER_NS.Collider | null = null;
  private ph: Physics | null = null;
  /** Scripted camera control (story moments). */
  private lookTarget: THREE.Vector3 | null = null;
  private lookSpeed = 3;
  frozen = false;
  /** Multiplier from story/anomalies (e.g. heavy legs). */
  speedMul = 1;
  ev: PlayerEvents = {};
  private tmp = new THREE.Vector3();
  inside = false;

  constructor(readonly camera: THREE.PerspectiveCamera, readonly input: Input) {}

  attach(ph: Physics) {
    const R = ph.R;
    this.ph = ph;
    const desc = R.ColliderDesc.capsule(HH_STAND, R_CAPSULE)
      .setTranslation(this.pos.x, this.pos.y + HH_STAND + R_CAPSULE, this.pos.z)
      .setCollisionGroups(groups(G.PLAYER, G.STATIC | G.PROP | G.DOOR | G.CREATURE));
    this.collider = ph.world.createCollider(desc);
    const k = ph.world.createCharacterController(0.04);
    k.setUp({ x: 0, y: 1, z: 0 });
    k.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    k.setMinSlopeSlideAngle((60 * Math.PI) / 180);
    k.enableAutostep(0.32, 0.18, false);
    k.enableSnapToGround(0.35);
    k.setSlideEnabled(true);
    k.setApplyImpulsesToDynamicBodies(true);
    k.setCharacterMass(75);
    this.kcc = k;
  }

  teleport(x: number, y: number, z: number, yaw?: number) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.vy = 0;
    if (yaw !== undefined) this.yaw = yaw;
    this.pitch = 0;
    this.collider?.setTranslation({ x, y: y + this.hh() + R_CAPSULE, z });
    this.syncCamera(0);
  }

  private hh() {
    return this.crouching ? HH_CROUCH : HH_STAND;
  }

  toggleCrouch() {
    if (this.crouching) {
      // ceiling check before standing up
      if (this.ph) {
        const o = this.tmp.set(this.pos.x, this.pos.y + EYE_CROUCH, this.pos.z);
        if (this.ph.raycast(o, new THREE.Vector3(0, 1, 0), EYE_STAND - EYE_CROUCH + 0.15, groups(0xffff, G.STATIC | G.DOOR))) return false;
      }
      this.crouching = false;
    } else this.crouching = true;
    if (this.collider) {
      this.collider.setHalfHeight(this.hh());
      this.collider.setTranslation({ x: this.pos.x, y: this.pos.y + this.hh() + R_CAPSULE, z: this.pos.z });
    }
    return true;
  }

  lookAt(p: THREE.Vector3 | null, speed = 3) {
    this.lookTarget = p ? p.clone() : null;
    this.lookSpeed = speed;
  }

  damage(n: number) {
    if (this.dead) return;
    this.health = Math.max(0, this.health - n);
    this.shake = Math.min(1, this.shake + n / 40);
    this.ev.hurt?.(n);
    if (this.health <= 0) this.dead = true;
  }
  heal(n: number) {
    this.health = Math.min(100, this.health + n);
  }

  /** Camera forward on the ground plane. */
  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
  eyePos(out = new THREE.Vector3()) {
    return out.copy(this.camera.position);
  }

  update(dt: number) {
    if (dt <= 0) return;
    const s = useSettings.getState();
    const inp = this.input;
    // --- look
    const l = inp.consumeLook();
    if (this.lookTarget) {
      const d = this.tmp.copy(this.lookTarget).sub(this.camera.position);
      const ty = Math.atan2(-d.x, -d.z);
      const tp = Math.atan2(d.y, Math.hypot(d.x, d.z));
      let dy = ty - this.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw += dy * Math.min(1, dt * this.lookSpeed);
      this.pitch += (tp - this.pitch) * Math.min(1, dt * this.lookSpeed);
    } else if (!this.frozen) {
      this.yaw -= l.x;
      this.pitch = clamp(this.pitch - l.y, -1.35, 1.35);
    }
    // --- movement intent
    const canMove = !this.frozen && !this.dead;
    const mx = canMove ? inp.move.x : 0, my = canMove ? inp.move.y : 0;
    const wantRun = canMove && inp.sprint && !this.crouching && !this.staminaLock;
    this.running = wantRun && Math.hypot(mx, my) > 0.3;
    const base = this.crouching ? 1.35 : this.running ? 4.7 : 2.5;
    const speed = base * this.speedMul * (this.health < 30 ? 0.85 : 1);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const tx = (fx * my + rx * mx) * speed, tz = (fz * my + rz * mx) * speed;
    const accel = this.grounded ? (Math.hypot(tx, tz) > 0.1 ? 9 : 11) : 1.5;
    this.vel.x = damp(this.vel.x, tx, accel, dt);
    this.vel.z = damp(this.vel.z, tz, accel, dt);
    // stamina
    if (this.running) this.stamina = Math.max(0, this.stamina - dt * 14);
    else this.stamina = Math.min(100, this.stamina + dt * (this.speed < 0.5 ? 20 : 11));
    if (this.stamina <= 0) this.staminaLock = true;
    if (this.staminaLock && this.stamina > 35) this.staminaLock = false;
    // gravity
    this.vy = this.grounded ? -1.5 : Math.max(-30, this.vy - 9.81 * dt);
    const desired = { x: this.vel.x * dt, y: this.vy * dt, z: this.vel.z * dt };
    const wasGrounded = this.grounded;
    const fallSpeed = -this.vy;
    if (this.kcc && this.collider) {
      // sub-step long moves (low FPS / big dt) so autostep and slope handling stay reliable
      const len = Math.hypot(desired.x, desired.z);
      const n = Math.min(6, Math.max(1, Math.ceil(len / 0.12)));
      let mx = 0, mz = 0, grounded = false;
      const flt = groups(G.PLAYER, G.STATIC | G.PROP | G.DOOR | G.CREATURE);
      for (let i = 0; i < n; i++) {
        this.kcc.computeColliderMovement(this.collider, { x: desired.x / n, y: desired.y / n, z: desired.z / n }, this.ph!.R.QueryFilterFlags.EXCLUDE_SENSORS, flt);
        const mv = this.kcc.computedMovement();
        const t = this.collider.translation();
        this.collider.setTranslation({ x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z });
        mx += mv.x;
        mz += mv.z;
        grounded = this.kcc.computedGrounded();
      }
      const t = this.collider.translation();
      this.pos.set(t.x, t.y - this.hh() - R_CAPSULE, t.z);
      this.grounded = grounded;
      // real horizontal speed (walls stop you)
      this.speed = Math.hypot(mx, mz) / dt;
      if (Math.abs(mx) < Math.abs(desired.x) * 0.3) this.vel.x *= 0.5;
      if (Math.abs(mz) < Math.abs(desired.z) * 0.3) this.vel.z *= 0.5;
    } else {
      this.pos.x += desired.x;
      this.pos.z += desired.z;
      this.grounded = true;
      this.speed = Math.hypot(this.vel.x, this.vel.z);
    }
    if (!wasGrounded && this.grounded) {
      this.landDip = Math.min(0.12, fallSpeed * 0.012);
      this.ev.land?.(fallSpeed);
      if (fallSpeed > 10) this.damage((fallSpeed - 10) * 9);
    }
    // footsteps + noise
    const moving = this.grounded && this.speed > 0.4;
    if (moving) {
      this.stepAcc += this.speed * dt;
      const stride = this.running ? 1.05 : this.crouching ? 0.6 : 0.78;
      if (this.stepAcc > stride) {
        this.stepAcc = 0;
        this.surface = this.probeSurface();
        const vol = this.running ? 1 : this.crouching ? 0.25 : 0.6;
        this.ev.footstep?.(this.surface, vol, this.running);
        const loud = this.surface === 'metal' || this.surface === 'wood' || this.surface === 'gravel' ? 1.3 : 1;
        const r = (this.running ? 16 : this.crouching ? 2.2 : 6.5) * loud;
        this.ev.noise?.(this.pos, r);
        this.noise = Math.min(1, r / 18);
      }
    }
    this.noise = Math.max(0, this.noise - dt * 0.6);
    // --- camera
    const eyeT = this.crouching ? EYE_CROUCH : EYE_STAND;
    this.eye = damp(this.eye, eyeT, 10, dt);
    const bobTarget = moving ? Math.min(1, this.speed / 4.7) : 0;
    this.bobAmt = damp(this.bobAmt, bobTarget, 6, dt);
    this.bobPhase += dt * (moving ? (this.running ? 11 : this.crouching ? 6 : 8.2) : 0);
    this.landDip = damp(this.landDip, 0, 7, dt);
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const strafe = canMove ? inp.move.x : 0;
    this.roll = damp(this.roll, -strafe * 0.012 * s.headBob, 6, dt);
    this.syncCamera(s.headBob);
  }

  private syncCamera(bobScale: number) {
    const b = this.bobAmt * bobScale;
    const by = Math.abs(Math.sin(this.bobPhase)) * 0.045 * b - 0.02 * b;
    const bx = Math.cos(this.bobPhase) * 0.025 * b;
    const sh = this.shake * this.shake;
    const t = performance.now() / 1000;
    this.camera.position.set(this.pos.x, this.pos.y + this.eye + by - this.landDip, this.pos.z);
    this.camera.position.x += Math.cos(this.yaw) * bx;
    this.camera.position.z -= Math.sin(this.yaw) * bx;
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw + Math.sin(t * 37) * sh * 0.03;
    this.camera.rotation.x = this.pitch + Math.sin(this.bobPhase * 2) * 0.004 * b + Math.sin(t * 41) * sh * 0.03;
    this.camera.rotation.z = this.roll;
    this.camera.updateMatrixWorld();
  }

  private probeSurface(): Surface {
    if (this.ph) {
      const o = this.tmp.set(this.pos.x, this.pos.y + 0.3, this.pos.z);
      const hit = this.ph.raycast(o, new THREE.Vector3(0, -1, 0), 0.8, groups(0xffff, G.STATIC | G.PROP));
      if (hit) {
        const s = this.ph.surfaces.get(hit.collider.handle);
        if (s && s !== 'terrain') return s as Surface;
      }
    }
    return groundSurface(this.pos.x, this.pos.z);
  }

  serialize() {
    return { x: this.pos.x, y: this.pos.y, z: this.pos.z, yaw: this.yaw, health: this.health, stamina: this.stamina, crouch: this.crouching };
  }
}
