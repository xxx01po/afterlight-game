import * as THREE from 'three';
import type { WorldCtx } from './ctx';
import { addDoor, addLamp, ceilingBulb, docAt, itemMesh, pickup, propMesh, windowFrame } from './helpers';
import { bake } from './kit';
import * as P from './props';
import type { MatName } from './materials';
import { labelTex } from './textures';
import { rng } from '@/utils/math';

/**
 * Zone 4 — НИИ «Кедр-7»: single-storey concrete research block.
 * South: records, security vestibule (entrance), electrical room.
 * Corridor. North: Lab 1, observation Lab 2, server room, containment cell.
 */
export function buildComplex(ctx: WorldCtx) {
  const { b, M } = ctx;
  b.chunk = 'complex';
  const root = ctx.root;
  const X0 = 26, X1 = 54, Z0 = -174, Z1 = -150, H = 3.2, y0 = 0.15, T = 0.3;
  const R = rng(7);

  b.box('concrete', (X0 + X1) / 2, y0 / 2, (Z0 + Z1) / 2, X1 - X0 + 0.4, y0, Z1 - Z0 + 0.4, { surface: 'tile' });
  b.box('tilesLab', (X0 + X1) / 2, y0 + 0.005, (Z0 + Z1) / 2, X1 - X0 - 0.4, 0.01, Z1 - Z0 - 0.4, { collide: false });
  b.box('concreteDark', (X0 + X1) / 2, y0 + H + 0.2, (Z0 + Z1) / 2, X1 - X0 + 0.8, 0.4, Z1 - Z0 + 0.8);
  b.box('panel', (X0 + X1) / 2, y0 + H - 0.01, (Z0 + Z1) / 2, X1 - X0 - 0.6, 0.02, Z1 - Z0 - 0.6, { collide: false });

  // exterior walls
  b.wall('panel', X0, Z1, X1, Z1, y0, H, T, [{ at: 12, w: 1.3, h: 2.2 }, { at: 4, w: 1.6, h: 1.0, sill: 1.2 }, { at: 22, w: 1.6, h: 1.0, sill: 1.2 }]);
  b.wall('panel', X0, Z0, X1, Z0, y0, H, T);
  b.wall('panel', X0, Z0, X0, Z1, y0, H, T, [{ at: 8, w: 1.6, h: 1.0, sill: 1.2 }]);
  b.wall('panel', X1, Z0, X1, Z1, y0, H, T);
  windowFrame(ctx, X0 + 4, y0 + 1.7, Z1, 1.6, 1.0, 0, true, 'metalGrey');
  windowFrame(ctx, X0 + 22, y0 + 1.7, Z1, 1.6, 1.0, 0, true, 'metalGrey');
  windowFrame(ctx, X0, y0 + 1.7, Z0 + 8, 1.6, 1.0, Math.PI / 2, true, 'metalGrey');
  // bars on the windows
  for (const xw of [X0 + 4, X0 + 22]) for (let i = 0; i < 6; i++) b.box('metalRust', xw - 0.7 + i * 0.28, y0 + 1.7, Z1 + 0.2, 0.025, 1.0, 0.025, { collide: false });

  const inner = (x1: number, z1: number, x2: number, z2: number, ops: { at: number; w: number; h: number; sill?: number }[] = [], mat: MatName = 'wallLab') => b.wall(mat, x1, z1, x2, z2, y0, H, 0.16, ops);
  // corridor walls
  inner(X0, -155, X1, -155, [{ at: 4, w: 1.0, h: 2.1 }, { at: 12, w: 1.6, h: 2.3 }, { at: 22, w: 1.0, h: 2.1 }], 'wallBlue');
  inner(X0, -158, X1, -158, [{ at: 5.5, w: 1.0, h: 2.1 }, { at: 15, w: 1.0, h: 2.1 }, { at: 23.5, w: 1.0, h: 2.1 }], 'wallBlue');
  // south rooms partitions
  inner(34, -155, 34, Z1);
  inner(42, -155, 42, Z1);
  // north partitions
  inner(37, Z0, 37, -158);
  inner(45, Z0, 45, -158, [{ at: 6, w: 2.4, h: 1.1, sill: 1.0 }]); // observation window into the cell (z −168)
  inner(45, -165, X1, -165, [{ at: 4.5, w: 1.2, h: 2.2 }], 'concreteDark'); // cell wall with heavy door

  // doors
  addDoor(ctx, { id: 'cxEntrance', x: 38 - 0.65, y: y0, z: Z1, ry: 0, w: 1.3, h: 2.2, mat: 'metalGrey', dir: -1, locked: true, keyId: 'pass', heavy: true, label: 'вход «Кедр-7»' });
  addDoor(ctx, { id: 'cxRecords', x: 30 - 0.5, y: y0, z: -155, ry: 0, w: 1.0, h: 2.08, mat: 'metalWhite', dir: -1, label: 'канцелярия' });
  addDoor(ctx, { id: 'cxElectric', x: 48 - 0.5, y: y0, z: -155, ry: 0, w: 1.0, h: 2.08, mat: 'metalGrey', dir: -1, locked: true, keyId: 'fusebox_key', label: 'щитовая', heavy: true });
  addDoor(ctx, { id: 'cxLab1', x: 31.5 - 0.5, y: y0, z: -158, ry: 0, w: 1.0, h: 2.08, mat: 'metalWhite', dir: 1, label: 'лаборатория 1' });
  addDoor(ctx, { id: 'cxLab2', x: 41 - 0.5, y: y0, z: -158, ry: 0, w: 1.0, h: 2.08, mat: 'metalWhite', dir: 1, label: 'лаборатория 2' });
  addDoor(ctx, { id: 'cxServer', x: 49.5 - 0.5, y: y0, z: -158, ry: 0, w: 1.0, h: 2.08, mat: 'metalWhite', dir: 1, label: 'аппаратная' });
  addDoor(ctx, { id: 'cxCell', x: 49.5 - 0.6, y: y0, z: -165, ry: 0, w: 1.2, h: 2.18, t: 0.12, mat: 'metalRust', dir: 1, locked: true, keyId: '__never', heavy: true, label: 'камера содержания' });
  const sign = (txt: string[], x: number, z: number, ry = 0, w = 0.5) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.18), new THREE.MeshLambertMaterial({ map: labelTex(txt, 320, 110, '#101010', '#d9d6cc', 'bold 40px sans-serif') }));
    m.position.set(x, y0 + 2.35, z);
    m.rotation.y = ry;
    root.add(m);
  };
  sign(['ЛАБ. 1'], 31.5, -158.09, Math.PI);
  sign(['ЛАБ. 2 · НАБЛЮДЕНИЕ'], 41, -158.09, Math.PI, 0.8);
  sign(['АППАРАТНАЯ'], 49.5, -158.09, Math.PI);
  sign(['КАНЦЕЛЯРИЯ'], 30, -155.09, 0);
  sign(['ЩИТОВАЯ'], 48, -155.09, 0);
  sign(['ОБЪЕКТ «СМЕНА»', 'НЕ ОТКРЫВАТЬ'], 49.5, -165.09, Math.PI, 0.7);
  const front = P.signBoard(M, labelTex(['НИИ «КЕДР-7»', 'Филиал 3 · Режимный объект'], 640, 220, '#e6e1d3', '#253042', 'bold 58px sans-serif'), 2.6, 0.9, 0);
  front.place(38, y0 + H - 0.5, Z1 + 0.17, 0);
  root.add(front.g);
  // pass reader next to the entrance
  const reader = new THREE.Group();
  const rb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.05), M.black);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.01), M.redLed);
  led.position.set(0, 0.06, 0.026);
  led.name = 'led';
  reader.add(rb, led);
  reader.position.set(39.1, y0 + 1.25, Z1 + 0.18);
  root.add(reader);
  ctx.spots.passReader = reader;

  // ---- vestibule / security post
  bake(b, P.table(M, 1.6, 0.7, 0.8, 'metalWhite').place(35.2, y0, -152.2, Math.PI / 2));
  bake(b, P.chair(M, 'metalGrey').place(36.0, y0, -152.2, -Math.PI / 2));
  const cm = P.crtMonitor(M).place(35.1, y0 + 0.8, -152.6, Math.PI / 2);
  bake(b, cm, { collide: false });
  const cxScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.27), M.screenOff);
  cxScreen.position.set(35.1 + 0.151, y0 + 0.99, -152.6);
  cxScreen.rotation.y = Math.PI / 2;
  root.add(cxScreen);
  ctx.spots.cxScreen = cxScreen;
  bake(b, P.locker(M).place(41.5, y0, -153.4, -Math.PI / 2));
  const fg = itemMesh(ctx, 'flaregun');
  fg.position.set(35.3, y0 + 0.81, -151.7);
  fg.rotation.y = 0.6;
  pickup(ctx, 'pk_flaregun', 'flaregun', fg);
  const fl = itemMesh(ctx, 'flare');
  fl.position.set(35.1, y0 + 0.81, -151.35);
  pickup(ctx, 'pk_flare_cx', 'flare', fl, 3);
  // turnstile
  b.box('metalGrey', 38, y0 + 0.5, -153.5, 0.3, 1.0, 0.6);
  docAt(ctx, 'doc_cx_rota', 'rota', 51, 'doc', 35.0, y0 + 0.805, -151.9, undefined, 1.2);

  // ---- records office
  for (let i = 0; i < 3; i++) bake(b, P.shelf(M, 60 + i, 1.2, 2.2, 0.45, 'metalGrey').place(26.6, y0, -151.1 - i * 1.3, Math.PI / 2));
  bake(b, P.table(M, 1.4, 0.7).place(31.5, y0, -152.4, 0));
  bake(b, P.chair(M).place(31.5, y0, -151.6, Math.PI));
  docAt(ctx, 'doc_personnel', 'personnelFile', 52, 'doc', 31.3, y0 + 0.765, -152.5, undefined, -0.2);
  for (let i = 0; i < 9; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), M.paper);
    p.rotation.set(-Math.PI / 2, 0, R() * 6);
    p.position.set(28 + R() * 5, y0 + 0.012, -151 - R() * 3.5);
    root.add(p);
  }
  propMesh(ctx, 'box', 32.8, y0, -151, 0.3);
  propMesh(ctx, 'book', 31.9, y0 + 0.76, -152.2);

  // ---- electrical room
  for (let i = 0; i < 4; i++) bake(b, P.electricPanel(M, 0.8, 1.9).place(43.4 + i * 1.0, y0, -150.45, Math.PI));
  const breakers = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), new THREE.MeshLambertMaterial({ color: 0x8a1a12 }));
    lever.position.set(-0.25 + i * 0.25, 0, 0);
    lever.rotation.x = 0.6;
    lever.name = 'lever' + i;
    breakers.add(lever);
  }
  const bplate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.05), M.metalGrey);
  bplate.position.z = -0.04;
  breakers.add(bplate);
  breakers.position.set(51.5, y0 + 1.35, -150.45);
  breakers.rotation.y = Math.PI;
  root.add(breakers);
  ctx.spots.breakers = breakers;
  ceilingBulb(ctx, 'cxElectricBulb', 48, y0 + H, -152.5, { power: 'emergency', intensity: 2, color: 0xff3a2a, flicker: 0.2 });

  // ---- corridor lights (fluorescent), emergency lights
  for (let i = 0; i < 4; i++) ceilingBulb(ctx, 'cxCorr' + i, 29 + i * 7.5, y0 + H, -156.5, { power: 'complex', intensity: 4, flicker: i === 2 ? 0.5 : 0.08, range: 9 }, true);
  for (const [x, z] of [[36, -156.5], [50, -156.5], [38, -152]] as const) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.1), M.bulbOff);
    m.position.set(x, y0 + H - 0.2, z);
    root.add(m);
    addLamp(ctx, 'cxEmerg' + x, new THREE.Vector3(x, y0 + H - 0.35, z), { bulb: m, power: 'emergency', intensity: 1.6, range: 7, color: 0xff2210, flicker: 0.1, glowSize: 0.8 });
  }
  ctx.spots.corridor = new THREE.Object3D();
  ctx.spots.corridor.position.set(40, y0, -156.5);
  root.add(ctx.spots.corridor);

  // ---- Lab 1
  bake(b, P.labTable(M, 2.2).place(30, y0, -162, 0));
  bake(b, P.labTable(M, 2.2).place(30, y0, -166, 0));
  bake(b, P.metalCabinet(M).place(27.0, y0, -169, Math.PI / 2));
  bake(b, P.metalCabinet(M).place(27.0, y0, -170, Math.PI / 2));
  bake(b, P.gurney(M).place(34.5, y0, -168, 0.2));
  bake(b, P.cage(M, 2.0, 2.0, 1.6).place(33, y0, -172.6, 0), { collide: true });
  for (let i = 0; i < 6; i++) propMesh(ctx, i % 2 ? 'jar' : 'bottle', 29.2 + i * 0.3, y0 + 0.94, -162 + (R() - 0.5) * 0.4);
  docAt(ctx, 'doc_lab_report', 'labReport', 53, 'doc', 30.6, y0 + 0.945, -166, undefined, 0.3);
  ceilingBulb(ctx, 'cxLab1a', 31, y0 + H, -163, { power: 'complex', intensity: 3.5 }, true);
  ceilingBulb(ctx, 'cxLab1b', 31, y0 + H, -169, { power: 'complex', intensity: 3.5, flicker: 0.3 }, true);
  const med = itemMesh(ctx, 'medkit');
  med.position.set(30.7, y0 + 0.945, -161.8);
  pickup(ctx, 'pk_medkit_lab', 'medkit', med);

  // ---- Lab 2 (observation)
  bake(b, P.restraintChair(M).place(41, y0, -168.5, 0));
  bake(b, P.table(M, 2.0, 0.7, 0.78, 'metalWhite').place(43.8, y0, -162, -Math.PI / 2));
  const m2 = P.crtMonitor(M).place(44.1, y0 + 0.78, -161.6, -Math.PI / 2);
  bake(b, m2, { collide: false });
  const labScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.27), M.screenOff);
  labScreen.position.set(44.1 - 0.151, y0 + 0.97, -161.6);
  labScreen.rotation.y = -Math.PI / 2;
  root.add(labScreen);
  ctx.spots.labScreen = labScreen;
  docAt(ctx, 'doc_journal', 'shiftJournal', 54, 'doc', 43.7, y0 + 0.785, -162.6, undefined, -1.3);
  windowFrame(ctx, 45, y0 + 1.55, -168, 2.4, 1.1, Math.PI / 2, false, 'metalGrey');
  ceilingBulb(ctx, 'cxLab2', 41, y0 + H, -164, { power: 'complex', intensity: 3.5, flicker: 0.15 }, true);
  ctx.spots.lab2 = new THREE.Object3D();
  ctx.spots.lab2.position.set(41, y0, -163);
  root.add(ctx.spots.lab2);
  // hanging cables and an overturned chair
  bake(b, P.chair(M, 'metalGrey').place(39.0, y0, -161.5, 1.2));

  // ---- server room
  for (let i = 0; i < 4; i++) {
    const k = P.metalCabinet(M, 0.7, 2.0).place(46.5 + i * 1.6, y0, -159.0, Math.PI);
    bake(b, k);
    const ledM = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), i % 2 ? M.greenLed : M.redLed);
    ledM.position.set(46.5 + i * 1.6 + 0.2, y0 + 1.6, -159.0 - 0.23);
    root.add(ledM);
  }
  ceilingBulb(ctx, 'cxServer', 49.5, y0 + H, -161.5, { power: 'complex', intensity: 3 }, true);
  const bat = itemMesh(ctx, 'battery');
  bat.position.set(52.8, y0, -163.8);
  pickup(ctx, 'pk_battery_cx', 'battery', bat);

  // ---- containment cell (dark, scratched; the creature's lair)
  for (let i = 0; i < 40; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.4 + R() * 0.6), M.black);
    const side = R() < 0.5;
    s.position.set(side ? 53.82 : 46 + R() * 7, y0 + 0.6 + R() * 1.6, side ? -166 - R() * 7.5 : -173.82);
    s.rotation.set(0, side ? -Math.PI / 2 : 0, (R() - 0.5) * 0.5);
    root.add(s);
  }
  b.box('metalRust', 52, y0 + 0.02, -171, 1.4, 0.04, 1.4, { collide: false });
  ctx.spots.cell = new THREE.Object3D();
  ctx.spots.cell.position.set(49.5, y0, -170);
  root.add(ctx.spots.cell);
  ctx.indoors.push({ name: 'complex', min: new THREE.Vector3(X0, 0, Z0), max: new THREE.Vector3(X1, y0 + H, Z1), closed: 1 });

  // ---- exterior: fence, gate, dead floodlights, a car
  const fx0 = 22, fx1 = 58, fz0 = -178, fz1 = -146;
  const fenceSeg = (x1: number, z1: number, x2: number, z2: number) => {
    const L = Math.hypot(x2 - x1, z2 - z1);
    const ry = -Math.atan2(z2 - z1, x2 - x1);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(L, 2.4), M.chainlink);
    const uv = pane.geometry.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L * 4, uv.getY(i) * 9.6);
    pane.position.set((x1 + x2) / 2, 1.2, (z1 + z2) / 2);
    pane.rotation.y = ry;
    root.add(pane);
    b.boxCollider((x1 + x2) / 2, 1.2, (z1 + z2) / 2, L / 2, 1.2, 0.05, ry);
    const n = Math.ceil(L / 3);
    for (let i = 0; i <= n; i++) b.box('metalGrey', x1 + ((x2 - x1) * i) / n, 1.3, z1 + ((z2 - z1) * i) / n, 0.08, 2.6, 0.08, { collide: false });
  };
  fenceSeg(fx0, fz1, 35, fz1);
  fenceSeg(41, fz1, fx1, fz1);
  fenceSeg(fx1, fz1, fx1, fz0);
  fenceSeg(fx0, fz0, fx1, fz0);
  fenceSeg(fx0, fz0, fx0, fz1);
  // gate leaf torn off, lying on the ground
  b.box('metalGrey', 37, 0.06, -143.5, 3.2, 0.06, 2.2, { ry: 0.3, collide: false });
  for (const [x, z] of [[24, -148], [56, -148]] as const) {
    b.box('metalGrey', x, 3.5, z, 0.14, 7, 0.14);
    b.box('metalGrey', x, 7, z, 0.6, 0.3, 0.4, { collide: false });
  }
  bake(b, P.van(M, 21, true).place(30, 0, -144, 1.4));
  bake(b, P.barrel(M).place(52.5, 0, -147.5, 0));
  bake(b, P.crate(M, 0.9).place(55.5, 0, -160, 0.3));
  propMesh(ctx, 'bucket', 53, 0, -148);
  ctx.spots.complexDoor = new THREE.Object3D();
  ctx.spots.complexDoor.position.set(38, y0, Z1 + 1.2);
  root.add(ctx.spots.complexDoor);
  ctx.cams.push({ id: 'cxCam', label: 'КЕДР · КОРИДОР', pos: new THREE.Vector3(27, y0 + 2.9, -156.5), look: new THREE.Vector3(45, 1, -156.5) });
}
