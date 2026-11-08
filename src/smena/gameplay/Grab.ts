import * as THREE from 'three';
import { G, groups, type Physics, type Prop } from '@/smena/core/Physics';

/**
 * Pick up / carry / drop / throw physics props. The held body stays dynamic and
 * is driven by velocity towards a point in front of the camera, so it still
 * collides with walls instead of passing through them.
 */
export class Grab {
  held: Prop | null = null;
  private tmp = new THREE.Vector3();
  private dist = 1.25;
  onThrow?: (p: Prop) => void;

  constructor(private ph: Physics, private camera: THREE.Camera) {}

  canGrab(p: Prop) {
    return p.grabbable && p.mass <= 30 && !this.held;
  }

  pick(p: Prop) {
    if (!this.canGrab(p)) return false;
    this.held = p;
    p.held = true;
    p.body.setEnabled(true);
    p.body.wakeUp();
    p.body.setGravityScale(0, true);
    p.body.setAngularDamping(6);
    p.collider.setCollisionGroups(groups(G.PROP, G.STATIC | G.PROP | G.DOOR | G.CREATURE));
    const d = this.camera.position.distanceTo(p.mesh.position);
    this.dist = Math.min(1.5, Math.max(0.9, d));
    return true;
  }

  drop(throwIt = false) {
    const p = this.held;
    if (!p) return null;
    this.held = null;
    p.held = false;
    p.body.setGravityScale(1, true);
    p.body.setAngularDamping(0.4);
    p.collider.setCollisionGroups(groups(G.PROP));
    if (throwIt) {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      const v = Math.min(14, 9 / Math.sqrt(Math.max(0.3, p.mass)) + 4);
      p.body.setLinvel({ x: dir.x * v, y: dir.y * v + 1.5, z: dir.z * v }, true);
      p.body.setAngvel({ x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6, z: (Math.random() - 0.5) * 6 }, true);
      this.onThrow?.(p);
    } else {
      p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    return p;
  }

  update() {
    const p = this.held;
    if (!p) return;
    const target = this.tmp.set(0, -0.15, -this.dist).applyMatrix4(this.camera.matrixWorld);
    const t = p.body.translation();
    const dx = target.x - t.x, dy = target.y - t.y, dz = target.z - t.z;
    const d = Math.hypot(dx, dy, dz);
    // too far (stuck behind something) → let go
    if (d > 2.2) {
      this.drop();
      return;
    }
    const k = 14 / Math.max(1, p.mass * 0.15);
    p.body.setLinvel({ x: dx * k, y: dy * k, z: dz * k }, true);
    const av = p.body.angvel();
    p.body.setAngvel({ x: av.x * 0.8, y: av.y * 0.8, z: av.z * 0.8 }, true);
  }

  /** Aimed prop (raycast against physics) for the "take" prompt. */
  aimed(): Prop | null {
    const o = new THREE.Vector3().setFromMatrixPosition(this.camera.matrixWorld);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const hit = this.ph.raycast(o, dir, 2.2, groups(0xffff, G.STATIC | G.PROP | G.DOOR));
    const owner = hit?.owner as Prop | undefined;
    return owner && 'body' in owner && 'grabbable' in owner && owner.grabbable ? owner : null;
  }
}
