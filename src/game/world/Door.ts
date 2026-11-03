import * as THREE from 'three';
import { boxGeo, type AABB, type WorldBuilder } from './builder';
import { damp } from '@/utils/math';

export interface DoorOpts {
  id: string;
  /** Hinge position (x,z) on the floor. */
  hinge: [number, number];
  width: number;
  height?: number;
  thickness?: number;
  /** Direction from hinge to latch when closed (radians around Y, 0 = +X). */
  closedYaw: number;
  /** Opening swing in radians (sign = direction). */
  swing: number;
  mat: THREE.Material | THREE.Material[];
  frameMat?: THREE.Material;
  handleMat?: THREE.Material;
  sound?: 'interior' | 'front' | 'cabinet';
}

/**
 * Hinged door with animated swing and a collider that exists only while closed.
 */
export class Door {
  readonly pivot = new THREE.Group();
  readonly leaf: THREE.Mesh;
  open = false;
  angle = 0;
  /** Override target (e.g. ajar). */
  targetAngle = 0;
  collider: AABB;
  onChange?: (open: boolean) => void;

  constructor(b: WorldBuilder, readonly o: DoorOpts, parent: THREE.Object3D = b.root) {
    const h = o.height ?? 2.05, t = o.thickness ?? 0.05;
    this.pivot.position.set(o.hinge[0], 0, o.hinge[1]);
    this.pivot.rotation.y = -o.closedYaw;
    parent.add(this.pivot);
    this.leaf = new THREE.Mesh(boxGeo(o.width, h, t), o.mat);
    this.leaf.position.set(o.width / 2, h / 2, 0);
    this.pivot.add(this.leaf);
    if (o.handleMat) {
      for (const s of [1, -1]) {
        const hnd = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.03), o.handleMat);
        hnd.position.set(o.width - 0.12, 1.0, s * (t / 2 + 0.03));
        this.pivot.add(hnd);
        const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 10), o.handleMat);
        rose.rotation.x = Math.PI / 2;
        rose.position.set(o.width - 0.07, 1.0, s * (t / 2 + 0.008));
        this.pivot.add(rose);
      }
    }
    // collider of the closed leaf
    const cx = o.hinge[0] + Math.cos(o.closedYaw) * o.width / 2;
    const cz = o.hinge[1] + Math.sin(o.closedYaw) * o.width / 2;
    const alongX = Math.abs(Math.cos(o.closedYaw)) > 0.7;
    this.collider = b.collideBox(cx, cz, alongX ? o.width : 0.1, alongX ? 0.1 : o.width, 0, 'door:' + o.id);
    b.occluders.push(this.leaf);
  }

  setOpen(v: boolean, instant = false) {
    this.open = v;
    this.targetAngle = v ? this.o.swing : 0;
    if (instant) this.angle = this.targetAngle;
    this.collider.enabled = !v && Math.abs(this.targetAngle) < 0.05;
    this.onChange?.(v);
  }

  /** Partially open (e.g. ajar door) without counting as fully open. */
  setAjar(rad: number) {
    this.targetAngle = rad;
    this.open = rad !== 0;
    this.collider.enabled = rad === 0;
    this.onChange?.(this.open);
  }

  update(dt: number) {
    this.angle = damp(this.angle, this.targetAngle, 5.5, dt);
    this.pivot.rotation.y = -this.o.closedYaw - this.angle;
    if (this.targetAngle === 0 && Math.abs(this.angle) < 0.03) this.collider.enabled = true;
  }
}
