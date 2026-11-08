import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MatLib } from './materials';
import { heightAt, PLAY, roadDistance, ZONES } from './layout';
import { fbm } from './noise';
import { rng } from '@/utils/math';
import type { StaticShape } from '@/smena/core/Physics';

type Part = { hi: THREE.BufferGeometry; lo: THREE.BufferGeometry; mat: THREE.Material };
interface Variant { name: string; parts: Part[]; trunkR: number; collide: boolean }

const windUniform = { value: 0 };
export const setWindTime = (t: number) => (windUniform.value = t);

/** Inject cheap wind sway into instanced foliage (no extra draw calls, no CPU cost). */
function addWind(mat: THREE.Material, strength: number) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windUniform;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
        float sw = sin(uWind * 1.1 + ph) * 0.6 + sin(uWind * 2.7 + ph * 1.7) * 0.25;
        transformed.x += sw * ${strength.toFixed(3)} * max(position.y - 1.5, 0.0);
        transformed.z += cos(uWind * 0.9 + ph) * ${(strength * 0.6).toFixed(3)} * max(position.y - 1.5, 0.0);
      #endif`,
    );
  };
  mat.customProgramCacheKey = () => 'wind' + strength;
}

function jitter(g: THREE.BufferGeometry, R: () => number, amt: number) {
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + (R() - 0.5) * amt, p.getY(i) + (R() - 0.5) * amt * 0.6, p.getZ(i) + (R() - 0.5) * amt);
  return g;
}

function trunk(h: number, r0: number, r1: number, seg: number, R: () => number, lean = 0) {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 4, true);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setX(i, p.getX(i) + Math.sin(y * 0.7 + R()) * 0.04 + lean * y * y * 0.01);
  }
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * h / 3);
  g.computeVertexNormals();
  return g;
}

function cone(r: number, h: number, seg: number, y: number, R: () => number, droop = 0.25) {
  const g = new THREE.ConeGeometry(r, h, seg, 2, true);
  g.translate(0, y + h / 2, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), pz = p.getZ(i), py = p.getY(i);
    const rr = Math.hypot(px, pz) / r;
    // drooping branch tips + ragged silhouette
    const n = 0.75 + R() * 0.5;
    p.setXYZ(i, px * n, py - rr * rr * droop * h, pz * n);
  }
  g.computeVertexNormals();
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * 1.2, uv.getY(i) * h * 0.8);
  return g;
}

function blob(r: number, x: number, y: number, z: number, R: () => number, detail = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  jitter(g, R, r * 0.5);
  g.scale(1, 0.8, 1);
  g.translate(x, y, z);
  g.computeVertexNormals();
  return g;
}

function merge(list: THREE.BufferGeometry[]) {
  const norm = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
    return n;
  });
  return mergeGeometries(norm, false)!;
}

function spruce(seed: number, M: MatLib, height: number, tiers: number, dark: boolean): Variant {
  const R = rng(seed);
  const hiF: THREE.BufferGeometry[] = [], loF: THREE.BufferGeometry[] = [];
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const r = (1 - t) * height * 0.28 + 0.35;
    const y = 1.2 + t * (height - 1.6);
    hiF.push(cone(r, height / tiers * 1.9, 9, y, R));
  }
  for (let i = 0; i < 3; i++) {
    const t = i / 3;
    loF.push(cone((1 - t) * height * 0.28 + 0.3, height / 3 * 1.5, 5, 1.2 + t * (height - 2.2), R, 0.15));
  }
  const tr = trunk(height * 0.9, 0.24, 0.05, 6, R);
  return {
    name: 'spruce' + seed,
    trunkR: 0.28,
    collide: true,
    parts: [
      { hi: tr, lo: trunk(height * 0.9, 0.24, 0.05, 4, R), mat: M.barkSpruce },
      { hi: merge(hiF), lo: merge(loF), mat: dark ? M.spruceDark : M.spruce },
    ],
  };
}

function pine(seed: number, M: MatLib, height: number): Variant {
  const R = rng(seed);
  const hi: THREE.BufferGeometry[] = [], lo: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = R() * Math.PI * 2, d = 0.6 + R() * 1.2;
    hi.push(blob(1.3 + R() * 0.8, Math.cos(a) * d, height - 2.5 + R() * 2.2, Math.sin(a) * d, R));
  }
  lo.push(blob(2.4, 0, height - 1.6, 0, R, 0));
  return {
    name: 'pine' + seed,
    trunkR: 0.25,
    collide: true,
    parts: [
      { hi: trunk(height - 1, 0.24, 0.12, 6, R, 0.4), lo: trunk(height - 1, 0.24, 0.12, 4, R, 0.4), mat: M.barkPine },
      { hi: merge(hi), lo: merge(lo), mat: M.pine },
    ],
  };
}

function dead(seed: number, M: MatLib, height: number): Variant {
  const R = rng(seed);
  const parts: THREE.BufferGeometry[] = [trunk(height, 0.22, 0.04, 6, R, 0.8)];
  for (let i = 0; i < 6; i++) {
    const y = height * (0.35 + R() * 0.55);
    const len = 1 + R() * 1.8;
    const b = new THREE.CylinderGeometry(0.015, 0.06, len, 4, 1, true);
    b.translate(0, len / 2, 0);
    b.rotateZ(0.9 + R() * 0.6);
    b.rotateY(R() * Math.PI * 2);
    b.translate(0, y, 0);
    parts.push(b);
  }
  const g = merge(parts);
  g.computeVertexNormals();
  return { name: 'dead' + seed, trunkR: 0.22, collide: true, parts: [{ hi: g, lo: trunk(height, 0.22, 0.04, 4, R, 0.8), mat: M.barkDead }] };
}

function birch(seed: number, M: MatLib, height: number): Variant {
  const R = rng(seed);
  const crowns: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) crowns.push(blob(1 + R() * 0.6, (R() - 0.5) * 1.4, height * 0.6 + i * 0.9, (R() - 0.5) * 1.4, R));
  return {
    name: 'birch' + seed,
    trunkR: 0.16,
    collide: true,
    parts: [
      { hi: trunk(height, 0.16, 0.06, 7, R, 1.2), lo: trunk(height, 0.16, 0.06, 4, R, 1.2), mat: M.birch },
      { hi: merge(crowns), lo: blob(1.8, 0, height * 0.75, 0, R, 0), mat: M.bushDry },
    ],
  };
}

function bush(seed: number, M: MatLib, dry: boolean): Variant {
  const R = rng(seed);
  const hi: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) hi.push(blob(0.5 + R() * 0.35, (R() - 0.5) * 1.1, 0.4 + R() * 0.3, (R() - 0.5) * 1.1, R));
  return { name: 'bush' + seed, trunkR: 0, collide: false, parts: [{ hi: merge(hi), lo: blob(0.75, 0, 0.5, 0, R, 0), mat: dry ? M.bushDry : M.bush }] };
}

const CELL = 16;

/**
 * Instanced vegetation with per-cell frustum culling, two LOD levels and a draw
 * distance. Instance matrices are precomputed; each frame only visible cells are
 * copied into the instance buffers (a few thousand floats — negligible).
 */
export class Forest {
  readonly group = new THREE.Group();
  readonly colliders: StaticShape[] = [];
  private variants: Variant[];
  private hiMeshes: THREE.InstancedMesh[][] = [];
  private loMeshes: THREE.InstancedMesh[][] = [];
  private cells = new Map<string, { cx: number; cz: number; box: THREE.Box3; items: { v: number; m: Float32Array }[] }>();
  private frustum = new THREE.Frustum();
  private pm = new THREE.Matrix4();
  drawDistance = 75;
  hiDistance = 28;
  /** Positions of trees (for AI cover/hiding and ambience emitters). */
  readonly trunks: THREE.Vector3[] = [];

  constructor(M: MatLib, isBlocked: (x: number, z: number) => boolean) {
    this.variants = [
      spruce(1, M, 14, 8, false), spruce(2, M, 18, 9, true), spruce(3, M, 10, 6, false), spruce(4, M, 22, 10, true),
      pine(5, M, 17), pine(6, M, 13),
      dead(7, M, 9), dead(8, M, 12),
      birch(9, M, 11),
      bush(10, M, false), bush(11, M, true), bush(12, M, false),
    ];
    for (const v of this.variants) for (const p of v.parts) if (p.mat !== M.barkSpruce && p.mat !== M.barkPine && p.mat !== M.barkDead && p.mat !== M.birch) addWind(p.mat, v.collide ? 0.012 : 0.03);
    const R = rng(2024);
    const counts = new Array(this.variants.length).fill(0);
    const place = (x: number, z: number, vi: number, s: number) => {
      const y = heightAt(x, z) - 0.15;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * Math.PI * 2), new THREE.Vector3(s, s * (0.9 + R() * 0.25), s));
      const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
      let c = this.cells.get(key);
      if (!c) {
        const cx = Math.floor(x / CELL) * CELL + CELL / 2, cz = Math.floor(z / CELL) * CELL + CELL / 2;
        c = { cx, cz, box: new THREE.Box3(new THREE.Vector3(cx - CELL / 2 - 4, -6, cz - CELL / 2 - 4), new THREE.Vector3(cx + CELL / 2 + 4, 30, cz + CELL / 2 + 4)), items: [] };
        this.cells.set(key, c);
      }
      c.items.push({ v: vi, m: new Float32Array(m.elements) });
      counts[vi]++;
      const v = this.variants[vi];
      if (v.collide) {
        this.colliders.push({ kind: 'cyl', x, y: y + 2, z, r: v.trunkR * s, hh: 2.2 });
        this.trunks.push(new THREE.Vector3(x, y, z));
      }
    };
    const step = 3.1;
    for (let z = PLAY.minZ - 25; z < PLAY.maxZ + 30; z += step)
      for (let x = PLAY.minX - 25; x < PLAY.maxX + 25; x += step) {
        const px = x + (R() - 0.5) * step * 0.9, pz = z + (R() - 0.5) * step * 0.9;
        if (isBlocked(px, pz)) continue;
        const rd = roadDistance(px, pz);
        if (rd < 1.8) continue;
        const dens = fbm(px / 35, pz / 35, 3) * 0.9 + 0.55 - (rd < 6 ? 0.35 : 0);
        const r = R();
        if (r > dens) {
          // clearing: occasional bush instead
          if (R() < 0.22) place(px, pz, 9 + Math.floor(R() * 3), 0.7 + R() * 0.7);
          continue;
        }
        const k = R();
        const vi = k < 0.62 ? Math.floor(R() * 4) : k < 0.78 ? 4 + Math.floor(R() * 2) : k < 0.86 ? 6 + Math.floor(R() * 2) : k < 0.92 ? 8 : 9 + Math.floor(R() * 3);
        place(px, pz, vi, 0.75 + R() * 0.55);
      }
    this.variants.forEach((v, vi) => {
      const his: THREE.InstancedMesh[] = [], los: THREE.InstancedMesh[] = [];
      for (const p of v.parts) {
        const hi = new THREE.InstancedMesh(p.hi, p.mat, Math.max(1, counts[vi]));
        const lo = new THREE.InstancedMesh(p.lo, p.mat, Math.max(1, counts[vi]));
        for (const im of [hi, lo]) {
          im.count = 0;
          im.frustumCulled = false; // culled per cell on the CPU instead
          im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          this.group.add(im);
        }
        his.push(hi);
        los.push(lo);
      }
      this.hiMeshes.push(his);
      this.loMeshes.push(los);
    });
  }

  get instanceCount() {
    let n = 0;
    this.cells.forEach((c) => (n += c.items.length));
    return n;
  }

  update(camera: THREE.Camera, pos: THREE.Vector3) {
    this.pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.pm);
    const nHi = this.variants.map(() => 0), nLo = this.variants.map(() => 0);
    const dd2 = this.drawDistance * this.drawDistance, hd2 = this.hiDistance * this.hiDistance;
    this.cells.forEach((c) => {
      const dx = c.cx - pos.x, dz = c.cz - pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > dd2 + 400) return;
      if (d2 > 2 * CELL * CELL && !this.frustum.intersectsBox(c.box)) return;
      const hi = d2 < hd2;
      for (const it of c.items) {
        const list = hi ? this.hiMeshes[it.v] : this.loMeshes[it.v];
        const idx = hi ? nHi[it.v]++ : nLo[it.v]++;
        for (const im of list) (im.instanceMatrix.array as Float32Array).set(it.m, idx * 16);
      }
    });
    this.variants.forEach((_, vi) => {
      for (const im of this.hiMeshes[vi]) {
        im.count = nHi[vi];
        im.instanceMatrix.clearUpdateRanges();
        im.instanceMatrix.addUpdateRange(0, nHi[vi] * 16);
        im.instanceMatrix.needsUpdate = true;
      }
      for (const im of this.loMeshes[vi]) {
        im.count = nLo[vi];
        im.instanceMatrix.clearUpdateRanges();
        im.instanceMatrix.addUpdateRange(0, nLo[vi] * 16);
        im.instanceMatrix.needsUpdate = true;
      }
    });
  }
}

/** Areas where vegetation must not grow (buildings, yards). */
export function vegetationBlocked(x: number, z: number) {
  for (const zn of Object.values(ZONES)) if (Math.abs(x - zn.x) < zn.hx + 3 && Math.abs(z - zn.z) < zn.hz + 3) return true;
  return false;
}
