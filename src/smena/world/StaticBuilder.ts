import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MatLib, MatName } from './materials';
import type { StaticShape } from '@/smena/core/Physics';

/** Box with UVs in metres / tile so textures keep their real-world scale on any size. */
export function boxGeo(w: number, h: number, d: number, tile = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 verts each)
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile);
    }
  return g;
}

export interface Opening { at: number; w: number; h: number; sill?: number }
export interface BoxOpts { ry?: number; collide?: boolean; surface?: string; tile?: number }

/**
 * Collects static geometry per (chunk, material), merges it into a handful of
 * meshes, and records collider shapes for the physics world. Merging per chunk
 * keeps frustum culling effective while cutting draw calls by ~10×.
 */
export class StaticBuilder {
  private parts = new Map<string, { mat: MatName; geos: THREE.BufferGeometry[] }>();
  readonly colliders: StaticShape[] = [];
  chunk = 'default';
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(readonly mats: MatLib) {}

  add(mat: MatName, geo: THREE.BufferGeometry) {
    const key = this.chunk + '|' + mat;
    let p = this.parts.get(key);
    if (!p) this.parts.set(key, (p = { mat, geos: [] }));
    // normalise attributes so everything merges
    if (geo.index) geo = geo.toNonIndexed();
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((geo.attributes.position.count) * 2), 2));
    p.geos.push(geo);
  }

  /** Axis box centred at (x,y,z) with optional Y rotation. */
  box(mat: MatName, x: number, y: number, z: number, w: number, h: number, d: number, o: BoxOpts = {}) {
    const tile = o.tile ?? (this.mats[mat].userData.tile as number) ?? 1;
    const g = boxGeo(w, h, d, tile);
    this.q.setFromAxisAngle(this.up, o.ry ?? 0);
    this.m4.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(this.m4);
    this.add(mat, g);
    if (o.collide !== false) this.colliders.push({ kind: 'box', x, y, z, hx: w / 2, hy: h / 2, hz: d / 2, ry: o.ry, surface: o.surface });
  }

  /** Any geometry placed with a transform. */
  geo(mat: MatName, g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0, s = 1) {
    const e = new THREE.Euler(rx, ry, rz, 'YXZ');
    this.m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(s, s, s));
    this.add(mat, g.clone().applyMatrix4(this.m4));
  }

  cylinderCollider(x: number, y: number, z: number, r: number, hh: number) {
    this.colliders.push({ kind: 'cyl', x, y, z, r, hh });
  }
  boxCollider(x: number, y: number, z: number, hx: number, hy: number, hz: number, ry = 0, surface?: string) {
    this.colliders.push({ kind: 'box', x, y, z, hx, hy, hz, ry, surface });
  }

  /**
   * Straight wall from (x1,z1) to (x2,z2) with door/window openings.
   * `at` is distance of the opening centre from (x1,z1). Optional inner material on the other face.
   */
  wall(mat: MatName, x1: number, z1: number, x2: number, z2: number, y0: number, h: number, t: number, openings: Opening[] = [], surface = 'concrete') {
    const dx = x2 - x1, dz = z2 - z1;
    const L = Math.hypot(dx, dz);
    const ry = -Math.atan2(dz, dx);
    const ux = dx / L, uz = dz / L;
    const seg = (a: number, b: number, yA: number, yB: number) => {
      if (b - a < 0.01 || yB - yA < 0.01) return;
      const c = (a + b) / 2;
      this.box(mat, x1 + ux * c, y0 + (yA + yB) / 2, z1 + uz * c, b - a, yB - yA, t, { ry, surface });
    };
    const ops = [...openings].sort((a, b) => a.at - b.at);
    let cur = 0;
    for (const o of ops) {
      const a = o.at - o.w / 2, b = o.at + o.w / 2;
      seg(cur, a, 0, h);
      const sill = o.sill ?? 0;
      seg(a, b, 0, sill);
      seg(a, b, sill + o.h, h);
      cur = b;
    }
    seg(cur, L, 0, h);
  }

  /** Merge everything into meshes and add to `root`. */
  build(root: THREE.Object3D, shadows = false) {
    const out: THREE.Mesh[] = [];
    for (const [key, p] of this.parts) {
      const merged = mergeGeometries(p.geos, false);
      p.geos.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, this.mats[p.mat]);
      mesh.name = key;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.receiveShadow = shadows;
      mesh.castShadow = shadows;
      root.add(mesh);
      out.push(mesh);
    }
    this.parts.clear();
    return out;
  }
}
