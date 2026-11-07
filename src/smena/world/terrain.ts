import * as THREE from 'three';
import { heightAt, roadDistance, WORLD_HALF, ZONES } from './layout';
import { fbm } from './noise';
import type { StaticShape } from '@/smena/core/Physics';
import { clamp } from '@/utils/math';

/**
 * Terrain mesh + matching trimesh collider (same vertices → feet never float).
 * Vertex colours blend forest floor, moss and mud for variety without extra textures.
 */
export function buildTerrain(mat: THREE.MeshLambertMaterial, step = 3) {
  const n = Math.round((WORLD_HALF * 2) / step) + 1;
  const pos = new Float32Array(n * n * 3);
  const uv = new Float32Array(n * n * 2);
  const col = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = -WORLD_HALF + i * step, z = -WORLD_HALF + j * step;
      const y = heightAt(x, z);
      const k = j * n + i;
      pos.set([x, y, z], k * 3);
      uv.set([x / 4, z / 4], k * 2);
      const moss = clamp(fbm(x / 25 + 40, z / 25, 2) * 1.5 + 0.3, 0, 1);
      const rd = roadDistance(x, z);
      const mud = clamp(1 - (rd - 0.5) / 4, 0, 1);
      let r = 1, g = 1, b = 1;
      r = r * (1 - moss * 0.25) + mud * 0.05;
      g = g * (1 + moss * 0.12) - mud * 0.08;
      b = b * (1 - moss * 0.15) - mud * 0.12;
      const base = ZONES.base;
      if (Math.abs(x - base.x) < base.hx + 2 && Math.abs(z - base.z) < base.hz + 2) (r = 0.85), (g = 0.85), (b = 0.82);
      const v = 0.82 + fbm(x / 6, z / 6, 2) * 0.18;
      col.set([r * v, g * v, b * v], k * 3);
    }
  const idx = new Uint32Array((n - 1) * (n - 1) * 6);
  let p = 0;
  for (let j = 0; j < n - 1; j++)
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      idx.set([a, c, b, b, c, d], p);
      p += 6;
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  mat.vertexColors = true;
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'terrain';
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  const collider: StaticShape = { kind: 'mesh', vertices: pos, indices: idx, surface: 'terrain' };
  return { mesh, collider };
}
