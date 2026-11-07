import * as THREE from 'three';
import type { WorldCtx } from './ctx';
import { addDoor, addLamp, docAt, itemMesh, pickup, propMesh, windowFrame } from './helpers';
import { bake } from './kit';
import * as P from './props';
import type { MatName } from './materials';
import type { Opening } from './StaticBuilder';
import { labelTex } from './textures';

interface HouseOpts {
  id: string;
  w: number;
  d: number;
  h?: number;
  door?: number; // local x of the front door centre
  enter?: boolean;
  boarded?: boolean;
  broken?: boolean;
  collapsed?: boolean;
  partition?: number; // local x of an inner wall with a doorway
  wallMat?: MatName;
}

/**
 * Log house («изба») builder: foundation, log walls with door/window openings,
 * plank floor and ceiling, sagging gable roof of rusty tin, porch step.
 * Returns a local→world transform helper so interiors can be furnished in local space.
 */
function house(ctx: WorldCtx, cx: number, cz: number, ry: number, o: HouseOpts) {
  const { b } = ctx;
  const h = o.h ?? 2.6;
  const fy = 0.3;
  const { w, d } = o;
  const c = Math.cos(ry), s = Math.sin(ry);
  const W = (lx: number, lz: number) => ({ x: cx + lx * c + lz * s, z: cz - lx * s + lz * c });
  const wallMat = o.wallMat ?? 'logs';
  // foundation + floor
  b.box('concreteDark', cx, fy / 2 - 0.05, cz, w + 0.3, fy + 0.1, d + 0.3, { ry, surface: 'wood' });
  b.box('planksDark', cx, fy + 0.01, cz, w - 0.3, 0.02, d - 0.3, { ry, collide: false });
  const doorX = o.door ?? 0;
  const winH = 1.0, sill = 0.95;
  const wall = (lx1: number, lz1: number, lx2: number, lz2: number, ops: Opening[]) => {
    const a = W(lx1, lz1), bb = W(lx2, lz2);
    b.wall(wallMat, a.x, a.z, bb.x, bb.z, fy, h, 0.26, o.collapsed ? [] : ops, 'wood');
  };
  // front (+z local) has the door; corners overlap a bit like real log ends
  const front: Opening[] = [{ at: doorX + w / 2, w: 0.95, h: 1.95 }];
  if (w > 5) front.push({ at: doorX + w / 2 + (doorX > 0 ? -2 : 2), w: 0.9, h: winH, sill });
  if (o.collapsed) {
    // ruin: low broken walls only
    const lw = (lx1: number, lz1: number, lx2: number, lz2: number, hh: number) => {
      const a = W(lx1, lz1), bb = W(lx2, lz2);
      b.wall(wallMat, a.x, a.z, bb.x, bb.z, fy, hh, 0.26, [], 'wood');
    };
    lw(-w / 2, d / 2, w / 2 - 1.5, d / 2, 1.1);
    lw(w / 2, -d / 2, w / 2, d / 2, 1.7);
    lw(-w / 2, -d / 2, w / 2, -d / 2, 2.2);
    lw(-w / 2, -d / 2, -w / 2, d / 2 - 2, 0.8);
    // fallen roof slab leaning on the back wall
    const p = W(0, -d / 4);
    b.box('roofTin', p.x, 1.3, p.z, w * 0.9, 0.06, d * 0.6, { ry, collide: true });
    return { W, fy, h };
  }
  wall(-w / 2, d / 2, w / 2, d / 2, front);
  wall(-w / 2, -d / 2, w / 2, -d / 2, [{ at: w / 2, w: 0.9, h: winH, sill }]);
  wall(w / 2, -d / 2, w / 2, d / 2, [{ at: d / 2, w: 0.9, h: winH, sill }]);
  wall(-w / 2, -d / 2, -w / 2, d / 2, [{ at: d / 2, w: 0.9, h: winH, sill }]);
  // log ends at the corners
  for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
    const p = W(lx, lz);
    b.box(wallMat, p.x, fy + h / 2, p.z, 0.42, h, 0.42, { ry, collide: false });
  }
  if (o.partition !== undefined) {
    const a = W(o.partition, -d / 2 + 0.13), bb = W(o.partition, d / 2 - 0.13);
    b.wall('planks', a.x, a.z, bb.x, bb.z, fy, h, 0.1, [{ at: d * 0.35, w: 0.85, h: 1.95 }], 'wood');
  }
  // ceiling + gable roof
  b.box('planksGrey', cx, fy + h + 0.03, cz, w - 0.2, 0.06, d - 0.2, { ry });
  const rise = 1.5;
  const slope = Math.atan2(rise, d / 2);
  const len = Math.hypot(rise, d / 2) + 0.5;
  for (const sd of [-1, 1]) {
    const p = W(0, (sd * d) / 4);
    const geo = new THREE.BoxGeometry(w + 0.7, 0.05, len);
    b.geo('roofTin', geo, p.x, fy + h + rise / 2 + 0.05, p.z, ry, sd * slope, 0);
  }
  // gable triangles
  for (const sx of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2, 0);
    shape.lineTo(d / 2, 0);
    shape.lineTo(0, rise);
    const g = new THREE.ShapeGeometry(shape);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
    const p = W((sx * w) / 2, 0);
    b.geo('planksGrey', g, p.x, fy + h, p.z, ry + (sx * Math.PI) / 2, 0, 0);
    const g2 = g.clone();
    b.geo('planksGrey', g2, p.x, fy + h, p.z, ry + (sx * Math.PI) / 2 + Math.PI, 0, 0);
  }
  // porch step
  const st = W(doorX, d / 2 + 0.45);
  b.box('planksDark', st.x, 0.1, st.z, 1.3, 0.2, 0.6, { ry, surface: 'wood' });
  // windows
  const winRy = [ry, ry + Math.PI / 2, ry - Math.PI / 2];
  const wp = [W(0, -d / 2), W(w / 2, 0), W(-w / 2, 0)];
  wp.forEach((p, i) => windowFrame(ctx, p.x, fy + sill + winH / 2, p.z, 0.9, winH, winRy[i], o.broken ?? true, 'planksGrey'));
  // door / boards
  const hinge = W(doorX - 0.475, d / 2);
  if (o.boarded) {
    for (let i = 0; i < 4; i++) {
      const p = W(doorX, d / 2 + 0.16);
      b.box('planksGrey', p.x, fy + 0.4 + i * 0.45, p.z, 1.15, 0.14, 0.04, { ry, collide: false });
    }
    const p = W(doorX, d / 2);
    b.boxCollider(p.x, fy + 1, p.z, 0.5, 1, 0.15, ry);
  } else {
    addDoor(ctx, { id: o.id + 'Door', x: hinge.x, y: fy, z: hinge.z, ry, w: 0.95, h: 1.93, mat: 'planksGrey', dir: -1, label: 'дверь дома' });
  }
  ctx.indoors.push({ name: o.id, min: new THREE.Vector3(cx - Math.max(w, d) / 2, 0, cz - Math.max(w, d) / 2), max: new THREE.Vector3(cx + Math.max(w, d) / 2, fy + h, cz + Math.max(w, d) / 2), closed: o.broken === false ? 1 : 0.8 });
  return { W, fy, h };
}

/** Place a kit in house-local coordinates. */
function furnish(ctx: WorldCtx, hs: { W: (x: number, z: number) => { x: number; z: number }; fy: number }, ry: number, kit: { place: (x: number, y: number, z: number, r: number) => unknown }, lx: number, lz: number, lr = 0) {
  const p = hs.W(lx, lz);
  kit.place(p.x, hs.fy, p.z, ry + lr);
  void ctx;
}

/**
 * Zone 3 — Сосновка: abandoned village of five houses (three can be entered),
 * the radio relay mast with its electrical cabinet, fences and an old well.
 */
export function buildVillage(ctx: WorldCtx) {
  const { b, M } = ctx;
  b.chunk = 'village';
  const root = ctx.root;

  // ---- House 1 (north side): the diarist's house — screwdriver, key, diary
  {
    const ry = Math.PI;
    const hs = house(ctx, -40, -108.5, ry, { id: 'h1', w: 6.5, d: 5.2, door: 1.2, enter: true, partition: -1.0, broken: true });
    const k = (kit: Parameters<typeof furnish>[3], lx: number, lz: number, lr = 0) => {
      furnish(ctx, hs, ry, kit, lx, lz, lr);
      bake(b, kit as never);
    };
    k(P.stove(M), -2.2, -1.4, 0);
    k(P.table(M, 1.1, 0.7), 1.6, -1.3, 0);
    k(P.chair(M), 1.6, -0.6, Math.PI);
    k(P.bed(M), -2.5, 1.0, Math.PI / 2);
    k(P.shelf(M, 41, 1.0, 1.6, 0.3), 2.85, 0.6, -Math.PI / 2);
    const t = hs.W(1.6, -1.3);
    docAt(ctx, 'doc_diary', 'diary', 31, 'doc', t.x, hs.fy + 0.765, t.z, undefined, 0.4);
    const sd = itemMesh(ctx, 'screwdriver');
    const sp = hs.W(2.85, 0.4);
    sd.position.set(sp.x, hs.fy + 0.63, sp.z);
    pickup(ctx, 'pk_screwdriver', 'screwdriver', sd);
    const kp = hs.W(1.3, -1.1);
    const key = itemMesh(ctx, 'fusebox_key');
    key.position.set(kp.x, hs.fy + 0.77, kp.z);
    pickup(ctx, 'pk_fusebox_key', 'fusebox_key', key);
    const ph = hs.W(0.4, -2.45);
    docAt(ctx, 'doc_photo1', 'photoFamily', 32, 'photo', ph.x, hs.fy + 1.6, ph.z, ry);
    propMesh(ctx, 'pot', hs.W(-2.2, -1.4).x, hs.fy + 1.4, hs.W(-2.2, -1.4).z);
    propMesh(ctx, 'bucket', hs.W(-1.5, 1.8).x, hs.fy, hs.W(-1.5, 1.8).z);
    propMesh(ctx, 'stool', hs.W(0.4, 1.2).x, hs.fy, hs.W(0.4, 1.2).z);
    const ic = hs.W(-3.0, -2.3);
    const icon = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.28), new THREE.MeshLambertMaterial({ color: 0x5a4220 }));
    icon.position.set(ic.x, hs.fy + 1.9, ic.z);
    icon.rotation.y = ry + Math.PI / 4;
    root.add(icon);
  }

  // ---- House 2 (north-west): boarded — the window silhouette appears here
  {
    const ry = Math.PI;
    const hs = house(ctx, -56, -108, ry, { id: 'h2', w: 6, d: 5, door: 0, boarded: true, broken: false });
    const win = hs.W(0, 2.5);
    const s = new THREE.Object3D();
    s.position.set(win.x, hs.fy + 1.3, win.z + 0.6);
    root.add(s);
    ctx.spots.h2Window = s;
    // dim candle-like glow inside, visible through the dirty glass
    const p = hs.W(0, 0.5);
    addLamp(ctx, 'h2Candle', new THREE.Vector3(p.x, hs.fy + 1, p.z), { power: 'village', intensity: 0.0, range: 5, color: 0xff9a4a, flicker: 0.8, glowSize: 0, on: false });
  }

  // ---- House 3 (south side): the radio house — receiver, pass card, photos
  {
    const ry = 0;
    const hs = house(ctx, -45, -129, ry, { id: 'h3', w: 7, d: 5.4, door: -1.6, enter: true, partition: 1.2, broken: true });
    const k = (kit: Parameters<typeof furnish>[3], lx: number, lz: number, lr = 0) => {
      furnish(ctx, hs, ry, kit, lx, lz, lr);
      bake(b, kit as never);
    };
    k(P.table(M, 1.3, 0.75), -1.4, -1.6, 0);
    k(P.chair(M), -1.4, -0.9, Math.PI);
    k(P.wardrobeBody(M), 2.6, -2.2, 0);
    k(P.bed(M), 2.6, 0.9, -Math.PI / 2);
    k(P.shelf(M, 43, 1.2, 1.8, 0.3), -3.3, 0.6, Math.PI / 2);
    const rp = hs.W(-1.7, -1.75);
    const radio = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.22), M.planksDark);
    body.position.y = 0.13;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.14), new THREE.MeshLambertMaterial({ color: 0xc9b98f }));
    face.position.set(-0.05, 0.15, 0.111);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10), M.black);
    dial.rotation.x = Math.PI / 2;
    dial.position.set(0.16, 0.12, 0.12);
    radio.add(body, face, dial);
    radio.position.set(rp.x, hs.fy + 0.76, rp.z);
    root.add(radio);
    ctx.spots.villageRadio = radio;
    const pc = hs.W(-0.95, -1.5);
    const pass = itemMesh(ctx, 'pass');
    pass.position.set(pc.x, hs.fy + 0.765, pc.z);
    pass.rotation.y = 0.3;
    pickup(ctx, 'pk_pass', 'pass', pass);
    const ph = hs.W(-0.8, -2.55);
    docAt(ctx, 'doc_photo2', 'photoGuards', 33, 'photo', ph.x, hs.fy + 1.5, ph.z, 0);
    const lt = hs.W(2.6, 0.9);
    docAt(ctx, 'doc_letter', 'letter', 34, 'note', lt.x, hs.fy + 0.65, lt.z, undefined, 1.0);
    const fl = hs.W(-3.3, 0.3);
    const flare = itemMesh(ctx, 'flare');
    flare.position.set(fl.x, hs.fy + 0.7, fl.z);
    pickup(ctx, 'pk_flare_village', 'flare', flare, 2);
    propMesh(ctx, 'bottle', hs.W(0.2, 1.8).x, hs.fy, hs.W(0.2, 1.8).z);
    propMesh(ctx, 'jar', hs.W(-1.0, -1.7).x, hs.fy + 0.76, hs.W(-1.0, -1.7).z);
    propMesh(ctx, 'book', hs.W(-3.3, 0.9).x, hs.fy + 1.3, hs.W(-3.3, 0.9).z);
    propMesh(ctx, 'stool', hs.W(0.4, -1.4).x, hs.fy, hs.W(0.4, -1.4).z);
    // something moves things around in this room (anomaly anchor)
    const ch = hs.W(-1.4, -0.9);
    const marker = new THREE.Object3D();
    marker.position.set(ch.x, hs.fy, ch.z);
    root.add(marker);
    ctx.spots.h3Chair = marker;
  }

  // ---- House 4: collapsed ruin
  house(ctx, -61, -129.5, 0.1, { id: 'h4', w: 6, d: 5, collapsed: true });
  bake(b, P.woodPile(M, 44).place(-58, 0, -133.5, 0.3));

  // ---- House 5 (banya), enterable, far west — medkit
  {
    const ry = Math.PI / 2;
    const hs = house(ctx, -69, -110, ry, { id: 'h5', w: 4, d: 3.6, door: 0.6, enter: true, h: 2.2, broken: true });
    const p = hs.W(-0.8, -0.9);
    bake(b, P.table(M, 1.6, 0.5, 0.45, 'planksGrey').place(p.x, hs.fy, p.z, ry));
    const m = itemMesh(ctx, 'medkit');
    m.position.set(p.x, hs.fy + 0.46, p.z);
    pickup(ctx, 'pk_medkit_banya', 'medkit', m);
  }

  // ---- fences between yards (leaning picket fence)
  const picket = (x1: number, z1: number, x2: number, z2: number) => {
    const L = Math.hypot(x2 - x1, z2 - z1);
    const ry = -Math.atan2(z2 - z1, x2 - x1);
    const n = Math.floor(L / 0.18);
    for (let i = 0; i < n; i++) {
      if ((i * 7) % 11 === 0) continue; // missing pickets
      const t = i / n;
      const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
      b.box('planksGrey', x, 0.6, z, 0.09, 1.1 + ((i * 13) % 5) * 0.03, 0.025, { ry: ry + 0.05, collide: false });
    }
    b.box('planksGrey', (x1 + x2) / 2, 0.85, (z1 + z2) / 2, L, 0.07, 0.03, { ry, collide: false });
    b.boxCollider((x1 + x2) / 2, 0.6, (z1 + z2) / 2, L / 2, 0.6, 0.08, ry);
  };
  picket(-31, -104, -36, -104);
  picket(-44, -104, -51, -104);
  picket(-50, -133.5, -40, -133.5);
  picket(-35, -132, -35, -125);
  picket(-63, -104, -66, -114);

  // ---- well
  {
    const x = -50, z = -125;
    b.geo('logs', new THREE.CylinderGeometry(0.7, 0.7, 0.8, 10, 1, true), x, 0.4, z);
    b.cylinderCollider(x, 0.4, z, 0.72, 0.4);
    b.box('planksDark', x - 0.6, 1.1, z, 0.1, 1.4, 0.1);
    b.box('planksDark', x + 0.6, 1.1, z, 0.1, 1.4, 0.1);
    b.geo('planksDark', new THREE.CylinderGeometry(0.08, 0.08, 1.3, 8), x, 1.6, z, 0, 0, Math.PI / 2);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.65, 16), M.water);
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, 0.05, z);
    root.add(water);
    ctx.spots.well = water;
  }

  // ---- radio relay: lattice mast + electrical cabinet behind a fence
  {
    const x = -32, z = -126;
    b.box('concrete', x, 0.08, z, 4, 0.16, 4, { surface: 'concrete' });
    const H = 18;
    for (const [px, pz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) b.box('metalGrey', x + px * 0.6, H / 2, z - 1 + pz * 0.6, 0.06, H, 0.06, { collide: false });
    for (let y = 1; y < H; y += 1.2) {
      b.box('metalGrey', x, y, z - 1 - 0.36, 0.72, 0.03, 0.03, { collide: false });
      b.box('metalGrey', x, y + 0.6, z - 1 + 0.36, 0.72, 0.03, 0.03, { collide: false });
    }
    b.boxCollider(x, H / 2, z - 1, 0.4, H / 2, 0.4);
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), M.bulbOff);
    red.position.set(x, H + 0.2, z - 1);
    root.add(red);
    addLamp(ctx, 'relayBeacon', red.position.clone(), { bulb: red, power: 'village', intensity: 5, range: 20, color: 0xff2a1a, flicker: 0, glowSize: 3, on: false });
    const cab = P.electricPanel(M, 0.9, 1.4).place(x + 1.2, 0.16, z + 0.6, Math.PI);
    root.add(cab.g);
    b.boxCollider(x + 1.2, 0.86, z + 0.6, 0.45, 0.7, 0.1);
    ctx.spots.relayBox = cab.g;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), new THREE.MeshLambertMaterial({ map: labelTex(['РРС-4', 'ОПАСНО'], 256, 100, '#ffd400', '#111', 'bold 36px sans-serif') }));
    sign.position.set(x + 1.2, 1.3, z + 0.49);
    sign.rotation.y = Math.PI;
    root.add(sign);
    // chain-link around it, open on the road side
    for (const [ax, az, bx, bz] of [[x - 2, z - 2.2, x + 2, z - 2.2], [x - 2, z - 2.2, x - 2, z + 2], [x + 2, z - 2.2, x + 2, z - 0.4]] as const) {
      const L = Math.hypot(bx - ax, bz - az);
      const ry = -Math.atan2(bz - az, bx - ax);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(L, 2), M.chainlink);
      const uv = pane.geometry.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L * 4, uv.getY(i) * 8);
      pane.position.set((ax + bx) / 2, 1.0, (az + bz) / 2);
      pane.rotation.y = ry;
      root.add(pane);
      b.boxCollider((ax + bx) / 2, 1, (az + bz) / 2, L / 2, 1, 0.05, ry);
    }
  }
  ctx.spots.villageCenter = new THREE.Object3D();
  ctx.spots.villageCenter.position.set(-46, 0, -119);
  root.add(ctx.spots.villageCenter);
}
