import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Merge static single-material meshes that share a material into one mesh.
 * Interactive, animated or special meshes are skipped. Big win for draw calls
 * on phones (dozens of boxes → a handful of meshes).
 */
export function mergeStatic(root: THREE.Object3D, occluders: THREE.Object3D[]) {
  root.updateMatrixWorld(true);
  const groups = new Map<THREE.Material, THREE.Mesh[]>();
  const pieces = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const occSet = new Set(occluders);
  const multiOcc = new Set<THREE.Material>();
  // 1) split multi-material meshes (walls) into per-material pieces
  for (const o of [...root.children]) {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !Array.isArray(m.material) || m.userData.interactId || m.userData.dynamic) continue;
    const g = m.geometry;
    if (!g.index) continue;
    const idx = g.index.array;
    for (const gr of g.groups) {
      const mat = m.material[gr.materialIndex ?? 0];
      const sub = new THREE.BufferGeometry();
      sub.setAttribute('position', g.attributes.position.clone());
      sub.setAttribute('normal', g.attributes.normal.clone());
      sub.setAttribute('uv', g.attributes.uv.clone());
      sub.setIndex(Array.from(idx.slice(gr.start, gr.start + gr.count)));
      sub.applyMatrix4(m.matrixWorld);
      let arr = pieces.get(mat);
      if (!arr) pieces.set(mat, (arr = []));
      arr.push(sub);
      if (occSet.has(m)) multiOcc.add(mat);
    }
    occSet.delete(m);
    m.removeFromParent();
    g.dispose();
  }
  for (const o of root.children) {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) continue;
    const ud = m.userData;
    if (ud.interactId || ud.windowGlass || ud.dynamic || !m.visible) continue;
    const mat = m.material as THREE.Material;
    if ((mat as THREE.ShaderMaterial).isShaderMaterial) continue;
    if ((mat as THREE.MeshBasicMaterial).isMeshBasicMaterial && !mat.transparent) continue; // screens, bulbs
    if (m.layers.mask !== 1) continue;
    const g = m.geometry;
    if (!g.index || !g.attributes.normal || !g.attributes.uv) continue;
    let arr = groups.get(mat);
    if (!arr) groups.set(mat, (arr = []));
    arr.push(m);
  }
  let removed = 0, created = 0;
  for (const mat of new Set([...groups.keys(), ...pieces.keys()])) {
    const meshes = groups.get(mat) ?? [];
    const extra = pieces.get(mat) ?? [];
    if (meshes.length + extra.length < 2 && !extra.length) continue;
    const geos = meshes.map((m) => {
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      return g;
    });
    geos.push(...extra);
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.renderOrder = meshes[0]?.renderOrder ?? 0;
    mesh.name = 'merged';
    let isOcc = multiOcc.has(mat);
    for (const m of meshes) {
      if (occSet.has(m)) {
        isOcc = true;
        occSet.delete(m);
      }
      m.removeFromParent();
      m.geometry.dispose();
      removed++;
    }
    root.add(mesh);
    if (isOcc) occSet.add(mesh);
    created++;
  }
  occluders.length = 0;
  occluders.push(...occSet);
  return { removed, created };
}
