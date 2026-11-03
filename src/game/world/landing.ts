import * as THREE from 'three';
import { WorldBuilder, boxGeo, planeGeo } from './builder';
import type { Mats } from './materials';
import { labelTex } from './textures';
import { Door } from './Door';
import { makeLamp, type Lamp } from './lights';
import { CanvasScreen } from './CanvasScreen';
import { H } from './apartment';

export const LANDING = { minX: -2.6, maxX: 9.6, minZ: -3.0, maxZ: 0 };
export const ELEVATOR = { minX: 3.25, maxX: 4.35, minZ: -4.3, maxZ: -3.0 };
export const APT48 = { minX: -2.6, maxX: 0, minZ: 0, maxZ: 2.6 };

export interface LandingRefs {
  doors: Record<string, Door>;
  lamps: Record<string, Lamp>;
  props: Record<string, THREE.Object3D>;
  anchors: Record<string, THREE.Vector3>;
  elevator: { left: THREE.Mesh; right: THREE.Mesh; open: number; target: number; display: CanvasScreen; light: THREE.Mesh; collider: { enabled?: boolean } };
  flyer: THREE.Mesh;
}

export function buildLanding(b: WorldBuilder, m: Mats): LandingRefs {
  const L = LANDING;
  const doors: Record<string, Door> = {};
  const lamps: Record<string, Lamp> = {};
  const props: Record<string, THREE.Object3D> = {};
  const anchors: Record<string, THREE.Vector3> = {};
  b.room({ id: 'landing', name: 'Лестничная клетка', ...L, floor: 'concrete' });
  b.room({ id: 'elevator', name: 'Лифт', ...ELEVATOR, floor: 'metal' });
  b.room({ id: 'apt48', name: 'Квартира 48', ...APT48, floor: 'linoleum' });

  // floor (minus the stair well) and ceiling
  b.floorCeil(L.minX, 7.4, L.minZ, L.maxZ, m.mosaic, m.ceiling);
  b.floorCeil(7.4, L.maxX, -1.2, 0, m.mosaic, null);
  const ceil2 = new THREE.Mesh(planeGeo(2.2, 3.0, 3), m.ceiling);
  ceil2.rotation.x = Math.PI / 2;
  ceil2.position.set(8.5, H, -1.5);
  b.root.add(ceil2);

  // walls (landing faces). The z=0 apartment faces were built by the apartment.
  b.wall(L.minX, 0, 0, 0, m.plaster, m.stair, m.edge, [{ a: -1.6, b: -0.7, bottom: 0, top: 2.05 }]);
  b.wall(4.6, 0, 7.4, 0, m.plaster, m.stair, m.edge, [{ a: 5.6, b: 6.5, bottom: 0, top: 2.05 }]);
  b.wall(7.4, 0, L.maxX, 0, m.plaster, m.stair, m.edge);
  b.wall(L.minX, L.minZ, L.maxX, L.minZ, m.stair, m.plaster, m.edge, [{ a: 3.35, b: 4.25, bottom: 0, top: 2.1 }]);
  b.wall(L.minX, L.minZ, L.minX, 0, m.stair, m.plaster, m.edge);
  b.wall(L.maxX, L.minZ, L.maxX, 0, m.plaster, m.stair, m.edge, [{ a: -2.2, b: -0.9, bottom: 1.0, top: 2.2 }]);

  // stairs going down into darkness (not walkable)
  for (let i = 0; i < 9; i++) {
    const y = -0.16 * (i + 1);
    b.box(2.0, 0.16, 0.28, 8.5, y + 0.08, -1.35 - i * 0.28 + 0.14, m.concrete, { occluder: false });
  }
  const pit = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.8), new THREE.MeshBasicMaterial({ color: 0x020203 }));
  pit.rotation.x = -Math.PI / 2;
  pit.position.set(8.5, -1.5, -2.1);
  b.root.add(pit);
  b.collideBox(8.5, -2.1, 2.2, 1.8, 0, 'stairs');
  // railing
  b.box(0.04, 0.9, 0.04, 7.45, 0.45, -1.2, m.darkMetal);
  b.box(2.1, 0.05, 0.05, 8.45, 0.92, -1.2, m.walnut);
  for (let i = 0; i < 8; i++) b.box(0.02, 0.88, 0.02, 7.55 + i * 0.26, 0.44, -1.2, m.darkMetal, { occluder: false });
  b.box(0.05, 0.05, 1.8, 7.45, 0.92, -2.1, m.walnut);
  props.stairs = pit;
  anchors.stairs = new THREE.Vector3(8.5, -0.5, -2.2);

  // landing window (east)
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.1), m.glass);
  glass.position.set(L.maxX - 0.03, 1.6, -1.55);
  glass.rotation.y = -Math.PI / 2;
  glass.userData.windowGlass = true;
  b.root.add(glass);
  b.box(0.3, 0.04, 1.4, L.maxX - 0.15, 1.0, -1.55, m.plastic, { occluder: false });

  // lamp: bare bulb
  lamps.landing = makeLamp('landing', b.root, 2.6, H, -1.5, 4.2, 0xffe2b0, 10, 0.55);
  b.box(0.012, 0.15, 0.012, 2.6, H - 0.07, -1.5, m.blackPlastic, { occluder: false });
  anchors.landingLamp = new THREE.Vector3(2.6, 2.45, -1.5);

  // doors 48 and 46
  doors.d48 = new Door(b, { id: 'd48', hinge: [-1.6, 0], width: 0.9, height: 2.03, thickness: 0.08, closedYaw: 0, swing: -1.2, mat: m.leather, handleMat: m.brass, sound: 'front' });
  doors.d46 = new Door(b, { id: 'd46', hinge: [6.5, 0], width: 0.9, height: 2.03, thickness: 0.08, closedYaw: Math.PI, swing: 1.2, mat: m.leather, handleMat: m.brass, sound: 'front' });
  numberPlate(b, '48', -1.15, -0.05);
  numberPlate(b, '46', 6.05, -0.05);
  numberPlate(b, '47', 3.8, -0.1, true);
  // seal on door 46: paper strip across door & jamb
  const seal = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.06), new THREE.MeshLambertMaterial({ map: labelTex('ОПЕЧАТАНО · ОП №3 ·', 256, 32, '#2a2a3a', '#e4dcc8', '15px serif') }));
  seal.position.set(5.6, 1.3, -0.1);
  seal.rotation.y = Math.PI;
  seal.rotation.z = 0.12;
  b.root.add(seal);
  props.seal46 = seal;
  anchors.door46 = new THREE.Vector3(6.05, 1.5, -0.2);
  anchors.door48 = new THREE.Vector3(-1.15, 1.5, -0.2);
  // electrical panel between 48 and 47
  b.box(0.7, 0.9, 0.12, 1.5, 1.6, -0.08, m.darkMetal, { collide: true });
  props.panel = b.box(0.66, 0.86, 0.01, 1.5, 1.6, -0.145, phongColor(0x5a6658), { occluder: true });
  // floor number + scribbles
  const four = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), new THREE.MeshLambertMaterial({ map: labelTex('4', 64, 96, '#28302a', '#4c5e52', 'bold 80px sans-serif') }));
  four.position.set(2.2, 1.9, -2.94);
  b.root.add(four);
  // radiator
  for (let i = 0; i < 10; i++) b.box(0.08, 0.5, 0.06, 9.45, 0.45, -2.6 + i * 0.09, m.radiator, { occluder: false });
  // mat in front of 46, plant pot (life of neighbours)
  b.box(0.6, 0.012, 0.4, 6.05, 0.006, -0.35, m.rubber);
  b.box(0.25, 0.3, 0.25, 7.1, 0.15, -0.25, phongColor(0x5a4a3a), { collide: true, shadow: 1 });
  b.box(0.3, 0.35, 0.3, 7.1, 0.45, -0.25, m.green, { occluder: false });
  // cigarette-can on the radiator sill
  b.box(0.08, 0.1, 0.08, 9.4, 1.07, -1.3, m.metal);

  // ---------- elevator ----------
  const E = ELEVATOR;
  b.floorCeil(E.minX, E.maxX, E.minZ, E.maxZ, m.rubber, m.darkMetal);
  b.wall(E.minX, E.minZ, E.minX, E.maxZ, m.elevator, m.plaster, m.edge);
  b.wall(E.maxX, E.minZ, E.maxX, E.maxZ, m.plaster, m.elevator, m.edge);
  b.wall(E.minX, E.minZ, E.maxX, E.minZ, m.elevator, m.plaster, m.edge);
  const shaftClosed = b.collideBox(3.8, -3.0, 0.9, 0.12, 0, 'elevatorDoor');
  const doorMat = phongColor(0x7d7a70, 50);
  const left = new THREE.Mesh(boxGeo(0.46, 2.08, 0.04), doorMat);
  const right = new THREE.Mesh(boxGeo(0.46, 2.08, 0.04), doorMat);
  left.position.set(3.57, 1.04, -2.97);
  right.position.set(4.03, 1.04, -2.97);
  left.userData.dynamic = right.userData.dynamic = true;
  b.root.add(left, right);
  b.occluders.push(left, right);
  // cabin light panel
  const lightMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const cabLight = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), lightMat);
  cabLight.rotation.x = Math.PI / 2;
  cabLight.position.set(3.8, H - 0.4, -3.65);
  b.root.add(cabLight);
  // control panel
  b.box(0.02, 0.5, 0.18, E.maxX - 0.02, 1.25, -3.3, m.metal);
  for (let i = 0; i < 9; i++) b.box(0.02, 0.03, 0.03, E.maxX - 0.035, 1.05 + (i % 5) * 0.08, -3.34 + Math.floor(i / 5) * 0.08, m.blackPlastic, { occluder: false });
  const display = new CanvasScreen(64, 32);
  display.draw((c, w, h) => {
    c.fillStyle = '#050505';
    c.fillRect(0, 0, w, h);
  });
  const dispMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshBasicMaterial({ map: display.tex }));
  dispMesh.position.set(3.8, 2.25, -3.08);
  dispMesh.rotation.y = Math.PI; // faces into the cabin
  b.root.add(dispMesh);
  const dispOut = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshBasicMaterial({ map: display.tex }));
  dispOut.position.set(3.8, 2.25, -2.94);
  b.root.add(dispOut);
  // call button outside
  const btnMat = new THREE.MeshBasicMaterial({ color: 0x331a10 });
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 12), btnMat);
  btn.rotation.x = Math.PI / 2;
  btn.position.set(4.55, 1.2, -2.93);
  b.root.add(btn);
  b.box(0.08, 0.14, 0.01, 4.55, 1.2, -2.945, m.metal, { occluder: false });
  props.elevatorButton = btn;
  props.elevatorButtonMat = btn; // material swapped by world view
  props.elevatorCabLight = cabLight;
  props.elevatorPanel = dispMesh;
  anchors.elevator = new THREE.Vector3(3.8, 1.3, -3.6);
  anchors.elevatorShaft = new THREE.Vector3(3.8, 1.3, -4.0);

  // ---------- apartment 48 (only the entry, reachable in one branch) ----------
  const A = APT48;
  const wp48 = new THREE.MeshLambertMaterial({ color: 0x4a4a42, map: (m.wpHall as THREE.MeshLambertMaterial).map });
  (wp48 as unknown as { userData: { tile: number } }).userData.tile = 1;
  b.floorCeil(A.minX, -0.12, A.minZ, A.maxZ, m.linoleum, m.ceiling);
  b.wall(A.minX, 0, A.minX, A.maxZ, wp48, m.plaster, m.edge);
  b.wall(A.minX, A.maxZ, -0.12, A.maxZ, m.plaster, wp48, m.edge, [{ a: -1.4, b: -0.6, bottom: 0, top: 2.0 }]);
  // dark doorway into the rest of 48 (blocked)
  const voidM = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2.0), new THREE.MeshBasicMaterial({ color: 0x030304 }));
  voidM.position.set(-1.0, 1.0, A.maxZ + 0.15);
  voidM.rotation.y = Math.PI;
  b.root.add(voidM);
  b.collideBox(-1.0, A.maxZ, 0.9, 0.3, 0, 'apt48inner');
  // covered mirror, coat, shoes
  b.box(0.04, 0.9, 0.6, -2.56, 1.4, 1.2, m.mirrorFrame);
  const sheet = new THREE.Mesh(planeGeo(0.75, 1.1), m.sheet);
  sheet.position.set(-2.52, 1.35, 1.2);
  sheet.rotation.y = Math.PI / 2;
  b.root.add(sheet);
  props.sheet48 = sheet;
  b.box(0.18, 0.9, 0.42, -2.45, 1.25, 0.5, phongColor(0x5a5048), { occluder: false });
  b.box(0.24, 0.07, 0.1, -2.3, 0.035, 1.9, m.blackPlastic);
  b.box(0.24, 0.07, 0.1, -2.3, 0.035, 2.05, m.blackPlastic);
  // a small cold light from deeper inside
  lamps.apt48 = makeLamp('apt48', b.root, -1.0, 1.0, 3.2, 0.6, 0x9fb4c8, 4, 0.01);
  // missing-person flyer on the floor
  const flyer = new THREE.Mesh(boxGeo(0.21, 0.002, 0.3), new THREE.MeshLambertMaterial({ map: flyerTexture() }));
  flyer.position.set(-1.25, 0.004, 1.1);
  flyer.rotation.y = 0.5;
  b.root.add(flyer);
  anchors.apt48 = new THREE.Vector3(-1.2, 1.4, 1.3);

  const elevator = { left, right, open: 0, target: 0, display, light: cabLight, collider: shaftClosed };
  return { doors, lamps, props, anchors, elevator, flyer };
}

function phongColor(c: number, s = 30) {
  const m = new THREE.MeshPhongMaterial({ color: c, shininess: s, specular: 0x222222 });
  (m as unknown as { userData: { tile: number } }).userData.tile = 1;
  return m;
}

function numberPlate(b: WorldBuilder, n: string, x: number, z: number, onWall = false) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.1), new THREE.MeshLambertMaterial({ map: labelTex(n, 96, 64, '#d8c89a', '#1c1712', 'bold 44px serif') }));
  p.position.set(x + (onWall ? 0.65 : 0), onWall ? 2.25 : 1.75, z);
  p.rotation.y = Math.PI;
  b.root.add(p);
}

export function flyerTexture() {
  const c = document.createElement('canvas');
  c.width = 210;
  c.height = 300;
  const x = c.getContext('2d')!;
  x.fillStyle = '#ece8dc';
  x.fillRect(0, 0, 210, 300);
  x.fillStyle = '#1e1e1e';
  x.font = 'bold 30px sans-serif';
  x.textAlign = 'center';
  x.fillText('ПРОПАЛА', 105, 38);
  x.fillStyle = '#6a6a66';
  x.fillRect(45, 52, 120, 130);
  x.fillStyle = '#3a3a38';
  x.beginPath();
  x.arc(105, 105, 30, 0, Math.PI * 2);
  x.fill();
  x.fillRect(65, 140, 80, 42);
  x.fillStyle = '#1e1e1e';
  x.font = 'bold 15px sans-serif';
  x.fillText('Ковалёва Алина', 105, 205);
  x.font = '12px sans-serif';
  x.fillText('24 года. Ушла из дома', 105, 225);
  x.fillText('в ночь на 14 октября', 105, 241);
  x.fillText('Если видели — позвоните', 105, 262);
  x.font = 'bold 13px monospace';
  x.fillText('8 9•• ••• •• 17', 105, 284);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
