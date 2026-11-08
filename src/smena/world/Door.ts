import * as THREE from 'three';
import { boxGeo } from './StaticBuilder';
import type { MatLib, MatName } from './materials';
import { G, groups, type Physics, type RBody } from '@/smena/core/Physics';

export interface DoorOpts {
  id: string;
  /** Hinge position (floor level). */
  x: number;
  y: number;
  z: number;
  /** Yaw of the closed door; the leaf extends along local +X from the hinge. */
  ry: number;
  w?: number;
  h?: number;
  t?: number;
  mat?: MatName;
  /** +1 opens counter-clockwise (seen from above), −1 clockwise. */
  dir?: 1 | -1;
  openAngle?: number;
  locked?: boolean;
  keyId?: string;
  label?: string;
  heavy?: boolean;
  /** Small cabinet/wardrobe door (no physics body, animated). */
  small?: boolean;
}

/**
 * Physical door: a kinematic Rapier body hinged at its edge. It swings with an
 * ease-out towards the open/closed angle and physically pushes whatever is in the
 * way (props, the player, the creature); locked doors stay shut.
 */
export class Door {
  readonly pivot = new THREE.Group();
  readonly leaf: THREE.Mesh;
  open = false;
  locked: boolean;
  readonly opts: Required<Omit<DoorOpts, 'keyId' | 'label'>> & Pick<DoorOpts, 'keyId' | 'label'>;
  body: RBody | null = null;
  private tq = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private angle = 0;
  /** Seconds since last toggle (used to play the latch sound when it settles). */
  onSound?: (kind: 'open' | 'close' | 'locked' | 'unlock', d: Door) => void;

  constructor(M: MatLib, o: DoorOpts) {
    this.opts = { w: 0.9, h: 2.05, t: 0.05, mat: 'planksDark', dir: 1, openAngle: 1.75, locked: false, heavy: false, small: false, ...o };
    const { w, h, t } = this.opts;
    this.locked = this.opts.locked;
    const tile = (M[this.opts.mat].userData.tile as number) ?? 1;
    const g = boxGeo(w, h, t, tile);
    g.translate(w / 2, h / 2, 0);
    this.leaf = new THREE.Mesh(g, M[this.opts.mat]);
    this.leaf.castShadow = true;
    this.leaf.receiveShadow = true;
    // handle
    if (!this.opts.small) {
      const hd = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.05), M.metalGrey);
      hd.position.set(w - 0.1, 1.0, 0.05);
      const hd2 = hd.clone();
      hd2.position.z = -0.05;
      this.leaf.add(hd, hd2);
    } else {
      const k = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.03), M.metalGrey);
      k.position.set(w - 0.05, h / 2, t);
      this.leaf.add(k);
    }
    this.pivot.add(this.leaf);
    this.pivot.position.set(o.x, o.y, o.z);
    this.pivot.rotation.y = o.ry;
    this.leaf.userData.door = this;
  }

  get id() {
    return this.opts.id;
  }

  attach(ph: Physics) {
    if (this.opts.small) return;
    const R = ph.R;
    const { x, y, z, w, h, t } = this.opts;
    this.angle = this.target();
    const q = this.tq.setFromAxisAngle(this.up, this.opts.ry + this.angle);
    // Kinematic body with its origin on the hinge: it swings deterministically and
    // physically pushes the player, props and the creature out of its way.
    const body = ph.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
    const cd = R.ColliderDesc.cuboid(w / 2 - 0.02, h / 2 - 0.02, t / 2 + 0.01).setTranslation(w / 2, h / 2 + 0.01, 0).setCollisionGroups(groups(G.DOOR, G.PLAYER | G.PROP | G.CREATURE));
    const col = ph.world.createCollider(cd, body);
    ph.owners.set(col.handle, this);
    this.body = body;
  }

  private target() {
    return this.open ? this.opts.openAngle * this.opts.dir : 0;
  }

  /** Returns false when locked. */
  toggle(hasKey: (id: string) => boolean): 'open' | 'close' | 'locked' | 'unlock' {
    if (this.locked) {
      if (this.opts.keyId && hasKey(this.opts.keyId)) {
        this.locked = false;
        this.onSound?.('unlock', this);
        return 'unlock';
      }
      this.onSound?.('locked', this);
      return 'locked';
    }
    this.setOpen(!this.open);
    return this.open ? 'open' : 'close';
  }


  setOpen(open: boolean, instant = false) {
    this.open = open;
    if (!instant) this.onSound?.(open ? 'open' : 'close', this);
    if (instant) this.angle = this.target();
  }

  setLocked(v: boolean) {
    this.locked = v;
  }

  update(dt: number) {
    const tgt = this.target();
    const speed = this.opts.heavy ? 1.5 : this.opts.small ? 3 : 2.3;
    const d = tgt - this.angle;
    // ease-out swing
    const stepA = Math.sign(d) * Math.min(Math.abs(d), dt * speed * (0.35 + Math.min(1, Math.abs(d))));
    this.angle += stepA;
    this.pivot.rotation.y = this.opts.ry + this.angle;
    if (this.body && Math.abs(stepA) > 1e-5) {
      const q = this.tq.setFromAxisAngle(this.up, this.opts.ry + this.angle);
      this.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    } else if (this.body && dt === 0) {
      const q = this.tq.setFromAxisAngle(this.up, this.opts.ry + this.angle);
      this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, false);
    }
  }

  /** World-space centre of the leaf (for prompts and sound). */
  center(out = new THREE.Vector3()) {
    return this.leaf.localToWorld(out.set(this.opts.w / 2, 1.1, 0));
  }
}
