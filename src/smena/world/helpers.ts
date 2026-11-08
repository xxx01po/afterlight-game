import * as THREE from 'three';
import type { WorldCtx, Lamp } from './ctx';
import { Door, type DoorOpts } from './Door';
import type { MatName } from './materials';
import { boxGeo } from './StaticBuilder';
import { glowSprite, paperTex } from './textures';
import type { ItemId } from '@/smena/gameplay/items';
import type { PropDef } from '@/smena/core/Physics';

let glowTex: THREE.Texture | null = null;

export function addLamp(ctx: WorldCtx, id: string, pos: THREE.Vector3, o: Partial<Lamp> & { bulb?: THREE.Mesh; glowSize?: number } = {}) {
  glowTex ??= glowSprite();
  const lamp: Lamp = { id, pos: pos.clone(), color: 0xffcf8a, intensity: 6, range: 14, on: true, power: 'always', flicker: 0, bulbs: [], k: 1, ...o };
  if (o.bulb) lamp.bulbs.push(o.bulb);
  if (o.glowSize !== 0) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: lamp.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6, fog: true }));
    sp.scale.setScalar(o.glowSize ?? 1.6);
    sp.position.copy(pos).y += 0.15;
    ctx.root.add(sp);
    lamp.glow = sp;
  }
  ctx.lamps.push(lamp);
  return lamp;
}

/** Bare bulb hanging from a ceiling, with a live bulb mesh (emissive when lit). */
export function ceilingBulb(ctx: WorldCtx, id: string, x: number, y: number, z: number, o: Partial<Lamp> = {}, cold = false) {
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.4, 4), ctx.M.black);
  cord.position.set(x, y - 0.2, z);
  ctx.root.add(cord);
  const bulb = new THREE.Mesh(cold ? new THREE.BoxGeometry(1.1, 0.05, 0.12) : new THREE.SphereGeometry(0.05, 8, 6), ctx.M.bulbOff);
  bulb.position.set(x, y - 0.43, z);
  ctx.root.add(bulb);
  return addLamp(ctx, id, new THREE.Vector3(x, y - 0.5, z), { bulb, range: 9, intensity: 3.5, glowSize: 0.7, color: cold ? 0xdde8ff : 0xffc98a, ...o });
}

export function addDoor(ctx: WorldCtx, o: DoorOpts) {
  const d = new Door(ctx.M, o);
  ctx.root.add(d.pivot);
  ctx.doors.push(d);
  return d;
}

export function addProp(ctx: WorldCtx, id: string, mesh: THREE.Object3D, shape: PropDef['shape'], size: [number, number, number], mass: number, material: PropDef['material'], grabbable = true) {
  ctx.root.add(mesh);
  mesh.updateMatrixWorld(true);
  mesh.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  ctx.props.push({ id, mesh, shape, size: new THREE.Vector3(...size), mass, material, grabbable });
}

/** Simple dynamic props. */
export function propMesh(ctx: WorldCtx, kind: 'bucket' | 'can' | 'bottle' | 'box' | 'stool' | 'jar' | 'book' | 'canister' | 'pot', x: number, y: number, z: number, ry = 0) {
  const M = ctx.M;
  const g = new THREE.Group();
  const put = (geo: THREE.BufferGeometry, mat: THREE.Material, py = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = py;
    g.add(m);
  };
  let shape: PropDef['shape'] = 'box', size: [number, number, number] = [0.1, 0.1, 0.1], mass = 1, mat: PropDef['material'] = 'metal';
  switch (kind) {
    case 'bucket':
      put(new THREE.CylinderGeometry(0.15, 0.12, 0.3, 12, 1, true), M.metalGrey);
      put(new THREE.CircleGeometry(0.12, 12).rotateX(-Math.PI / 2), M.metalGrey, -0.149);
      (shape = 'cyl'), (size = [0.15, 0.15, 0.15]), (mass = 1.2);
      break;
    case 'can':
      put(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 10), M.metalRust);
      (shape = 'cyl'), (size = [0.04, 0.06, 0.04]), (mass = 0.3);
      break;
    case 'bottle':
      put(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), M.glassDirty);
      put(new THREE.CylinderGeometry(0.012, 0.03, 0.08, 8), M.glassDirty, 0.14);
      (shape = 'cyl'), (size = [0.035, 0.12, 0.035]), (mass = 0.4), (mat = 'glass');
      break;
    case 'jar':
      put(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 10), M.glassDirty);
      (shape = 'cyl'), (size = [0.06, 0.08, 0.06]), (mass = 0.6), (mat = 'glass');
      break;
    case 'box':
      put(boxGeo(0.4, 0.3, 0.3, 0.6), M.planks);
      (size = [0.2, 0.15, 0.15]), (mass = 3), (mat = 'cardboard');
      break;
    case 'stool':
      put(new THREE.BoxGeometry(0.34, 0.04, 0.34), M.planksDark, 0.2);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.42, 0.035), M.planksDark);
        l.position.set(sx * 0.13, -0.02, sz * 0.13);
        g.add(l);
      }
      (size = [0.17, 0.23, 0.17]), (mass = 2.5), (mat = 'wood');
      break;
    case 'book':
      put(new THREE.BoxGeometry(0.16, 0.04, 0.22), M.fabric);
      (size = [0.08, 0.02, 0.11]), (mass = 0.5), (mat = 'cardboard');
      break;
    case 'canister':
      put(new THREE.BoxGeometry(0.17, 0.42, 0.34), new THREE.MeshStandardMaterial({ color: 0x6b1e14, roughness: 0.5, metalness: 0.4 }));
      put(new THREE.BoxGeometry(0.05, 0.06, 0.18), M.metalGrey, 0.23);
      (size = [0.085, 0.24, 0.17]), (mass = 9);
      break;
    case 'pot':
      put(new THREE.CylinderGeometry(0.13, 0.11, 0.16, 12), M.metalGrey);
      (shape = 'cyl'), (size = [0.13, 0.08, 0.13]), (mass = 1);
      break;
  }
  g.position.set(x, y + (shape === 'cyl' ? size[1] : size[1]), z);
  g.rotation.y = ry;
  const id = `${kind}_${Math.round(x * 10)}_${Math.round(z * 10)}`;
  addProp(ctx, id, g, shape, size, mass, mat);
  return g;
}

/** Visible item lying in the world; Game turns it into a pickup interactable. */
export function pickup(ctx: WorldCtx, id: string, item: ItemId, mesh: THREE.Object3D, count = 1) {
  ctx.root.add(mesh);
  ctx.pickups.push({ id, item, count, mesh });
  return mesh;
}

export function itemMesh(ctx: WorldCtx, item: ItemId): THREE.Object3D {
  const M = ctx.M;
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, rz = 0) => {
    const me = new THREE.Mesh(geo, m);
    me.position.set(x, y, z);
    me.rotation.set(rx, 0, rz);
    g.add(me);
  };
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08a3a, metalness: 0.8, roughness: 0.35 });
  switch (item) {
    case 'flashlight':
      add(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 10), M.metalGreen, 0, 0.022, 0, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.034, 0.024, 0.05, 10), M.metalGreen, 0.12, 0.034, 0, 0, Math.PI / 2);
      break;
    case 'walkie':
      add(new THREE.BoxGeometry(0.06, 0.16, 0.035), M.black, 0, 0.08, 0);
      add(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 5), M.black, 0.018, 0.22, 0);
      break;
    case 'battery':
      for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.016, 0.016, 0.06, 8), new THREE.MeshLambertMaterial({ color: 0x2b5fa8 }), i * 0.035, 0.016, 0, Math.PI / 2);
      break;
    case 'medkit':
      add(new THREE.BoxGeometry(0.24, 0.08, 0.16), new THREE.MeshLambertMaterial({ color: 0xd8d4c8 }), 0, 0.04, 0);
      add(new THREE.BoxGeometry(0.1, 0.004, 0.03), M.redLed, 0, 0.082, 0);
      add(new THREE.BoxGeometry(0.03, 0.004, 0.1), M.redLed, 0, 0.082, 0);
      break;
    case 'key_storage':
    case 'key_archive':
    case 'fusebox_key':
      add(new THREE.BoxGeometry(0.07, 0.005, 0.018), brass, 0, 0.005, 0);
      add(new THREE.TorusGeometry(0.015, 0.004, 4, 10), brass, -0.045, 0.005, 0, Math.PI / 2);
      add(new THREE.BoxGeometry(0.04, 0.003, 0.025), new THREE.MeshLambertMaterial({ color: item === 'key_archive' ? 0xaa2222 : 0xd8d0b0 }), -0.08, 0.004, 0);
      break;
    case 'fuse':
      add(new THREE.CylinderGeometry(0.015, 0.015, 0.08, 8), new THREE.MeshLambertMaterial({ color: 0xe8e2d0 }), 0, 0.015, 0, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.017, 0.017, 0.012, 8), brass, 0.04, 0.015, 0, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.017, 0.017, 0.012, 8), brass, -0.04, 0.015, 0, 0, Math.PI / 2);
      break;
    case 'screwdriver':
      add(new THREE.CylinderGeometry(0.014, 0.014, 0.09, 8), new THREE.MeshLambertMaterial({ color: 0x1d3f9a }), 0, 0.014, 0, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.003, 0.003, 0.11, 5), M.metalGrey, 0.1, 0.014, 0, 0, Math.PI / 2);
      break;
    case 'pass':
      add(new THREE.BoxGeometry(0.085, 0.002, 0.055), new THREE.MeshLambertMaterial({ map: paperTex(91, 'photo') }), 0, 0.002, 0);
      break;
    case 'flaregun':
      add(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 10), new THREE.MeshLambertMaterial({ color: 0xc4561c }), 0, 0.03, 0, 0, Math.PI / 2);
      add(new THREE.BoxGeometry(0.03, 0.03, 0.09), new THREE.MeshLambertMaterial({ color: 0xc4561c }), -0.06, 0.015, 0.04);
      break;
    case 'flare':
      for (let i = 0; i < 2; i++) add(new THREE.CylinderGeometry(0.014, 0.014, 0.07, 8), new THREE.MeshLambertMaterial({ color: 0xb02020 }), i * 0.03, 0.035, 0);
      break;
    case 'canister':
      add(new THREE.BoxGeometry(0.17, 0.42, 0.34), M.metalRust, 0, 0.21, 0);
      break;
  }
  return g;
}

export function paperMesh(ctx: WorldCtx, seed: number, kind: 'note' | 'photo' | 'doc', w = 0.15) {
  const tex = paperTex(seed, kind);
  const h = kind === 'photo' ? w * 0.78 : w * 1.33;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
  void ctx;
  return m;
}

export function docAt(ctx: WorldCtx, id: string, docId: string, seed: number, kind: 'note' | 'photo' | 'doc', x: number, y: number, z: number, onWall?: number, ry = 0) {
  const m = paperMesh(ctx, seed, kind);
  m.position.set(x, y, z);
  if (onWall !== undefined) m.rotation.y = onWall;
  else {
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = ry;
    m.position.y += 0.003;
  }
  ctx.root.add(m);
  ctx.docs.push({ id, docId, mesh: m });
  return m;
}

/** Window frame + optional (possibly broken) glass in a wall opening — baked into static geometry. */
export function windowFrame(ctx: WorldCtx, x: number, y: number, z: number, w: number, h: number, ry: number, broken: boolean, mat: MatName = 'planksGrey') {
  const m4 = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
  const put = (mn: MatName, g: THREE.BufferGeometry) => ctx.b.add(mn, g.applyMatrix4(m4));
  const bar = (bw: number, bh: number, px: number, py: number) => put(mat, boxGeo(bw, bh, 0.08, 1).translate(px, py, 0));
  bar(w, 0.06, 0, -h / 2);
  bar(w, 0.06, 0, h / 2);
  bar(0.06, h, -w / 2, 0);
  bar(0.06, h, w / 2, 0);
  bar(0.04, h, 0, 0);
  bar(w, 0.04, 0, h * 0.15);
  if (!broken) put('glassDirty', new THREE.PlaneGeometry(w, h));
  else
    for (let i = 0; i < 3; i++) {
      // a few jagged shards still in the frame
      const s = new THREE.Shape();
      const sx = (i - 1) * w * 0.3, sy = -h / 2 + 0.05;
      s.moveTo(sx - 0.12, sy);
      s.lineTo(sx + 0.12, sy);
      s.lineTo(sx + 0.03 * (i - 1), sy + 0.15 + i * 0.08);
      put('glassDirty', new THREE.ShapeGeometry(s));
    }
}
