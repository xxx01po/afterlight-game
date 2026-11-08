import * as THREE from 'three';
import type { WorldCtx } from './ctx';
import { addLamp, docAt, itemMesh, pickup, propMesh } from './helpers';
import { bake } from './kit';
import { heightAt, ROADS, ROAD_COMPLEX, ROAD_VILLAGE, type P2 } from './layout';
import * as P from './props';
import { bootTex, footprintTex, labelTex } from './textures';
import { rng } from '@/utils/math';

function pointAlong(pts: P2[], dist: number) {
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const L = Math.hypot(bx - ax, bz - az);
    if (acc + L >= dist) {
      const t = (dist - acc) / L;
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, dx: (bx - ax) / L, dz: (bz - az) / L };
    }
    acc += L;
  }
  const n = pts.length - 1;
  const [ax, az] = pts[n - 1], [bx, bz] = pts[n];
  const L = Math.hypot(bx - ax, bz - az);
  return { x: bx, z: bz, dx: (bx - ax) / L, dz: (bz - az) / L };
}
export function polyLength(pts: P2[]) {
  let L = 0;
  for (let i = 0; i < pts.length - 1; i++) L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  return L;
}

function roadMesh(pts: P2[], width: number, tile: number) {
  const L = polyLength(pts);
  const n = Math.ceil(L / 1.5);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const d = (i / n) * L;
    const p = pointAlong(pts, d);
    const nx = -p.dz, nz = p.dx;
    for (const s of [-1, 1]) {
      const x = p.x + nx * (width / 2) * s, z = p.z + nz * (width / 2) * s;
      pos.push(x, heightAt(x, z) + 0.035, z);
      uv.push(((s + 1) / 2) * (width / tile), d / tile);
    }
    if (i < n) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Decal quads lying on the terrain. */
function decal(ctx: WorldCtx, tex: THREE.Texture, x: number, z: number, ry: number, s: number, parent: THREE.Object3D) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(s * 0.5, s), new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.set(-Math.PI / 2, 0, ry);
  m.position.set(x, heightAt(x, z) + 0.05, z);
  parent.add(m);
  void ctx;
  return m;
}

/**
 * Zone 2 — forest: roads, broken lamp posts, power line, abandoned vehicles,
 * fallen trees, stumps, creature tracks, the road sign, and story spots.
 */
export function buildForest(ctx: WorldCtx) {
  const { b, M } = ctx;
  b.chunk = 'forest';
  for (const r of ROADS) {
    const mat = r.kind === 'asphalt' ? 'asphalt' : 'dirtRoad';
    b.add(mat, roadMesh(r.pts, r.width, (M[mat].userData.tile as number) ?? 4));
  }
  const R = rng(99);

  // fallen trees and stumps (static, with colliders)
  const logAt = (x: number, z: number, ry: number, len: number, r = 0.25) => {
    const y = heightAt(x, z) + r * 0.8;
    const g = new THREE.CylinderGeometry(r * 0.8, r, len, 8, 1);
    b.geo('barkSpruce', g, x, y, z, ry, 0, Math.PI / 2);
    b.boxCollider(x, y, z, (len / 2) * Math.abs(Math.cos(ry)) + r * Math.abs(Math.sin(ry)), r, (len / 2) * Math.abs(Math.sin(ry)) + r * Math.abs(Math.cos(ry)));
    // broken branches sticking out
    for (let i = 0; i < 3; i++) {
      const bl = 0.6 + R() * 0.8;
      const br = new THREE.CylinderGeometry(0.02, 0.05, bl, 4);
      const t = (R() - 0.5) * len * 0.8;
      b.geo('barkDead', br, x + Math.cos(ry) * t, y + 0.25, z - Math.sin(ry) * t, R() * 6, 0.6 + R() * 0.6, 0);
    }
  };
  const stump = (x: number, z: number, h = 0.6) => {
    const y = heightAt(x, z);
    b.geo('barkSpruce', new THREE.CylinderGeometry(0.28, 0.36, h, 8), x, y + h / 2, z);
    // jagged snapped top
    b.geo('barkDead', new THREE.ConeGeometry(0.26, 0.5, 5), x + 0.05, y + h + 0.2, z, R() * 3, 0.2, 0.1);
    b.cylinderCollider(x, y + h / 2, z, 0.34, h / 2 + 0.2);
  };
  const logs: [number, number, number, number][] = [[7, -40, 0.4, 9], [-14, -52, 1.2, 7], [-30, -72, 0.2, 11], [-9, -86, 2.1, 8], [8, -112, 0.8, 10], [-42, -88, 1.6, 9], [22, -96, 2.6, 8], [-20, -40, 1.0, 6]];
  logs.forEach(([x, z, ry, l]) => logAt(x, z, ry, l));
  for (let i = 0; i < 26; i++) {
    const x = (R() - 0.5) * 220, z = -30 - R() * 120;
    stump(x, z, 0.4 + R() * 0.6);
  }
  // a tree that fell across the village road — must be stepped around (narrow gap)
  logAt(-27.5, -86.5, 0.35, 5.5, 0.32);

  // power line along the complex road (dead wires)
  const L = polyLength(ROAD_COMPLEX);
  let prev: THREE.Vector3 | null = null;
  for (let d = 4; d < L; d += 18) {
    const p = pointAlong(ROAD_COMPLEX, d);
    const x = p.x - p.dz * 3.4, z = p.z + p.dx * 3.4;
    const y = heightAt(x, z);
    const lean = (R() - 0.5) * 0.12;
    bake(b, P.woodPole(M, 7.5).place(x, y, z, Math.atan2(p.dx, p.dz)), {});
    void lean;
    const top = new THREE.Vector3(x, y + 7.1, z);
    if (prev) {
      // sagging wire as a thin tube along a catenary-ish curve
      const mid = prev.clone().add(top).multiplyScalar(0.5);
      mid.y -= 1.1;
      const curve = new THREE.QuadraticBezierCurve3(prev, mid, top);
      b.add('black', new THREE.TubeGeometry(curve, 8, 0.012, 3, false));
    }
    prev = top;
  }

  // old street lamps along the village road; most are dead, a few flicker
  const VL = polyLength(ROAD_VILLAGE);
  let li = 0;
  for (let d = 10; d < VL - 20; d += 24) {
    const p = pointAlong(ROAD_VILLAGE, d);
    const side = li % 2 ? 1 : -1;
    const x = p.x - p.dz * 3.2 * side, z = p.z + p.dx * 3.2 * side;
    const y = heightAt(x, z);
    const ry = Math.atan2(p.dz * side, -p.dx * side);
    const { kit, light } = P.lampPost(M, 1.2, 5.5);
    kit.place(x, y, z, ry);
    bake(b, kit);
    const wp = light.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(new THREE.Vector3(x, y, z));
    const bm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.36), M.bulbOff);
    bm.position.copy(wp).y += 0.19;
    bm.rotation.y = ry;
    ctx.root.add(bm);
    const alive = li === 1 || li === 4 || li === 6;
    if (alive) addLamp(ctx, 'roadLamp' + li, wp, { bulb: bm, power: 'always', intensity: 6, range: 15, color: 0xd8e8ff, flicker: 0.6, glowSize: 1.8 });
    li++;
  }

  // abandoned vehicles
  {
    const p = pointAlong(ROAD_VILLAGE, 58);
    const x = p.x + 3.6, z = p.z + 0.5;
    bake(b, P.van(M, 11, true).place(x, heightAt(x, z) - 0.15, z, 0.3), { shrink: 0.05 });
    ctx.spots.van = new THREE.Object3D();
    ctx.spots.van.position.set(x, heightAt(x, z) + 1, z);
    ctx.root.add(ctx.spots.van);
    const md = itemMesh(ctx, 'medkit');
    md.position.set(x - 0.4, heightAt(x, z) + 0.92, z + 1.9);
    pickup(ctx, 'pk_medkit_van', 'medkit', md);
  }
  {
    const x = -2, z = -118;
    bake(b, P.truck(M).place(x, heightAt(x, z) - 0.1, z, 2.4), { shrink: 0.1 });
    const bat = itemMesh(ctx, 'battery');
    bat.position.set(x + 0.2, heightAt(x, z) + 1.15, z);
    pickup(ctx, 'pk_battery_truck', 'battery', bat);
  }
  bake(b, P.barrel(M).place(-19, heightAt(-19, -60), -60, 0));
  propMesh(ctx, 'bucket', -17.5, heightAt(-17.5, -61), -61);
  bake(b, P.tire(M).place(9, heightAt(9, -110), -110, 0), { collide: false });

  // sign at the fork
  {
    const x = -20.5, z = -78;
    const s = P.signBoard(M, labelTex(['← СОСНОВКА 0,4', 'КЕДР-7 0,8 →'], 512, 200, '#e8e4d8', '#1f4e8c', 'bold 50px sans-serif'), 1.5, 0.6, 1.5);
    s.place(x, heightAt(x, z), z, -2.4);
    ctx.root.add(s.g);
    ctx.dynamic.forkSign = s.g;
    b.boxCollider(x, heightAt(x, z) + 1, z, 0.1, 1, 0.1);
  }

  // creature tracks leading from the north gate into the trees (shown by story)
  {
    const tracks = new THREE.Group();
    tracks.name = 'tracksGate';
    const ft = footprintTex();
    const pts: [number, number][] = [];
    for (let i = 0; i < 22; i++) pts.push([-1.2 - i * 0.55 + Math.sin(i * 0.7) * 0.3, -19.5 - i * 1.15]);
    pts.forEach(([x, z], i) => decal(ctx, ft, x + (i % 2 ? 0.22 : -0.22), z, 0.45 + (i % 2 ? 0.1 : -0.1), 0.62, tracks));
    tracks.visible = false;
    ctx.root.add(tracks);
    ctx.dynamic.tracksGate = tracks;
    // boot prints that look like yours… heading towards the village (a clue)
    const boots = new THREE.Group();
    const bt = bootTex();
    for (let i = 0; i < 18; i++) {
      const p = pointAlong(ROAD_VILLAGE, 30 + i * 0.8);
      decal(ctx, bt, p.x + -p.dz * (i % 2 ? 0.18 : -0.18) + 0.6, p.z + p.dx * (i % 2 ? 0.18 : -0.18), Math.atan2(-p.dx, -p.dz) + Math.PI, 0.34, boots);
    }
    ctx.root.add(boots);
    ctx.dynamic.bootPrints = boots;
  }

  // a note nailed to a tree on the way (lore)
  {
    const p = pointAlong(ROAD_VILLAGE, 44);
    const x = p.x - p.dz * 2.6, z = p.z + p.dx * 2.6;
    b.geo('barkSpruce', new THREE.CylinderGeometry(0.22, 0.28, 6, 7), x, heightAt(x, z) + 3, z);
    b.cylinderCollider(x, heightAt(x, z) + 3, z, 0.28, 3);
    const nx = x + p.dz * 0.29, nz = z - p.dx * 0.29;
    docAt(ctx, 'doc_tree', 'treeNote', 21, 'note', nx, heightAt(x, z) + 1.6, nz, Math.atan2(p.dz, -p.dx));
  }

  // story spots along the roads (anomaly / encounter anchors)
  const spot = (name: string, pts: P2[], d: number, off = 0) => {
    const p = pointAlong(pts, d);
    const o = new THREE.Object3D();
    const x = p.x - p.dz * off, z = p.z + p.dx * off;
    o.position.set(x, heightAt(x, z), z);
    o.userData.dir = new THREE.Vector3(p.dx, 0, p.dz);
    ctx.root.add(o);
    ctx.spots[name] = o;
  };
  spot('figureFar', ROAD_VILLAGE, 52, -1); // distant figure on the road
  spot('footstepsBehind', ROAD_VILLAGE, 28, 0);
  spot('roadChange', ROAD_VILLAGE, 70, 0);
  spot('creatureCross', ROAD_VILLAGE, 84, 0);
  spot('villageEntry', ROAD_VILLAGE, 118, 0);
  spot('complexRoad', ROAD_COMPLEX, 40, 0);
  spot('complexGate', ROAD_COMPLEX, polyLength(ROAD_COMPLEX) - 6, 0);
  spot('fork', ROAD_VILLAGE, 68, 0);
}

export { pointAlong };
