import * as THREE from 'three';
import { WorldBuilder, boxGeo, planeGeo } from './builder';
import type { Mats } from './materials';
import type { TexLib } from './textures';
import { labelTex } from './textures';
import { Door } from './Door';
import { makeLamp, type Lamp } from './lights';
import { CanvasScreen, segClock } from './CanvasScreen';

/** Apartment 47 plan (metres). Y up, floor = 0, ceiling = 2.6. */
export const PLAN = {
  bath: { minX: 0, maxX: 3.0, minZ: 0, maxZ: 2.2 },
  room: { minX: 0, maxX: 3.0, minZ: 2.2, maxZ: 6.8 },
  hall: { minX: 3.0, maxX: 4.6, minZ: 0, maxZ: 4.6 },
  closet: { minX: 3.0, maxX: 4.6, minZ: 4.6, maxZ: 6.8 },
  kitchen: { minX: 4.6, maxX: 7.4, minZ: 2.4, maxZ: 6.8 },
};
export const H = 2.6;

export interface ApartmentRefs {
  doors: Record<string, Door>;
  lamps: Record<string, Lamp>;
  props: Record<string, THREE.Object3D>;
  anchors: Record<string, THREE.Vector3>;
  microwave: CanvasScreen;
  tv: CanvasScreen;
  tvLight: THREE.PointLight;
  mirrorSpot: { pos: THREE.Vector3; normal: THREE.Vector3; w: number; h: number };
  photoFrame: THREE.Group;
  polaroid: THREE.Mesh;
  noteDoor: THREE.Mesh;
  jacket: THREE.Group;
  footprints: THREE.Group;
  headlight: THREE.Mesh;
}

export function buildApartment(b: WorldBuilder, m: Mats, t: TexLib): ApartmentRefs {
  const doors: Record<string, Door> = {};
  const lamps: Record<string, Lamp> = {};
  const props: Record<string, THREE.Object3D> = {};
  const anchors: Record<string, THREE.Vector3> = {};
  const P = PLAN;

  // ---------- rooms (for footsteps, audio occlusion, triggers) ----------
  b.room({ id: 'bath', name: 'Ванная', ...P.bath, floor: 'tile' });
  b.room({ id: 'room', name: 'Комната', ...P.room, floor: 'laminate' });
  b.room({ id: 'hall', name: 'Прихожая', ...P.hall, floor: 'linoleum' });
  b.room({ id: 'closet', name: 'Кладовка', ...P.closet, floor: 'linoleum' });
  b.room({ id: 'kitchen', name: 'Кухня', ...P.kitchen, floor: 'linoleum' });

  // ---------- floors & ceilings ----------
  b.floorCeil(P.bath.minX, P.bath.maxX, P.bath.minZ, P.bath.maxZ, m.tileBath, m.ceiling);
  b.floorCeil(P.room.minX, P.room.maxX, P.room.minZ, P.room.maxZ, m.laminate, m.ceilingLeak);
  b.floorCeil(P.hall.minX, P.hall.maxX, P.hall.minZ, P.hall.maxZ, m.linoleum, m.ceiling);
  b.floorCeil(P.closet.minX, P.closet.maxX, P.closet.minZ, P.closet.maxZ, m.linoleum, m.ceiling);
  b.floorCeil(P.kitchen.minX, P.kitchen.maxX, P.kitchen.minZ, P.kitchen.maxZ, m.linoleum, m.ceiling);
  // threshold strips
  b.box(0.9, 0.012, 0.14, 3.8, 0.006, 0.0, m.brass);
  b.box(0.14, 0.012, 0.7, 3.0, 0.006, 1.55, m.metal);

  // ---------- walls ----------
  const E = m.edge;
  // landing wall z=0 (only apartment side here; landing builds its own face)
  b.wall(0, 0, 3.0, 0, m.tileBath, m.stair, E);
  b.wall(3.0, 0, 4.6, 0, m.wpHall, m.stair, E, [{ a: 3.35, b: 4.25, bottom: 0, top: 2.08 }]);
  // west wall to apartment 48
  b.wall(0, 0, 0, 2.2, m.tileBath, m.plaster, E);
  b.wall(0, 2.2, 0, 6.8, m.wpRoom, m.plaster, E);
  // x=3.0 (bath|hall, room|hall, room|closet)
  b.wall(3.0, 0, 3.0, 2.2, m.wpHall, m.tileBath, E, [{ a: 1.2, b: 1.9, bottom: 0, top: 2.0 }]);
  b.wall(3.0, 2.2, 3.0, 4.6, m.wpHall, m.wpRoom, E, [{ a: 3.3, b: 4.1, bottom: 0, top: 2.05 }]);
  b.wall(3.0, 4.6, 3.0, 6.8, m.plaster, m.wpRoom, E);
  // x=4.6 (hall|46, hall|kitchen, closet|kitchen)
  b.wall(4.6, 0, 4.6, 2.4, m.plaster, m.wpHall, E);
  b.wall(4.6, 2.4, 4.6, 4.6, m.kitchenWall, m.wpHall, E, [{ a: 3.4, b: 4.2, bottom: 0, top: 2.1 }]);
  b.wall(4.6, 4.6, 4.6, 6.8, m.kitchenWall, m.plaster, E);
  // kitchen east (exterior side)
  b.wall(7.4, 2.4, 7.4, 6.8, m.plaster, m.kitchenWall, E, [], H, 0.25);
  // internal z walls
  b.wall(0, 2.2, 3.0, 2.2, m.wpRoom, m.tileBath, E);
  b.wall(4.6, 2.4, 7.4, 2.4, m.kitchenWall, m.plaster, E);
  b.wall(3.0, 4.6, 4.6, 4.6, m.plaster, m.wpHall, E, [{ a: 3.4, b: 4.2, bottom: 0, top: 2.0 }]);
  // facade z=6.8 with windows
  const facade = m.concrete;
  b.wall(0, 6.8, 3.0, 6.8, facade, m.wpRoom, E, [{ a: 0.8, b: 2.4, bottom: 0.85, top: 2.3 }], H, 0.3);
  b.wall(3.0, 6.8, 4.6, 6.8, facade, m.plaster, E, [], H, 0.3);
  b.wall(4.6, 6.8, 7.4, 6.8, facade, m.kitchenWall, E, [{ a: 5.3, b: 6.9, bottom: 0.9, top: 2.3 }], H, 0.3);
  // kitchen backsplash
  b.box(0.04, 0.6, 2.5, 7.26, 1.2, 3.75, m.tileSplash);

  // baseboards
  const bb = m.walnut;
  b.box(0.02, 0.07, 4.6, 3.06, 0.035, 2.3, bb);
  b.box(0.02, 0.07, 4.6, 4.54, 0.035, 2.3, bb);
  b.box(2.9, 0.07, 0.02, 1.5, 0.035, 6.62, bb);
  b.box(0.02, 0.07, 4.4, 0.06, 0.035, 4.5, bb);

  // ---------- windows ----------
  windowFrame(b, m, 1.6, 6.8, 1.6, 0.85, 2.3, 'z');
  windowFrame(b, m, 6.1, 6.8, 1.6, 0.9, 2.3, 'z');
  anchors.windowRoom = new THREE.Vector3(1.6, 1.5, 6.8);
  anchors.windowKitchen = new THREE.Vector3(6.1, 1.5, 6.8);
  // curtains
  const tulle = new THREE.Mesh(planeGeo(0.7, 1.9), m.curtain);
  tulle.position.set(0.95, 1.5, 6.6);
  tulle.rotation.y = Math.PI;
  b.root.add(tulle);
  const tulle2 = tulle.clone();
  tulle2.position.set(2.3, 1.5, 6.6);
  b.root.add(tulle2);
  b.box(1.9, 0.04, 0.04, 1.6, 2.45, 6.6, m.metal);
  radiator(b, m, 1.6, 6.62, 1.0);
  radiator(b, m, 6.1, 6.62, 1.0);

  // ---------- lamps ----------
  lamps.hall = makeLamp('hall', b.root, 3.8, H, 1.5, 4.5, 0xffd2a0, 8, 0.45);
  lamps.bath = makeLamp('bath', b.root, 1.5, H, 1.1, 4, 0xfff0d8, 7, 0.4);
  lamps.room = makeLamp('room', b.root, 1.5, H, 4.5, 6, 0xffd8a8, 9, 0.5);
  lamps.kitchen = makeLamp('kitchen', b.root, 6.0, H, 4.6, 5.5, 0xf6ecd6, 9, 0.5);
  lamps.desk = makeLamp('desk', b.root, 1.15, 1.18, 6.45, 1.6, 0xffc488, 4, 0.25);
  // shades
  shadeLamp(b, m, 1.5, 4.5);
  shadeLamp(b, m, 6.0, 4.6);
  b.box(0.012, 0.18, 0.012, 3.8, H - 0.09, 1.5, m.blackPlastic); // bare hall cord
  b.box(0.22, 0.05, 0.22, 1.5, H - 0.03, 1.1, m.plastic); // bath fixture

  // ---------- doors ----------
  doors.front = new Door(b, { id: 'front', hinge: [3.35, 0.0], width: 0.9, height: 2.06, thickness: 0.09, closedYaw: 0, swing: -1.45, mat: m.leather, handleMat: m.brass, sound: 'front' });
  doors.bath = new Door(b, { id: 'bath', hinge: [3.0, 1.2], width: 0.7, height: 1.98, closedYaw: Math.PI / 2, swing: -1.35, mat: m.paintedDoor, handleMat: m.metal, sound: 'interior' });
  doors.room = new Door(b, { id: 'room', hinge: [3.0, 3.3], width: 0.8, height: 2.03, closedYaw: Math.PI / 2, swing: 1.4, mat: m.paintedDoor, handleMat: m.metal, sound: 'interior' });
  doors.closet = new Door(b, { id: 'closet', hinge: [3.4, 4.6], width: 0.8, height: 1.98, closedYaw: 0, swing: -1.3, mat: m.paintedDoor, handleMat: m.metal, sound: 'interior' });
  // door frames
  for (const [x, z, w, axis] of [[3.8, 0, 0.9, 'x'], [3.0, 1.55, 0.7, 'z'], [3.0, 3.7, 0.8, 'z'], [3.8, 4.6, 0.8, 'x'], [4.6, 3.8, 0.8, 'z']] as const)
    doorFrame(b, m, x, z, w, axis === 'x');
  // peephole + lock on front door (attached to leaf)
  const peep = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.11, 10), m.brass);
  peep.rotation.x = Math.PI / 2;
  peep.position.set(0.45, 1.55 - 1.03, 0);
  doors.front.leaf.add(peep);
  props.peephole = peep;
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.03), m.brass);
  lock.position.set(0.75, 1.15 - 1.03, 0.06);
  doors.front.leaf.add(lock);
  // number plate (outside face)
  const num = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), new THREE.MeshLambertMaterial({ map: labelTex('47', 96, 64, '#d8c89a', '#1c1712', 'bold 44px serif') }));
  num.position.set(0.45, 1.72 - 1.03, -0.047);
  num.rotation.y = Math.PI;
  doors.front.leaf.add(num);
  // doormat inside
  b.box(0.7, 0.012, 0.45, 3.8, 0.006, 0.4, m.rubber);

  // ---------- hall ----------
  // coat hooks + jacket
  b.box(0.04, 0.06, 0.9, 4.53, 1.72, 1.0, m.walnut);
  const jacket = new THREE.Group();
  const jb = new THREE.Mesh(boxGeo(0.18, 0.75, 0.48), m.jacket);
  jb.position.set(4.42, 1.32, 0.85);
  const jh = new THREE.Mesh(boxGeo(0.16, 0.18, 0.34), m.jacket);
  jh.position.set(4.43, 1.72, 0.85);
  jacket.add(jb, jh);
  b.root.add(jacket);
  const scarf = b.box(0.08, 0.6, 0.12, 4.46, 1.4, 1.28, m.towel, { occluder: false });
  void scarf;
  // shoe shelf + shoes
  b.box(0.32, 0.38, 0.9, 4.42, 0.19, 1.0, m.walnut, { collide: true, shadow: 1 });
  for (const [z, c] of [[0.72, 0x222222], [0.95, 0x3b3328], [1.22, 0x50555a]] as const) {
    b.box(0.26, 0.09, 0.11, 4.4, 0.43, z, m.blackPlastic.clone() as THREE.Material);
    void c;
  }
  b.box(0.3, 0.08, 0.12, 4.0, 0.04, 0.35, m.blackPlastic); // shoes on mat
  b.box(0.04, 0.95, 0.04, 4.48, 0.5, 1.55, m.blackPlastic); // umbrella
  // intercom handset
  const intercom = new THREE.Group();
  const ib = new THREE.Mesh(boxGeo(0.05, 0.24, 0.1), m.plastic);
  ib.position.set(4.51, 1.5, 0.3);
  const ih = new THREE.Mesh(boxGeo(0.06, 0.2, 0.05), m.plastic);
  ih.position.set(4.475, 1.5, 0.3);
  const cord = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 4, 12), m.blackPlastic);
  cord.position.set(4.48, 1.33, 0.3);
  cord.rotation.y = Math.PI / 2;
  intercom.add(ib, ih, cord);
  b.root.add(intercom);
  props.intercom = intercom;
  props.intercomHandset = ih;
  anchors.intercom = new THREE.Vector3(4.5, 1.5, 0.3);
  // small cabinet with mail
  b.box(0.36, 0.75, 0.6, 3.2, 0.375, 2.75, m.walnut, { collide: true, shadow: 1 });
  const mail = new THREE.Group();
  const env1 = new THREE.Mesh(boxGeo(0.22, 0.004, 0.12), m.paper);
  env1.position.set(3.22, 0.755, 2.7);
  env1.rotation.y = 0.2;
  const env2 = new THREE.Mesh(boxGeo(0.22, 0.004, 0.12), m.paper);
  env2.position.set(3.18, 0.76, 2.82);
  env2.rotation.y = -0.3;
  const keys = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 4, 10), m.metal);
  keys.rotation.x = Math.PI / 2;
  keys.position.set(3.28, 0.76, 2.55);
  mail.add(env1, env2, keys);
  b.root.add(mail);
  props.mail = mail;
  // switches (hall, bath outside the bathroom — very Russian)
  props.swHall = switchPlate(b, m, 3.07, 1.05, 0.3, 'x+');
  props.swBath = switchPlate(b, m, 3.07, 1.05, 1.02, 'x+');
  props.swRoom = switchPlate(b, m, 2.93, 1.05, 4.3, 'x-');
  props.swKitchen = switchPlate(b, m, 4.67, 1.05, 4.4, 'x+');
  // paper slipped under the front door (hidden until the event)
  const noteDoor = new THREE.Mesh(boxGeo(0.21, 0.003, 0.15), m.paper);
  noteDoor.position.set(3.7, 0.003, 0.22);
  noteDoor.rotation.y = 0.35;
  b.root.add(noteDoor);
  noteDoor.visible = false;
  // wet footprints from the door (branch B)
  const footprints = new THREE.Group();
  const fpMat = new THREE.MeshPhongMaterial({ color: 0x101214, transparent: true, opacity: 0.55, shininess: 120, specular: 0x777777, depthWrite: false });
  b.root.add(footprints);
  for (let i = 0; i < 9; i++) {
    const f = new THREE.Mesh(new THREE.CircleGeometry(0.06, 10), fpMat);
    f.scale.set(0.75, 1.6, 1);
    f.rotation.x = -Math.PI / 2;
    f.position.set(-1.15 + i * 0.55, 0.006, -0.6 - (i % 2) * 0.16 + Math.sin(i * 0.7) * 0.2);
    f.rotation.z = Math.PI / 2 + 0.15;
    footprints.add(f);
  }
  footprints.visible = false;

  // ---------- bathroom ----------
  // bathtub
  b.box(1.66, 0.58, 0.72, 0.92, 0.29, 0.42, m.enamel, { collide: true, shadow: 1 });
  b.box(1.5, 0.02, 0.56, 0.92, 0.585, 0.42, m.enamelDark);
  b.box(0.04, 0.6, 0.04, 1.6, 0.9, 0.09, m.metal); // tap riser
  b.box(0.18, 0.03, 0.03, 1.55, 1.2, 0.09, m.metal);
  b.box(0.02, 1.8, 0.02, 0.92, 1.7, 0.78, m.metal, { occluder: false }); // curtain rod post
  const bcurtain = new THREE.Mesh(planeGeo(0.9, 1.3), new THREE.MeshLambertMaterial({ color: 0x9fb0ae, side: THREE.DoubleSide }));
  bcurtain.position.set(0.5, 1.75, 0.79);
  b.root.add(bcurtain);
  // sink + mirror on west wall
  b.box(0.42, 0.14, 0.52, 0.28, 0.82, 1.45, m.enamel, { collide: true });
  b.box(0.12, 0.7, 0.14, 0.2, 0.38, 1.45, m.enamel);
  b.box(0.05, 0.14, 0.03, 0.12, 0.98, 1.45, m.metal);
  b.box(0.04, 0.72, 0.62, 0.08, 1.52, 1.45, m.mirrorFrame);
  b.box(0.14, 0.03, 0.4, 0.1, 1.05, 1.45, m.plastic); // shelf
  b.box(0.04, 0.12, 0.04, 0.1, 1.12, 1.35, phongColor(0x5a7a8a)); // toothbrush cup
  b.box(0.05, 0.16, 0.05, 0.1, 1.14, 1.55, phongColor(0xbcb39a));
  const mirrorSpot = { pos: new THREE.Vector3(0.101, 1.52, 1.45), normal: new THREE.Vector3(1, 0, 0), w: 0.56, h: 0.66 };
  anchors.mirror = mirrorSpot.pos.clone();
  // toilet
  b.box(0.38, 0.4, 0.5, 2.55, 0.2, 0.42, m.enamel, { collide: true, shadow: 1 });
  b.box(0.42, 0.4, 0.18, 2.55, 0.62, 0.12, m.enamel);
  // washing machine
  b.box(0.6, 0.85, 0.55, 1.2, 0.425, 1.88, m.enamel, { collide: true, shadow: 1 });
  const porthole = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), m.screenOff);
  porthole.position.set(1.2, 0.5, 1.6 - 0.002);
  porthole.rotation.y = Math.PI;
  b.root.add(porthole);
  // riser pipes & towel rail
  b.box(0.06, H, 0.06, 2.92, H / 2, 0.08, m.radiator);
  b.box(0.04, H, 0.04, 2.82, H / 2, 0.08, m.radiator);
  b.box(0.5, 0.03, 0.03, 2.4, 1.2, 2.16, m.metal);
  b.box(0.5, 0.03, 0.03, 2.4, 0.8, 2.16, m.metal);
  b.box(0.4, 0.5, 0.03, 2.4, 1.0, 2.14, m.towel, { occluder: false });
  b.box(0.22, 0.16, 0.01, 1.6, 2.3, 0.01, m.darkMetal); // vent
  anchors.pipes = new THREE.Vector3(2.88, 1.6, 0.1);
  anchors.ventBath = new THREE.Vector3(1.6, 2.3, 0.05);

  // ---------- room ----------
  // sofa-bed against west wall
  b.box(0.9, 0.42, 2.0, 0.5, 0.21, 4.2, m.sofa, { collide: true, shadow: 1 });
  b.box(0.22, 0.75, 2.0, 0.12, 0.6, 4.2, m.sofa);
  b.box(0.9, 0.55, 0.16, 0.5, 0.33, 3.15, m.sofa);
  b.box(0.9, 0.55, 0.16, 0.5, 0.33, 5.25, m.sofa);
  const blanket = new THREE.Mesh(boxGeo(0.8, 0.08, 1.3, 0.6), m.blanket);
  blanket.position.set(0.55, 0.46, 4.5);
  blanket.rotation.y = 0.08;
  blanket.rotation.z = 0.04;
  b.root.add(blanket);
  b.box(0.45, 0.12, 0.6, 0.38, 0.5, 3.5, m.sheet); // pillow
  // carpet on the wall above the sofa
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.5), m.wallCarpet);
  carpet.position.set(0.072, 1.45, 4.2);
  carpet.rotation.y = Math.PI / 2;
  b.root.add(carpet);
  props.wallCarpet = carpet;
  // floor rug
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.0), new THREE.MeshLambertMaterial({ map: t.wallCarpet.map, color: 0x8a8a8a }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(1.75, 0.006, 4.4);
  b.root.add(rug);
  // wardrobe NW
  b.box(1.2, 2.1, 0.6, 0.65, 1.05, 2.55, m.walnut, { collide: true, shadow: 1 });
  doors.wardL = new Door(b, { id: 'wardL', hinge: [0.06, 2.86], width: 0.58, height: 1.95, thickness: 0.02, closedYaw: 0, swing: 1.6, mat: m.oak, handleMat: m.brass, sound: 'cabinet' });
  doors.wardR = new Door(b, { id: 'wardR', hinge: [1.24, 2.86], width: 0.58, height: 1.95, thickness: 0.02, closedYaw: Math.PI, swing: -1.6, mat: m.oak, handleMat: m.brass, sound: 'cabinet' });
  doors.wardL.pivot.position.y = doors.wardR.pivot.position.y = 0.08;
  doors.wardL.collider.enabled = doors.wardR.collider.enabled = false;
  doors.wardL.collider.minZ = doors.wardR.collider.minZ = 99; // never collide (wardrobe body collides)
  // wardrobe contents
  for (let i = 0; i < 6; i++) b.box(0.05, 0.85, 0.4, 0.2 + i * 0.16, 1.45, 2.55, i % 2 ? m.shirt : m.jacket, { occluder: false });
  b.box(1.1, 0.02, 0.5, 0.65, 1.92, 2.55, m.metal);
  // bookshelf
  b.box(1.0, 1.8, 0.32, 1.95, 0.9, 2.4, m.walnut, { collide: true, shadow: 1 });
  for (let s = 0; s < 4; s++) {
    b.box(0.94, 0.02, 0.28, 1.95, 0.35 + s * 0.42, 2.43, m.oak);
    let x = 1.52;
    while (x < 2.3 - (s === 2 ? 0.35 : 0)) {
      const w = 0.03 + Math.random() * 0.04, h = 0.24 + Math.random() * 0.1;
      b.box(w, h, 0.2, x, 0.36 + s * 0.42 + h / 2, 2.44, m.book[Math.floor(Math.random() * m.book.length)], { occluder: false });
      x += w + 0.004;
    }
  }
  // photo frame on the shelf (anomaly target)
  const photoFrame = new THREE.Group();
  const pf = new THREE.Mesh(boxGeo(0.18, 0.24, 0.015), m.darkMetal);
  const pfImg = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.2), new THREE.MeshLambertMaterial({ map: photoTexture() }));
  pfImg.position.z = 0.009;
  photoFrame.add(pf, pfImg);
  photoFrame.position.set(2.2, 1.21 + 0.12, 2.46);
  photoFrame.rotation.x = -0.12;
  b.root.add(photoFrame);
  // TV on a cabinet (east wall, facing the sofa)
  b.box(0.45, 0.5, 1.2, 2.72, 0.25, 5.1, m.walnut, { collide: true, shadow: 1 });
  const tv = new CanvasScreen(128, 96);
  const tvBody = b.box(0.08, 0.5, 0.84, 2.78, 0.82, 5.1, m.blackPlastic, { occluder: true });
  b.box(0.18, 0.04, 0.3, 2.78, 0.52, 5.1, m.blackPlastic);
  const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.44), new THREE.MeshBasicMaterial({ map: tv.tex, color: 0x000000 }));
  tvScreen.position.set(2.735, 0.82, 5.1);
  tvScreen.rotation.y = -Math.PI / 2;
  b.root.add(tvScreen);
  props.tv = tvBody;
  props.tvScreen = tvScreen;
  const tvLight = new THREE.PointLight(0x8fb0ff, 0, 4, 2);
  tvLight.position.set(2.4, 0.9, 5.1);
  b.root.add(tvLight);
  anchors.tv = new THREE.Vector3(2.7, 0.82, 5.1);
  // desk under the window with laptop, lamp and drawer
  b.box(1.3, 0.04, 0.55, 1.55, 0.74, 6.43, m.oak, { collide: true, shadow: 1 });
  b.box(0.04, 0.72, 0.5, 0.92, 0.36, 6.43, m.oak);
  b.box(0.42, 0.72, 0.5, 2.0, 0.36, 6.43, m.oak);
  const drawer = new THREE.Group();
  const dfront = new THREE.Mesh(boxGeo(0.4, 0.16, 0.02), m.walnut);
  dfront.position.set(0, 0, -0.26);
  const dbox = new THREE.Mesh(boxGeo(0.36, 0.12, 0.46), m.cardboard);
  drawer.add(dfront, dbox);
  drawer.position.set(2.0, 0.62, 6.43);
  b.root.add(drawer);
  props.drawer = drawer;
  // key with tag "48" inside the drawer
  const key = new THREE.Group();
  const kring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.003, 4, 10), m.brass);
  kring.rotation.x = Math.PI / 2;
  const kbit = new THREE.Mesh(boxGeo(0.07, 0.004, 0.015), m.brass);
  kbit.position.x = 0.05;
  const ktag = new THREE.Mesh(boxGeo(0.04, 0.004, 0.025), new THREE.MeshLambertMaterial({ map: labelTex('48', 64, 40, '#222', '#e6dcc0', 'bold 30px sans-serif') }));
  ktag.position.set(-0.04, 0, 0);
  key.add(kring, kbit, ktag);
  key.position.set(0, 0.065, 0.05);
  drawer.add(key);
  props.key48 = key;
  // laptop
  b.box(0.34, 0.02, 0.24, 1.45, 0.77, 6.4, m.darkMetal);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.004, 0.004), new THREE.MeshBasicMaterial({ color: 0x55ff99 }));
  led.position.set(1.6, 0.775, 6.28);
  b.root.add(led);
  props.laptop = b.box(0.34, 0.03, 0.24, 1.45, 0.785, 6.4, m.darkMetal, { occluder: true });
  // desk lamp
  b.box(0.12, 0.02, 0.12, 1.15, 0.77, 6.5, m.darkMetal);
  b.box(0.015, 0.36, 0.015, 1.15, 0.95, 6.5, m.darkMetal);
  const dl = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.1, 14, 1, true), m.shade);
  dl.position.set(1.15, 1.2, 6.47);
  b.root.add(dl);
  props.deskLamp = dl;
  // mug, papers
  b.box(0.07, 0.09, 0.07, 1.85, 0.805, 6.3, phongColor(0x6b7d78));
  b.box(0.25, 0.01, 0.32, 1.85, 0.765, 6.5, m.paper);
  // chair with clothes
  b.box(0.42, 0.04, 0.42, 1.55, 0.45, 5.85, m.oak, { collide: true, shadow: 1 });
  b.box(0.42, 0.45, 0.04, 1.55, 0.7, 5.64, m.oak);
  for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) b.box(0.03, 0.45, 0.03, 1.55 + dx, 0.22, 5.85 + dz, m.oak);
  b.box(0.44, 0.35, 0.08, 1.55, 0.78, 5.6, m.jeans, { occluder: false });
  b.box(0.3, 0.06, 0.32, 1.6, 0.5, 5.86, m.shirt, { occluder: false });
  // clutter on the floor
  b.box(0.3, 0.2, 0.4, 2.7, 0.1, 6.3, m.cardboard, { collide: true, shadow: 1 });
  b.box(0.06, 0.25, 0.06, 0.3, 0.125, 5.9, phongColor(0x2f4d3a)); // bottle
  b.box(0.22, 0.03, 0.3, 2.4, 0.015, 3.3, m.book[2]); // book on floor

  // ---------- kitchen ----------
  // counters along the east wall
  b.box(0.6, 0.86, 2.6, 7.08, 0.43, 3.75, m.oak, { collide: true, shadow: 1 });
  b.box(0.62, 0.04, 2.62, 7.08, 0.88, 3.75, phongColor(0x8c8676, 40));
  // sink
  b.box(0.46, 0.02, 0.5, 7.1, 0.9, 3.3, m.metal);
  b.box(0.38, 0.12, 0.42, 7.1, 0.85, 3.3, m.darkMetal);
  const tap = b.box(0.03, 0.28, 0.03, 7.3, 1.04, 3.3, m.metal, { occluder: false });
  b.box(0.2, 0.025, 0.025, 7.2, 1.17, 3.3, m.metal, { occluder: false });
  props.tap = tap;
  anchors.tap = new THREE.Vector3(7.2, 1.0, 3.3);
  // stove + kettle
  b.box(0.58, 0.86, 0.55, 7.08, 0.43, 4.6, m.enamel, { collide: true, shadow: 1 });
  b.box(0.58, 0.02, 0.55, 7.08, 0.87, 4.6, m.darkMetal);
  for (const [dx, dz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) b.box(0.12, 0.02, 0.12, 7.08 + dx, 0.89, 4.6 + dz, m.blackPlastic);
  const oven = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), m.screenOff);
  oven.position.set(6.785, 0.45, 4.6);
  oven.rotation.y = -Math.PI / 2;
  b.root.add(oven);
  const kettle = new THREE.Group();
  const kb = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.18, 14), m.enamel);
  const kl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.03, 10), m.enamel);
  kl.position.y = 0.1;
  const ksp = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.12, 6), m.enamel);
  ksp.position.set(-0.1, 0.03, 0);
  ksp.rotation.z = 0.9;
  kettle.add(kb, kl, ksp);
  kettle.position.set(6.95, 0.99, 4.47);
  b.root.add(kettle);
  props.kettle = kettle;
  anchors.kettle = kettle.position.clone();
  // upper cabinets
  b.box(0.35, 0.7, 2.6, 7.2, 1.95, 3.75, m.oak);
  for (let i = 0; i < 4; i++) b.box(0.02, 0.66, 0.6, 7.02, 1.95, 2.8 + i * 0.64, m.oak);
  // fridge NW corner (front faces +z)
  b.box(0.62, 1.75, 0.62, 4.96, 0.875, 2.75, m.enamel, { collide: true, shadow: 1 });
  const fridgeDoor = new THREE.Group();
  const fd = new THREE.Mesh(boxGeo(0.6, 1.15, 0.04), m.enamel);
  fd.position.set(0.3, 0, 0);
  fridgeDoor.add(fd);
  fridgeDoor.position.set(4.66, 0.62, 3.08);
  b.root.add(fridgeDoor);
  props.fridgeDoor = fridgeDoor;
  b.box(0.6, 0.55, 0.04, 4.96, 1.48, 3.08, m.enamel);
  b.box(0.03, 0.3, 0.03, 5.2, 0.9, 3.12, m.metal); // handle
  // fridge interior (seen when open)
  const finside = new THREE.PointLight(0xe8f0ff, 0, 1.6, 2);
  finside.position.set(4.96, 0.8, 2.85);
  b.root.add(finside);
  props.fridgeLight = finside as unknown as THREE.Object3D;
  b.box(0.5, 0.02, 0.5, 4.96, 0.9, 2.78, m.glass);
  b.box(0.1, 0.18, 0.1, 4.82, 1.0, 2.8, phongColor(0xd8d0b0)); // kefir
  b.box(0.18, 0.08, 0.12, 5.05, 0.95, 2.8, phongColor(0x8a6a4a)); // something wrapped
  // magnets and the polaroid (anomaly)
  for (const [x, y, c] of [[4.8, 1.55, 0x6a8a9a], [5.12, 1.35, 0xa08a50], [4.75, 1.25, 0x7a6a8a]] as const) b.box(0.05, 0.05, 0.015, x, y, 3.1, phongColor(c), { occluder: false });
  const polaroid = new THREE.Mesh(boxGeo(0.09, 0.11, 0.003), new THREE.MeshLambertMaterial({ map: polaroidTexture() }));
  polaroid.position.set(4.98, 1.42, 3.105);
  polaroid.rotation.z = 0.08;
  b.root.add(polaroid);
  polaroid.visible = false;
  // microwave on top of the counter (clock display)
  b.box(0.36, 0.26, 0.48, 7.06, 1.03, 2.82, m.enamel);
  const microwave = new CanvasScreen(96, 32);
  microwave.draw((c, w, h) => segClock(c, w, h, '02:51', '#78ffb0'));
  const mwScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.04), new THREE.MeshBasicMaterial({ map: microwave.tex }));
  mwScreen.position.set(6.875, 1.09, 2.66);
  mwScreen.rotation.y = -Math.PI / 2;
  b.root.add(mwScreen);
  b.box(0.01, 0.2, 0.3, 6.875, 1.03, 2.9, m.screenOff, { occluder: false });
  props.microwave = mwScreen;
  // table + stools under the window
  b.box(0.9, 0.04, 0.7, 6.1, 0.74, 6.25, m.oilcloth, { collide: true, shadow: 1 });
  for (const [dx, dz] of [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]]) b.box(0.04, 0.72, 0.04, 6.1 + dx, 0.36, 6.25 + dz, m.walnut);
  for (const [x, z] of [[5.45, 6.2], [6.1, 5.55]]) {
    b.box(0.34, 0.04, 0.34, x, 0.45, z, m.walnut, { collide: true, shadow: 1 });
    for (const [dx, dz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) b.box(0.03, 0.44, 0.03, x + dx, 0.22, z + dz, m.walnut);
  }
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.11, 12), new THREE.MeshPhongMaterial({ color: 0xc8dce0, transparent: true, opacity: 0.45, shininess: 120 }));
  glass.position.set(6.25, 0.815, 6.1);
  b.root.add(glass);
  props.glass = glass;
  b.box(0.12, 0.02, 0.12, 5.9, 0.77, 6.35, m.enamelDark); // saucer
  b.box(0.18, 0.06, 0.12, 6.4, 0.79, 6.45, m.cardboard); // tea box
  // calendar on the kitchen west wall
  const cal = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.42), new THREE.MeshLambertMaterial({ map: calendarTexture() }));
  cal.position.set(4.672, 1.5, 5.6);
  cal.rotation.y = Math.PI / 2;
  b.root.add(cal);
  props.calendar = cal;
  anchors.fridge = new THREE.Vector3(4.96, 1.0, 2.75);
  anchors.ventKitchen = new THREE.Vector3(7.2, 2.4, 2.5);

  // ---------- closet ----------
  for (let s = 0; s < 3; s++) b.box(0.45, 0.03, 2.0, 4.3, 0.6 + s * 0.6, 5.7, m.oak);
  b.box(0.45, 1.9, 0.03, 4.3, 0.95, 4.72, m.oak);
  b.box(0.04, 1.9, 2.1, 4.54, 0.95, 5.7, m.oak, { collide: true });
  for (const [y, z, w, h] of [[0.75, 5.0, 0.35, 0.28], [0.72, 5.6, 0.3, 0.2], [1.36, 5.4, 0.38, 0.3], [1.95, 6.0, 0.4, 0.25]]) b.box(0.38, h, w, 4.3, y + h / 2 - 0.12, z, m.cardboard, { occluder: false });
  const box48 = b.box(0.42, 0.3, 0.42, 3.4, 0.15, 6.4, m.cardboard, { collide: true, shadow: 1 });
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), new THREE.MeshLambertMaterial({ map: labelTex('вернуть в 48', 192, 64, '#1b1b1b', '#9a8058', '26px "Comic Sans MS", cursive') }));
  lbl.position.set(3.4, 0.2, 6.185);
  lbl.rotation.y = Math.PI;
  b.root.add(lbl);
  props.box48 = box48;
  b.box(0.06, 1.6, 0.12, 3.15, 0.8, 6.65, m.darkMetal, { occluder: false }); // skis
  b.box(0.3, 0.7, 0.3, 3.3, 0.35, 5.0, m.darkMetal, { collide: true, shadow: 1 }); // vacuum cleaner

  // ---------- car headlights sweeping across the room ceiling ----------
  const headlight = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.7), new THREE.MeshBasicMaterial({ map: (glowTexture()), color: 0x9fb2c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  headlight.rotation.x = Math.PI / 2;
  headlight.position.set(1.5, H - 0.01, 6.0);
  headlight.userData.dynamic = true;
  b.root.add(headlight);

  // ---------- avatar anchor points ----------
  anchors.frontDoorIn = new THREE.Vector3(3.8, 1.5, 0.15);
  anchors.frontDoorOut = new THREE.Vector3(3.8, 1.5, -0.2);
  anchors.wall48 = new THREE.Vector3(-0.6, 1.3, 4.5);
  anchors.wall48bath = new THREE.Vector3(-0.6, 1.3, 1.2);
  anchors.upstairs = new THREE.Vector3(2.0, 3.6, 4.0);

  return { doors, lamps, props, anchors, microwave, tv, tvLight, mirrorSpot, photoFrame, polaroid, noteDoor, jacket, footprints, headlight };
}

// ---------------------------------------------------------------------------
function phongColor(c: number, s = 30) {
  const m = new THREE.MeshPhongMaterial({ color: c, shininess: s, specular: 0x222222 });
  (m as unknown as { userData: { tile: number } }).userData.tile = 1;
  return m;
}

function windowFrame(b: WorldBuilder, m: Mats, cx: number, z: number, w: number, bottom: number, top: number, _axis: 'z') {
  const h = top - bottom, y = (bottom + top) / 2;
  const fm = m.plastic;
  b.box(w, 0.06, 0.12, cx, bottom + 0.03, z - 0.02, fm, { occluder: false });
  b.box(w, 0.06, 0.12, cx, top - 0.03, z - 0.02, fm, { occluder: false });
  b.box(0.06, h, 0.12, cx - w / 2 + 0.03, y, z - 0.02, fm, { occluder: false });
  b.box(0.06, h, 0.12, cx + w / 2 - 0.03, y, z - 0.02, fm, { occluder: false });
  b.box(0.05, h, 0.1, cx, y, z - 0.02, fm, { occluder: false });
  b.box(w + 0.2, 0.03, 0.3, cx, bottom - 0.01, z - 0.25, m.plastic, { occluder: false }); // sill
  // glass panes get their rain shader from outside.ts (registered via userData)
  const g = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, h - 0.1), m.glass);
  g.position.set(cx, y, z - 0.02);
  g.userData.windowGlass = true;
  b.root.add(g);
}

function radiator(b: WorldBuilder, m: Mats, cx: number, z: number, w: number) {
  const n = Math.floor(w / 0.08);
  for (let i = 0; i < n; i++) b.box(0.06, 0.5, 0.08, cx - w / 2 + 0.04 + i * 0.08, 0.45, z, m.radiator, { occluder: false });
  b.box(w, 0.04, 0.04, cx, 0.22, z, m.radiator, { occluder: false });
  b.box(w, 0.04, 0.04, cx, 0.68, z, m.radiator, { occluder: false });
}

function shadeLamp(b: WorldBuilder, m: Mats, x: number, z: number) {
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.26, 0.2, 18, 1, true), m.shade);
  s.position.set(x, H - 0.2, z);
  b.root.add(s);
  b.box(0.01, 0.12, 0.01, x, H - 0.06, z, m.blackPlastic, { occluder: false });
}

function doorFrame(b: WorldBuilder, m: Mats, x: number, z: number, w: number, alongX: boolean) {
  const fm = m.plastic;
  const h = 2.08;
  for (const s of [-1, 1]) {
    if (alongX) b.box(0.05, h, 0.16, x + s * (w / 2 + 0.025), h / 2, z, fm, { occluder: false });
    else b.box(0.16, h, 0.05, x, h / 2, z + s * (w / 2 + 0.025), fm, { occluder: false });
  }
  if (alongX) b.box(w + 0.1, 0.05, 0.16, x, h + 0.02, z, fm, { occluder: false });
  else b.box(0.16, 0.05, w + 0.1, x, h + 0.02, z, fm, { occluder: false });
}

function switchPlate(b: WorldBuilder, m: Mats, x: number, y: number, z: number, face: 'x+' | 'x-') {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(boxGeo(0.02, 0.09, 0.07), m.plastic);
  const key = new THREE.Mesh(boxGeo(0.014, 0.05, 0.035), m.plastic);
  key.position.x = face === 'x+' ? 0.012 : -0.012;
  key.rotation.z = 0.15;
  g.add(plate, key);
  g.position.set(x, y, z);
  b.root.add(g);
  g.userData.key = key;
  return g;
}

function photoTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 170;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 170);
  g.addColorStop(0, '#7f8a92');
  g.addColorStop(1, '#3e4448');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 170);
  x.fillStyle = '#2a2d30';
  x.fillRect(0, 120, 128, 50); // balcony rail
  // two figures
  x.fillStyle = '#1e2124';
  x.beginPath();
  x.arc(44, 62, 13, 0, Math.PI * 2);
  x.fill();
  x.fillRect(28, 76, 32, 60);
  x.fillStyle = '#3a3330';
  x.beginPath();
  x.arc(86, 66, 12, 0, Math.PI * 2);
  x.fill();
  x.fillRect(72, 79, 28, 56);
  x.fillStyle = '#6a5a48';
  x.fillRect(74, 56, 24, 18); // hair
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function polaroidTexture() {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 116;
  const x = c.getContext('2d')!;
  x.fillStyle = '#e9e4d6';
  x.fillRect(0, 0, 96, 116);
  x.fillStyle = '#1a1714';
  x.fillRect(8, 8, 80, 80);
  x.fillStyle = '#3a2c24';
  x.fillRect(30, 18, 36, 70); // the door
  x.fillStyle = '#9a8a6a';
  x.fillRect(58, 52, 4, 4);
  x.fillStyle = '#333';
  x.font = '11px monospace';
  x.fillText('03:17', 30, 106);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function calendarTexture() {
  const c = document.createElement('canvas');
  c.width = 180;
  c.height = 250;
  const x = c.getContext('2d')!;
  x.fillStyle = '#e8e2d2';
  x.fillRect(0, 0, 180, 250);
  x.fillStyle = '#4a5560';
  x.fillRect(0, 0, 180, 90);
  x.fillStyle = '#c9c0a8';
  x.font = 'bold 22px serif';
  x.fillText('ОКТЯБРЬ', 34, 120);
  x.font = '12px sans-serif';
  x.fillStyle = '#333';
  let d = 1;
  for (let r = 0; r < 5; r++)
    for (let k = 0; k < 7; k++) {
      const dd = r * 7 + k - 2;
      if (dd >= 1 && dd <= 31) {
        x.fillText(String(dd), 12 + k * 23, 148 + r * 20);
        if (dd === 14) {
          x.strokeStyle = '#4a3a2a';
          x.lineWidth = 2;
          x.beginPath();
          x.ellipse(18 + k * 23, 143 + r * 20, 12, 9, 0, 0, Math.PI * 2);
          x.stroke();
        }
      }
      d++;
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let _glow: THREE.Texture | null = null;
function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}
