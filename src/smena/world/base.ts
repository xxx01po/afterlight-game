import * as THREE from 'three';
import type { WorldCtx } from './ctx';
import { addDoor, addLamp, ceilingBulb, docAt, itemMesh, pickup, propMesh, windowFrame } from './helpers';
import { bake } from './kit';
import * as P from './props';
import { labelTex } from './textures';

/**
 * Zone 1 — «Объект 17»: guarded compound. Gate booth (spawn), guard building
 * (CCTV, radio, key board, rest room, locked archive), generator shed, storage,
 * chain-link fence with the locked south gate and the north gate to the forest.
 */
export function buildBase(ctx: WorldCtx) {
  const { b, M } = ctx;
  b.chunk = 'base';
  const root = ctx.root;

  // --- yard surface
  b.box('gravel', 0, 0.01, 0, 44, 0.02, 36, { collide: false });
  b.box('asphalt', 0, 0.015, 14, 7, 0.02, 9, { collide: false });

  // --- fence (chain-link panels between concrete posts), 2.5 m + barbed wire
  const fence = (x1: number, z1: number, x2: number, z2: number, gaps: [number, number][] = []) => {
    const L = Math.hypot(x2 - x1, z2 - z1);
    const ux = (x2 - x1) / L, uz = (z2 - z1) / L;
    const ry = -Math.atan2(z2 - z1, x2 - x1);
    const n = Math.ceil(L / 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * L, c = ((i + 1) / n) * L;
      const mid = (a + c) / 2;
      if (gaps.some(([g0, g1]) => mid > g0 && mid < g1)) continue;
      const px = x1 + ux * mid, pz = z1 + uz * mid;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(c - a, 2.3), M.chainlink);
      (pane.material as THREE.Material).side = THREE.DoubleSide;
      const tex = M.chainlink.map!;
      tex.repeat.set(1, 1);
      pane.geometry.attributes.uv.array.forEach((_, k, arr) => ((arr as Float32Array)[k] = k % 2 === 0 ? (arr as Float32Array)[k] * ((c - a) / 0.25) : (arr as Float32Array)[k] * (2.3 / 0.25)));
      pane.position.set(px, 1.25, pz);
      pane.rotation.y = ry;
      root.add(pane);
      b.boxCollider(px, 1.3, pz, (c - a) / 2, 1.3, 0.05, ry);
      // wire on top
      b.box('metalGrey', px, 2.45, pz, c - a, 0.02, 0.02, { ry, collide: false });
      b.box('metalGrey', px, 2.6, pz, c - a, 0.02, 0.02, { ry, collide: false });
    }
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * L;
      b.box('concreteDark', x1 + ux * a, 1.35, z1 + uz * a, 0.16, 2.7, 0.16, { ry });
    }
  };
  fence(-22, 18, 22, 18, [[18.5, 25.5]]); // south with gate gap (x −3.5..3.5)
  fence(22, 18, 22, -18);
  fence(22, -18, -22, -18, [[19, 25]]); // north with gate gap (x −3..3)
  fence(-22, -18, -22, 18);

  // --- south gate: closed steel gates + barrier, collider blocks the exit
  for (const sx of [-1, 1]) b.box('metalGreen', sx * 1.75, 1.2, 18, 3.4, 2.2, 0.08, { collide: false });
  b.boxCollider(0, 1.5, 18, 3.6, 1.5, 0.15);
  const bar = P.barrier(M).place(-3.2, 0, 20.5, 0);
  bake(b, bar, { collide: false });
  const gateSign = P.signBoard(M, labelTex(['ОБЪЕКТ 17', 'ПРОПУСКНОЙ РЕЖИМ'], 512, 192, '#d9d4c4', '#6d1e18', 'bold 56px sans-serif'), 1.6, 0.6, 0);
  gateSign.place(0, 2.3, 18.08, 0);
  root.add(gateSign.g);
  ctx.spots.southGate = new THREE.Object3D();
  ctx.spots.southGate.position.set(0, 1.2, 17.7);
  root.add(ctx.spots.southGate);

  // --- north gate (two heavy leaves, locked at the start)
  addDoor(ctx, { id: 'northGateL', x: -3, y: 0, z: -18, ry: 0, w: 3, h: 2.3, t: 0.06, mat: 'metalGreen', dir: 1, openAngle: 1.4, locked: true, heavy: true, label: 'северные ворота' });
  addDoor(ctx, { id: 'northGateR', x: 3, y: 0, z: -18, ry: Math.PI, w: 3, h: 2.3, t: 0.06, mat: 'metalGreen', dir: -1, openAngle: 1.4, locked: true, heavy: true, label: 'северные ворота' });
  ctx.spots.northGate = new THREE.Object3D();
  ctx.spots.northGate.position.set(0, 1.2, -17.6);
  root.add(ctx.spots.northGate);

  // --- gate booth (КПП) — spawn point
  {
    const x0 = 4.3, x1 = 7.1, z0 = 13.2, z1 = 16.0, h = 2.5;
    b.box('linoleum', (x0 + x1) / 2, 0.04, (z0 + z1) / 2, x1 - x0, 0.08, z1 - z0, { surface: 'linoleum' });
    b.box('concreteDark', (x0 + x1) / 2, h + 0.1, (z0 + z1) / 2, x1 - x0 + 0.8, 0.14, z1 - z0 + 0.8, {});
    const wm = 'panel' as const;
    b.wall(wm, x0, z0, x0, z1, 0.1, h, 0.15, [{ at: 1.4, w: 0.85, h: 2.0 }]); // west wall with door
    b.wall(wm, x1, z0, x1, z1, 0.1, h, 0.15, [{ at: 1.4, w: 1.6, h: 0.9, sill: 0.95 }]);
    b.wall(wm, x0, z0, x1, z0, 0.1, h, 0.15, [{ at: 1.4, w: 1.6, h: 0.9, sill: 0.95 }]);
    b.wall(wm, x0, z1, x1, z1, 0.1, h, 0.15, [{ at: 1.4, w: 1.6, h: 0.9, sill: 0.95 }]);
    windowFrame(ctx, x1, 1.5, 14.6, 1.6, 0.9, Math.PI / 2, false, 'metalWhite');
    windowFrame(ctx, 5.7, 1.5, z0, 1.6, 0.9, 0, false, 'metalWhite');
    windowFrame(ctx, 5.7, 1.5, z1, 1.6, 0.9, 0, false, 'metalWhite');
    addDoor(ctx, { id: 'boothDoor', x: x0, y: 0.1, z: 14.6 + 0.42, ry: Math.PI / 2, w: 0.84, h: 2.0, mat: 'metalBlue', dir: -1, label: 'дверь будки' });
    const desk = P.table(M, 1.4, 0.6, 0.78, 'planksDark').place(6.6, 0.1, 14.6, Math.PI / 2);
    bake(b, desk);
    bake(b, P.chair(M).place(5.9, 0.1, 14.5, -Math.PI / 2));
    bake(b, P.locker(M).place(4.75, 0.1, 13.65, 0));
    const fl = itemMesh(ctx, 'flashlight');
    fl.position.set(6.55, 0.89, 14.2);
    fl.rotation.y = 0.4;
    pickup(ctx, 'pk_flashlight', 'flashlight', fl);
    const wk = itemMesh(ctx, 'walkie');
    wk.position.set(6.6, 0.89, 15.05);
    pickup(ctx, 'pk_walkie', 'walkie', wk);
    docAt(ctx, 'doc_booth_log', 'shiftLog', 11, 'doc', 6.5, 0.88, 14.65, undefined, 0.2);
    docAt(ctx, 'doc_booth_rules', 'rules', 12, 'note', x1 - 0.09, 1.55, 15.5, -Math.PI / 2);
    ceilingBulb(ctx, 'boothBulb', 5.7, h + 0.03, 14.6, { power: 'always', intensity: 2.6, flicker: 0.15 });
    ctx.indoors.push({ name: 'booth', min: new THREE.Vector3(x0, 0, z0), max: new THREE.Vector3(x1, h, z1), closed: 1 });
    // lamp over the booth door
    const lp = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.18), M.bulbOff);
    lp.position.set(x0 - 0.12, 2.35, 14.6);
    root.add(lp);
    addLamp(ctx, 'boothOutside', new THREE.Vector3(x0 - 0.4, 2.2, 14.6), { bulb: lp, intensity: 7, range: 12, flicker: 0.5, power: 'always' });
    ctx.spots.spawn = new THREE.Object3D();
    ctx.spots.spawn.position.set(2.7, 0, 14.6);
    root.add(ctx.spots.spawn);
  }

  // --- guard building
  {
    const X0 = -16, X1 = -6, Z0 = -1.5, Z1 = 5.5, H = 3, T = 0.25, y0 = 0.15;
    b.box('linoleum', (X0 + X1) / 2, 0.075, (Z0 + Z1) / 2, X1 - X0, 0.15, Z1 - Z0, { surface: 'linoleum' });
    b.box('concreteDark', (X0 + X1) / 2, y0 + H + 0.12, (Z0 + Z1) / 2, X1 - X0 + 0.6, 0.24, Z1 - Z0 + 0.6);
    b.box('roofTin', (X0 + X1) / 2, y0 + H + 0.26, (Z0 + Z1) / 2, X1 - X0 + 0.7, 0.04, Z1 - Z0 + 0.7, { collide: false });
    // outer walls (panel outside, green paint inside via thin inner skin)
    b.wall('panel', X1, Z0, X1, Z1, y0, H, T, [{ at: 2.0, w: 1.0, h: 2.1 }, { at: 5.2, w: 1.4, h: 1.1, sill: 1.0 }]);
    b.wall('panel', X0, Z0, X0, Z1, y0, H, T, [{ at: 1.8, w: 1.0, h: 1.0, sill: 1.1 }]);
    b.wall('panel', X0, Z0, X1, Z0, y0, H, T, [{ at: 7.5, w: 1.4, h: 1.1, sill: 1.0 }]);
    b.wall('panel', X0, Z1, X1, Z1, y0, H, T, [{ at: 2.5, w: 1.0, h: 1.0, sill: 1.1 }]);
    const ins = 0.14;
    b.wall('wallGreen', X1 - ins, Z0 + ins, X1 - ins, Z1 - ins, y0, H, 0.02, [{ at: 2.0 - ins, w: 1.0, h: 2.1 }, { at: 5.2 - ins, w: 1.4, h: 1.1, sill: 1.0 }]);
    b.wall('wallGreen', X0 + ins, Z0 + ins, X1 - ins, Z0 + ins, y0, H, 0.02, [{ at: 7.5 - ins, w: 1.4, h: 1.1, sill: 1.0 }]);
    b.wall('wallGreen', X0 + ins, Z1 - ins, X1 - ins, Z1 - ins, y0, H, 0.02, [{ at: 2.5 - ins, w: 1.0, h: 1.0, sill: 1.1 }]);
    b.wall('wallGreen', X0 + ins, Z0 + ins, X0 + ins, Z1 - ins, y0, H, 0.02, [{ at: 1.8 - ins, w: 1.0, h: 1.0, sill: 1.1 }]);
    b.box('panel', (X0 + X1) / 2, y0 + H - 0.01, (Z0 + Z1) / 2, X1 - X0 - 0.3, 0.02, Z1 - Z0 - 0.3, { collide: false });
    // partitions: x = −11 (main | rest+archive), z = 2.5 (rest | archive)
    b.wall('wallGreen', -11, Z0, -11, Z1, y0, H, 0.14, [{ at: 2.0, w: 0.9, h: 2.05 }, { at: 5.5, w: 0.9, h: 2.05 }]);
    b.wall('wallBlue', X0, 2.5, -11, 2.5, y0, H, 0.14);
    windowFrame(ctx, X1, y0 + 1.55, Z0 + 5.2, 1.4, 1.1, Math.PI / 2, false, 'metalWhite');
    windowFrame(ctx, X0 + 7.5, y0 + 1.55, Z0, 1.4, 1.1, 0, false, 'metalWhite');
    windowFrame(ctx, X0, y0 + 1.6, Z0 + 1.8, 1.0, 1.0, Math.PI / 2, false, 'metalWhite');
    windowFrame(ctx, X0 + 2.5, y0 + 1.6, Z1, 1.0, 1.0, 0, true, 'metalWhite');
    addDoor(ctx, { id: 'guardFront', x: X1, y: y0, z: 0.5 + 0.48, ry: Math.PI / 2, w: 0.96, h: 2.08, mat: 'metalBlue', dir: 1, label: 'дверь корпуса' });
    addDoor(ctx, { id: 'restDoor', x: -11, y: y0, z: 0.5 - 0.44, ry: -Math.PI / 2, w: 0.88, h: 2.03, dir: 1, label: 'комната отдыха' });
    addDoor(ctx, { id: 'archiveDoor', x: -11, y: y0, z: 4.0 - 0.44, ry: -Math.PI / 2, w: 0.88, h: 2.03, mat: 'metalGrey', dir: -1, locked: true, keyId: 'key_archive', label: 'архив', heavy: true });
    const archSign = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.15), new THREE.MeshLambertMaterial({ map: labelTex(['АРХИВ'], 256, 96, '#1a1a1a', '#d8d2c0', 'bold 52px sans-serif') }));
    archSign.position.set(-10.92, y0 + 2.3, 4.0);
    archSign.rotation.y = Math.PI / 2;
    root.add(archSign);

    // main room: CCTV desk on the north wall, radio, key board, kettle
    const desk = P.table(M, 2.4, 0.75, 0.78, 'planksDark').place(-8.3, y0, -0.85, 0);
    bake(b, desk);
    const mon = P.crtMonitor(M).place(-8.8, y0 + 0.78, -0.9, 0);
    bake(b, mon, { collide: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.27), M.screenOff);
    screen.position.set(-8.8, y0 + 0.78 + 0.19, -0.9 + 0.151);
    screen.name = 'cctvScreen';
    root.add(screen);
    ctx.spots.cctvScreen = screen;
    const mon2 = P.crtMonitor(M).place(-8.25, y0 + 0.78, -0.92, -0.1);
    bake(b, mon2, { collide: false });
    const screen2 = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.27), M.screenOff);
    screen2.position.copy(new THREE.Vector3(-8.25, y0 + 0.97, -0.92).add(new THREE.Vector3(Math.sin(-0.1), 0, Math.cos(-0.1)).multiplyScalar(0.151)));
    screen2.rotation.y = -0.1;
    root.add(screen2);
    ctx.spots.cctvScreen2 = screen2;
    const radio = P.radioStation(M).place(-7.5, y0 + 0.78, -0.95, -0.2);
    root.add(radio.g);
    ctx.spots.radio = radio.g;
    bake(b, P.chair(M).place(-8.5, y0, -0.1, Math.PI));
    // key board
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.03), M.planks);
    kb.position.set(-6.2, y0 + 1.5, 3.7);
    kb.rotation.y = -Math.PI / 2;
    root.add(kb);
    for (let i = 0; i < 6; i++) {
      const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 4), M.metalGrey);
      hook.rotation.z = Math.PI / 2;
      hook.position.set(-6.2 - 0.02, y0 + 1.62 - Math.floor(i / 3) * 0.2, 3.5 + (i % 3) * 0.2);
      root.add(hook);
    }
    const key = itemMesh(ctx, 'key_storage');
    key.position.set(-6.24, y0 + 1.52, 3.7);
    key.rotation.set(0, 0, -Math.PI / 2);
    key.rotation.order = 'ZYX';
    pickup(ctx, 'pk_key_storage', 'key_storage', key);
    ctx.spots.keyBoard = kb;
    bake(b, P.locker(M).place(-10.5, y0, 5.0, Math.PI));
    bake(b, P.metalCabinet(M, 0.8, 1.6).place(-9.6, y0, 5.05, Math.PI));
    bake(b, P.table(M, 0.9, 0.6, 0.76, 'planks').place(-6.65, y0, 2.0, -Math.PI / 2));
    propMesh(ctx, 'pot', -6.65, y0 + 0.76, 2.2);
    propMesh(ctx, 'jar', -6.6, y0 + 0.76, 1.7);
    propMesh(ctx, 'stool', -7.4, y0, 2.3);
    docAt(ctx, 'doc_instr', 'instructions', 13, 'doc', -7.9, y0 + 0.785, -0.7, undefined, -0.3);
    ceilingBulb(ctx, 'guardMain', -8.5, y0 + H, 2.0, { power: 'base', intensity: 4 }, true);
    // rest room: bunk, wardrobe
    bake(b, P.bed(M).place(-15.0, y0, 0.6, 0));
    bake(b, P.wardrobeBody(M).place(-12.0, y0, -1.05, 0));
    addDoor(ctx, { id: 'wardrobeRest', x: -12.45, y: y0 + 0.1, z: -0.77, ry: 0, w: 0.88, h: 1.75, t: 0.025, small: true, label: 'шкаф', dir: 1, openAngle: 1.9 });
    pickup(ctx, 'pk_medkit_base', 'medkit', Object.assign(itemMesh(ctx, 'medkit'), {}));
    ctx.pickups[ctx.pickups.length - 1].mesh.position.set(-12.0, y0 + 1.36, -1.05);
    propMesh(ctx, 'bottle', -13.5, y0, 2.1);
    ceilingBulb(ctx, 'guardRest', -13.5, y0 + H, 0.5, { power: 'base', intensity: 2.5, flicker: 0.1 });
    // archive (locked — revisited at the end)
    bake(b, P.shelf(M, 3, 1.4, 2.0, 0.4, 'metalGrey').place(-15.4, y0, 4.0, Math.PI / 2));
    bake(b, P.shelf(M, 4, 1.4, 2.0, 0.4, 'metalGrey').place(-13.3, y0, 5.0, Math.PI));
    docAt(ctx, 'doc_archive', 'archiveFile', 14, 'doc', -12.2, y0 + 0.79, 3.4, undefined, 0.5);
    bake(b, P.table(M, 1.0, 0.6, 0.78, 'planks').place(-12.2, y0, 3.4, 0));
    ceilingBulb(ctx, 'guardArchive', -13.5, y0 + H, 4.0, { power: 'base', intensity: 2.2, flicker: 0.3 });
    ctx.indoors.push({ name: 'guard', min: new THREE.Vector3(X0, 0, Z0), max: new THREE.Vector3(X1, y0 + H, Z1), closed: 1 });
    ctx.spots.guardRoom = new THREE.Object3D();
    ctx.spots.guardRoom.position.set(-8.5, 1, 2);
    root.add(ctx.spots.guardRoom);
    ctx.cams.push({ id: 'cam1', label: 'КАМ 1 · КОРПУС', pos: new THREE.Vector3(-6.5, y0 + 2.8, 5.1), look: new THREE.Vector3(-9.5, 0.9, 0) });
  }

  // --- generator shed
  {
    const cx = 14, cz = -9;
    b.box('concrete', cx, 0.08, cz, 5, 0.16, 3.6, { surface: 'concrete' });
    for (const [px, pz] of [[-2.4, -1.7], [2.4, -1.7], [-2.4, 1.7], [2.4, 1.7]]) b.box('planksDark', cx + px, 1.3, cz + pz, 0.15, 2.6, 0.15);
    b.box('roofTin', cx, 2.7, cz, 5.4, 0.05, 4.2, { collide: false });
    b.wall('planksGrey', cx - 2.4, cz - 1.7, cx + 2.4, cz - 1.7, 0.16, 2.4, 0.08);
    b.wall('planksGrey', cx + 2.4, cz - 1.7, cx + 2.4, cz + 1.7, 0.16, 2.4, 0.08);
    const gen = P.generator(M).place(cx, 0.16, cz - 0.3, 0);
    root.add(gen.g);
    b.boxCollider(cx, 0.8, cz - 0.3, 1.15, 0.65, 0.5);
    ctx.spots.generator = gen.g;
    bake(b, P.barrel(M).place(cx + 1.8, 0.16, cz - 1.1, 0));
    bake(b, P.barrel(M).place(cx + 1.8, 0.16, cz - 0.4, 0.5));
    const pole = P.woodPole(M).place(cx - 3.4, 0, cz + 2, 0);
    bake(b, pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), M.bulbOff);
    bulb.position.set(cx, 2.55, cz);
    root.add(bulb);
    addLamp(ctx, 'genShed', new THREE.Vector3(cx, 2.4, cz), { bulb, power: 'base', intensity: 4, range: 10 });
    ctx.indoors.push({ name: 'shed', min: new THREE.Vector3(cx - 2.5, 0, cz - 1.8), max: new THREE.Vector3(cx + 2.5, 2.7, cz + 1.8), closed: 0.3 });
    ctx.cams.push({ id: 'cam4', label: 'КАМ 4 · ГЕНЕРАТОР', pos: new THREE.Vector3(cx - 4, 3.2, cz + 4), look: new THREE.Vector3(cx, 0.8, cz) });
  }

  // --- storage (corrugated shed), locked
  {
    const X0 = 9, X1 = 15, Z0 = 4, Z1 = 9, H = 2.8;
    b.box('concrete', (X0 + X1) / 2, 0.06, (Z0 + Z1) / 2, X1 - X0, 0.12, Z1 - Z0, { surface: 'concrete' });
    b.wall('roofTin', X0, Z0, X0, Z1, 0.12, H, 0.1, [{ at: 2.5, w: 1.1, h: 2.1 }]);
    b.wall('roofTin', X1, Z0, X1, Z1, 0.12, H, 0.1);
    b.wall('roofTin', X0, Z0, X1, Z0, 0.12, H, 0.1);
    b.wall('roofTin', X0, Z1, X1, Z1, 0.12, H, 0.1);
    b.box('roofTinClean', (X0 + X1) / 2, H + 0.15, (Z0 + Z1) / 2, X1 - X0 + 0.5, 0.06, Z1 - Z0 + 0.5);
    addDoor(ctx, { id: 'storageDoor', x: X0, y: 0.12, z: 6.5 - 0.53, ry: -Math.PI / 2, w: 1.06, h: 2.08, mat: 'metalRust', dir: -1, locked: true, keyId: 'key_storage', label: 'склад', heavy: true });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.25), new THREE.MeshLambertMaterial({ map: labelTex(['СКЛАД №2'], 256, 96, '#e8e2d0', '#2a3a5a', 'bold 48px sans-serif') }));
    sign.position.set(X0 - 0.06, 2.45, 6.5);
    sign.rotation.y = -Math.PI / 2;
    root.add(sign);
    bake(b, P.shelf(M, 7, 2.2, 2.0, 0.5, 'metalGrey').place(12, 0.12, 8.6, Math.PI));
    bake(b, P.shelf(M, 8, 2.2, 2.0, 0.5, 'metalGrey').place(14.6, 0.12, 6.5, -Math.PI / 2));
    bake(b, P.crate(M, 0.8).place(10, 0.12, 4.6, 0.2));
    bake(b, P.crate(M, 0.6).place(10.1, 0.92, 4.6, 0.5), { collide: true });
    bake(b, P.pallet(M).place(13, 0.12, 4.8, Math.PI / 2));
    const can = propMesh(ctx, 'canister', 13.0, 0.26, 4.8);
    ctx.spots.canister = can;
    propMesh(ctx, 'box', 11.5, 0.12, 5.4, 0.3);
    propMesh(ctx, 'bucket', 14.2, 0.12, 4.6);
    propMesh(ctx, 'can', 12.3, 1.33, 8.55);
    const fuse = itemMesh(ctx, 'fuse');
    fuse.position.set(11.6, 1.33, 8.55);
    pickup(ctx, 'pk_fuse', 'fuse', fuse);
    const bat = itemMesh(ctx, 'battery');
    bat.position.set(14.55, 0.83, 6.2);
    pickup(ctx, 'pk_battery_storage', 'battery', bat);
    ceilingBulb(ctx, 'storageBulb', 12, H, 6.5, { power: 'base', intensity: 3, flicker: 0.2 });
    ctx.indoors.push({ name: 'storage', min: new THREE.Vector3(X0, 0, Z0), max: new THREE.Vector3(X1, H, Z1), closed: 1 });
  }

  // --- yard dressing
  bake(b, P.van(M, 3, true).place(-5, 0, 11, 0.35));
  bake(b, P.woodPile(M, 4).place(-18, 0, -14, 0.1));
  bake(b, P.tire(M).place(17, 0, 14, 0), { collide: false });
  bake(b, P.tire(M).place(17.4, 0.24, 14.2, 0), { collide: false });
  bake(b, P.barrel(M).place(-19.5, 0, 12, 0));
  bake(b, P.pallet(M).place(18.5, 0, -2, 0.4));
  propMesh(ctx, 'bucket', -4.5, 0, -1);
  propMesh(ctx, 'can', 3, 0, -6);
  const sign = P.signBoard(M, labelTex(['ПОСТОРОННИМ', 'ВХОД ВОСПРЕЩЁН'], 512, 200, '#1d1d1d', '#d6d0bc', 'bold 54px sans-serif'), 1.4, 0.55, 1.2);
  sign.place(5, 0, -17.6, Math.PI);
  root.add(sign.g);

  // yard lamps (powered by the generator)
  const lampAt = (id: string, x: number, z: number, ry: number) => {
    const { kit, light } = P.lampPost(M, 1.4, 6);
    kit.place(x, 0, z, ry);
    const bulb = kit.g.getObjectByName('bulb') as THREE.Mesh;
    bake(b, kit);
    const wp = light.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(new THREE.Vector3(x, 0, z));
    const bm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.36), M.bulbOff);
    bm.position.copy(wp).y += 0.19;
    bm.rotation.y = ry;
    root.add(bm);
    void bulb;
    addLamp(ctx, id, wp, { bulb: bm, power: 'base', intensity: 9, range: 18, color: 0xffb874, flicker: id === 'yardN' ? 0.4 : 0.05, glowSize: 2.2 });
  };
  lampAt('yardSW', -8, 9, 0);
  lampAt('yardE', 18, 0, -Math.PI / 2);
  lampAt('yardN', -4, -15, Math.PI);
  lampAt('yardC', 2, 2, Math.PI / 2);

  // CCTV poles
  const camPole = (x: number, z: number) => b.box('metalGrey', x, 1.9, z, 0.1, 3.8, 0.1);
  camPole(3.8, -16.5);
  camPole(-1, 9.5);
  ctx.cams.push({ id: 'cam3', label: 'КАМ 3 · СЕВ. ВОРОТА', pos: new THREE.Vector3(3.8, 3.8, -16.2), look: new THREE.Vector3(-0.5, 0.9, -21) });
  ctx.cams.push({ id: 'cam2', label: 'КАМ 2 · ПЛАЦ', pos: new THREE.Vector3(-1, 3.9, 9.8), look: new THREE.Vector3(5, 0.5, -2) });
  for (const c of ctx.cams) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.25), M.metalWhite);
    body.position.copy(c.pos);
    body.lookAt(c.look);
    root.add(body);
  }
}
