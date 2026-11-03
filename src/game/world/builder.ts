import * as THREE from 'three';
import type { TexEntry } from './textures';
import type { Interactable } from '@/game/interactions/types';

export interface AABB { minX: number; maxX: number; minZ: number; maxZ: number; enabled?: boolean; tag?: string }

export interface Room {
  id: string;
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  floor: 'linoleum' | 'tile' | 'laminate' | 'concrete' | 'metal';
}

/** Box geometry whose UVs are in world metres / tile, so textures never stretch. */
export function boxGeo(w: number, h: number, d: number, tile = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile);
    }
  uv.needsUpdate = true;
  return g;
}

export function planeGeo(w: number, h: number, tile = 1) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile);
  return g;
}

export type Mat = THREE.Material & { userData: { tile?: number } };

export function lambert(tex: TexEntry | null, color = 0xffffff, extra: THREE.MeshLambertMaterialParameters = {}): Mat {
  const m = new THREE.MeshLambertMaterial({ map: tex?.map ?? null, color, ...extra }) as Mat;
  m.userData.tile = tex?.tile ?? 1;
  return m;
}
export function phong(tex: TexEntry | null, color = 0xffffff, shininess = 40, extra: THREE.MeshPhongMaterialParameters = {}): Mat {
  const m = new THREE.MeshPhongMaterial({ map: tex?.map ?? null, color, shininess, specular: 0x222222, ...extra }) as Mat;
  m.userData.tile = tex?.tile ?? 1;
  return m;
}

const tileOf = (m: THREE.Material | THREE.Material[]) => (Array.isArray(m) ? (m[4] as Mat).userData.tile ?? 1 : (m as Mat).userData.tile ?? 1);

export interface BoxOpts { collide?: boolean; ry?: number; parent?: THREE.Object3D; name?: string; occluder?: boolean; shadow?: number }

/**
 * Accumulates geometry, colliders, rooms and interactables while a level is built.
 */
export class WorldBuilder {
  readonly root = new THREE.Group();
  readonly colliders: AABB[] = [];
  readonly rooms: Room[] = [];
  readonly interactables: Interactable[] = [];
  /** Meshes that block interaction rays (walls, big furniture). */
  readonly occluders: THREE.Object3D[] = [];
  blobMat: THREE.MeshBasicMaterial;

  constructor(blobTex: THREE.Texture) {
    this.blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.85 });
  }

  box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material | THREE.Material[], o: BoxOpts = {}) {
    const mesh = new THREE.Mesh(boxGeo(w, h, d, tileOf(mat)), mat);
    mesh.position.set(x, y, z);
    if (o.ry) mesh.rotation.y = o.ry;
    if (o.name) mesh.name = o.name;
    (o.parent ?? this.root).add(mesh);
    if (o.collide) this.collideBox(x, z, w, d, o.ry ?? 0);
    if (o.occluder !== false && (o.collide || o.occluder)) this.occluders.push(mesh);
    if (o.shadow) this.blob(x, z, w * o.shadow, d * o.shadow, o.ry ?? 0, o.parent);
    return mesh;
  }

  /** Axis-aligned collider (rotation 0 or ±90° supported). */
  collideBox(x: number, z: number, w: number, d: number, ry = 0, tag?: string) {
    const swap = Math.abs(Math.sin(ry)) > 0.7;
    const hw = (swap ? d : w) / 2, hd = (swap ? w : d) / 2;
    const c: AABB = { minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, enabled: true, tag };
    this.colliders.push(c);
    return c;
  }

  /** Soft contact shadow — a cheap substitute for real shadow maps on mobile. */
  blob(x: number, z: number, w: number, d: number, ry = 0, parent?: THREE.Object3D, y = 0.004) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.35, d * 1.35), this.blobMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = ry;
    m.position.set(x, y, z);
    m.renderOrder = 1;
    (parent ?? this.root).add(m);
    return m;
  }

  /**
   * Axis-aligned wall from (x1,z1) to (x2,z2) with openings measured along the wall.
   * matPos faces +normal (+z for X-walls, +x for Z-walls), matNeg faces the other side.
   */
  wall(x1: number, z1: number, x2: number, z2: number, matPos: THREE.Material, matNeg: THREE.Material, edge: THREE.Material, openings: { a: number; b: number; bottom: number; top: number }[] = [], h = 2.6, t = 0.12) {
    const alongX = Math.abs(z2 - z1) < 1e-6;
    const start = alongX ? Math.min(x1, x2) : Math.min(z1, z2);
    const end = alongX ? Math.max(x1, x2) : Math.max(z1, z2);
    const fixed = alongX ? z1 : x1;
    const ops = [...openings].sort((p, q) => p.a - q.a);
    const pieces: { a: number; b: number; y0: number; y1: number }[] = [];
    let cur = start;
    for (const o of ops) {
      if (o.a > cur) pieces.push({ a: cur, b: o.a, y0: 0, y1: h });
      if (o.bottom > 0) pieces.push({ a: o.a, b: o.b, y0: 0, y1: o.bottom });
      if (o.top < h) pieces.push({ a: o.a, b: o.b, y0: o.top, y1: h });
      cur = o.b;
    }
    if (cur < end) pieces.push({ a: cur, b: end, y0: 0, y1: h });
    // materials: [+x,-x,+y,-y,+z,-z]
    const mats = alongX ? [edge, edge, edge, edge, matPos, matNeg] : [matPos, matNeg, edge, edge, edge, edge];
    for (const p of pieces) {
      const len = p.b - p.a, hh = p.y1 - p.y0, mid = (p.a + p.b) / 2, y = (p.y0 + p.y1) / 2;
      const geo = alongX ? wallGeo(len, hh, t, p.a, p.y0, false, mats) : wallGeo(t, hh, len, p.a, p.y0, true, mats);
      const mesh = new THREE.Mesh(geo, mats);
      if (alongX) mesh.position.set(mid, y, fixed);
      else mesh.position.set(fixed, y, mid);
      this.root.add(mesh);
      this.occluders.push(mesh);
      if (p.y0 < 0.5) {
        if (alongX) this.collideBox(mid, fixed, len, t + 0.02);
        else this.collideBox(fixed, mid, t + 0.02, len);
      }
    }
  }

  floorCeil(minX: number, maxX: number, minZ: number, maxZ: number, floor: THREE.Material, ceil: THREE.Material | null, h = 2.6) {
    const w = maxX - minX, d = maxZ - minZ;
    const f = new THREE.Mesh(planeGeo(w, d, (floor as Mat).userData.tile ?? 1), floor);
    f.rotation.x = -Math.PI / 2;
    f.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    this.root.add(f);
    if (ceil) {
      const c = new THREE.Mesh(planeGeo(w, d, (ceil as Mat).userData.tile ?? 1), ceil);
      c.rotation.x = Math.PI / 2;
      c.position.set((minX + maxX) / 2, h, (minZ + maxZ) / 2);
      this.root.add(c);
    }
    return f;
  }

  room(r: Room) {
    this.rooms.push(r);
  }

  add(i: Interactable) {
    this.interactables.push(i);
    for (const o of i.objects) o.traverse((c) => (c.userData.interactId = i.id));
    return i;
  }
}

/** Wall geometry with world-aligned UVs (so wallpaper lines up across pieces). */
function wallGeo(w: number, h: number, d: number, along0: number, y0: number, zAxis: boolean, mats: THREE.Material[]) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let f = 0; f < 6; f++) {
    const tile = (mats[f] as Mat).userData.tile ?? 1;
    const isMain = zAxis ? f < 2 : f >= 4;
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      if (isMain) {
        const along = along0 + (zAxis ? pos.getZ(i) + d / 2 : pos.getX(i) + w / 2);
        uv.setXY(i, along / tile, (y0 + pos.getY(i) + h / 2) / tile);
      } else uv.setXY(i, (uv.getX(i) * 0.12) / tile, (uv.getY(i) * h) / tile);
    }
  }
  uv.needsUpdate = true;
  return g;
}
