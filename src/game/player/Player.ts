import * as THREE from 'three';
import type { Input } from '@/game/core/Input';
import type { AABB, Room } from '@/game/world/builder';
import { resolveCircle } from './collision';
import { clamp, damp } from '@/utils/math';

export const EYE = 1.62;
const SPEED = 1.55; // deliberate, slow pace
const RADIUS = 0.24;
const STRIDE = 0.68;

/**
 * First-person controller: smoothed velocity, collisions, head bob,
 * footstep events, scripted look-at/move-to for small cutscenes.
 */
export class Player {
  x = 3.8;
  z = 2.0;
  yaw = 0;
  pitch = 0;
  private vx = 0;
  private vz = 0;
  private bob = 0;
  private strideAcc = 0;
  room: Room | null = null;
  onStep?: (room: Room | null) => void;
  /** Scripted camera control (window look, cutscenes). */
  private script: { yaw: number; pitch: number; x?: number; z?: number; k: number } | null = null;
  /** Small additional camera shake amplitude. */
  shake = 0;

  constructor(private cam: THREE.PerspectiveCamera, private input: Input, private colliders: () => readonly AABB[], private rooms: readonly Room[]) {}

  place(x: number, z: number, yaw: number, pitch = 0) {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.pitch = pitch;
    this.vx = this.vz = 0;
    this.room = this.findRoom(x, z);
  }

  /** Smoothly turn to look at a point. Pass null to release. */
  lookAt(target: THREE.Vector3 | null, k = 3, moveTo?: { x: number; z: number }) {
    if (!target) {
      this.script = null;
      return;
    }
    const px = moveTo?.x ?? this.x, pz = moveTo?.z ?? this.z;
    const dx = target.x - px, dz = target.z - pz, dy = target.y - EYE;
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.atan2(dy, Math.hypot(dx, dz));
    // unwrap yaw to the nearest equivalent
    let y = yaw;
    while (y - this.yaw > Math.PI) y -= Math.PI * 2;
    while (y - this.yaw < -Math.PI) y += Math.PI * 2;
    this.script = { yaw: y, pitch, x: moveTo?.x, z: moveTo?.z, k };
  }

  findRoom(x: number, z: number) {
    for (const r of this.rooms) if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return r;
    return this.room;
  }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  update(dt: number, t: number) {
    if (this.script) {
      const s = this.script;
      this.yaw = damp(this.yaw, s.yaw, s.k, dt);
      this.pitch = damp(this.pitch, s.pitch, s.k, dt);
      if (s.x !== undefined && s.z !== undefined) {
        this.x = damp(this.x, s.x, s.k * 0.8, dt);
        this.z = damp(this.z, s.z, s.k * 0.8, dt);
      }
      this.vx = this.vz = 0;
    } else {
      const look = this.input.consumeLook();
      this.yaw -= look.x;
      this.pitch = clamp(this.pitch - look.y, -1.25, 1.2);
      this.input.update();
      const mx = this.input.move.x, my = this.input.move.y;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      // forward = (-sin, -cos), right = (cos, -sin)
      const tx = (-sin * my + cos * mx) * SPEED;
      const tz = (-cos * my - sin * mx) * SPEED;
      this.vx = damp(this.vx, tx, 9, dt);
      this.vz = damp(this.vz, tz, 9, dt);
      const nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
      const [rx, rz] = resolveCircle(nx, nz, RADIUS, this.colliders());
      const moved = Math.hypot(rx - this.x, rz - this.z);
      this.x = rx;
      this.z = rz;
      this.room = this.findRoom(this.x, this.z);
      const sp = moved / Math.max(dt, 1e-4);
      if (sp > 0.2) {
        this.bob += moved * (Math.PI * 2) / (STRIDE * 2);
        this.strideAcc += moved;
        if (this.strideAcc > STRIDE) {
          this.strideAcc -= STRIDE;
          this.onStep?.(this.room);
        }
      } else this.strideAcc = Math.min(this.strideAcc, STRIDE * 0.6);
    }
    const speed01 = clamp(Math.hypot(this.vx, this.vz) / SPEED, 0, 1);
    const bobY = Math.sin(this.bob * 2) * 0.022 * speed01;
    const bobX = Math.cos(this.bob) * 0.012 * speed01;
    // breathing sway when standing still
    const breathe = Math.sin(t * 1.3) * 0.004;
    const sh = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    this.cam.position.set(this.x + Math.cos(this.yaw) * bobX, EYE + bobY + breathe + sh, this.z - Math.sin(this.yaw) * bobX);
    this.cam.rotation.set(this.pitch + sh * 0.5, this.yaw, 0, 'YXZ');
  }
}
