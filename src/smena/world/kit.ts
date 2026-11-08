import * as THREE from 'three';
import { boxGeo, type StaticBuilder } from './StaticBuilder';
import type { MatLib, MatName } from './materials';

/**
 * Tiny modelling kit: build objects in local space from primitives with named
 * materials. A kit object can stay a live Group (animated/dynamic things) or be
 * baked into the StaticBuilder (merged geometry + one rotated box collider).
 */
export class Kit {
  readonly g = new THREE.Group();
  constructor(readonly M: MatLib) {}

  private put(geo: THREE.BufferGeometry, mat: MatName, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, this.M[mat]);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.userData.mat = mat;
    this.g.add(m);
    return m;
  }
  box(mat: MatName, w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    const tile = (this.M[mat].userData.tile as number) ?? 1;
    return this.put(boxGeo(w, h, d, tile), mat, x, y, z, rx, ry, rz);
  }
  cyl(mat: MatName, r0: number, r1: number, h: number, x: number, y: number, z: number, seg = 10, rx = 0, ry = 0, rz = 0) {
    return this.put(new THREE.CylinderGeometry(r1, r0, h, seg), mat, x, y, z, rx, ry, rz);
  }
  sphere(mat: MatName, r: number, x: number, y: number, z: number, seg = 10) {
    return this.put(new THREE.SphereGeometry(r, seg, Math.max(4, seg - 3)), mat, x, y, z);
  }
  geo(mat: MatName, geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    return this.put(geo, mat, x, y, z, rx, ry, rz);
  }
  place(x: number, y: number, z: number, ry = 0) {
    this.g.position.set(x, y, z);
    this.g.rotation.y = ry;
    this.g.updateMatrixWorld(true);
    return this;
  }
}

export interface BakeOpts { collide?: boolean; surface?: string; shrink?: number }

/** Merge a kit's meshes into the static builder at its current transform. */
export function bake(b: StaticBuilder, k: Kit, o: BakeOpts = {}) {
  k.g.updateMatrixWorld(true);
  const box = new THREE.Box3();
  k.g.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh || !m.userData.mat) return;
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    b.add(m.userData.mat as MatName, g);
  });
  if (o.collide !== false) {
    // collider: local-space bounds, rotated by the group's yaw
    const ry = k.g.rotation.y;
    const inv = new THREE.Matrix4().makeRotationY(ry).invert();
    const pts = new THREE.Vector3();
    box.makeEmpty();
    k.g.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox!;
      for (let i = 0; i < 8; i++) {
        pts.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(m.matrixWorld);
        pts.sub(k.g.position).applyMatrix4(inv);
        box.expandByPoint(pts);
      }
    });
    const s = o.shrink ?? 0;
    const c = box.getCenter(new THREE.Vector3());
    const h = box.getSize(new THREE.Vector3()).multiplyScalar(0.5).subScalar(s);
    const wc = c.applyMatrix4(new THREE.Matrix4().makeRotationY(ry)).add(k.g.position);
    b.boxCollider(wc.x, wc.y, wc.z, Math.max(0.02, h.x), Math.max(0.02, h.y), Math.max(0.02, h.z), ry, o.surface);
  }
  k.g.traverse((obj) => (obj as THREE.Mesh).geometry?.dispose());
}
