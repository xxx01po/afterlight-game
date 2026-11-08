import * as THREE from 'three';
import { Kit } from './kit';
import type { MatLib, MatName } from './materials';
import { rng } from '@/utils/math';

/** Library of procedural furniture, machinery and vehicles. Local origin = floor centre. */

export function table(M: MatLib, w = 1.2, d = 0.7, h = 0.76, mat: MatName = 'planksDark') {
  const k = new Kit(M);
  k.box(mat, w, 0.04, d, 0, h - 0.02, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(mat, 0.05, h - 0.04, 0.05, sx * (w / 2 - 0.06), (h - 0.04) / 2, sz * (d / 2 - 0.06));
  k.box(mat, w - 0.15, 0.08, 0.02, 0, h - 0.1, d / 2 - 0.07);
  return k;
}

export function chair(M: MatLib, mat: MatName = 'planksDark') {
  const k = new Kit(M);
  k.box(mat, 0.42, 0.04, 0.42, 0, 0.45, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(mat, 0.035, 0.45, 0.035, sx * 0.18, 0.225, sz * 0.18);
  for (const sx of [-1, 1]) k.box(mat, 0.035, 0.5, 0.035, sx * 0.18, 0.72, -0.19);
  k.box(mat, 0.4, 0.12, 0.025, 0, 0.88, -0.19);
  return k;
}

export function bed(M: MatLib) {
  const k = new Kit(M);
  k.box('mattress', 0.85, 0.14, 1.9, 0, 0.5, 0);
  k.box('fabricBlue', 0.86, 0.04, 1.2, 0, 0.59, 0.3, 0.02, 0, 0.01);
  for (const z of [-0.95, 0.95]) {
    k.box('metalGrey', 0.9, 0.04, 0.04, 0, 0.42, z);
    for (const x of [-0.43, 0.43]) k.cyl('metalGrey', 0.02, 0.02, z < 0 ? 0.95 : 0.7, x, z < 0 ? 0.47 : 0.35, z, 6);
    k.box('metalGrey', 0.88, 0.03, 0.03, 0, z < 0 ? 0.92 : 0.68, z);
  }
  for (const x of [-0.43, 0.43]) k.box('metalGrey', 0.03, 0.03, 1.9, x, 0.42, 0);
  return k;
}

export function wardrobeBody(M: MatLib, w = 0.9, h = 1.9, d = 0.55, mat: MatName = 'planksDark') {
  const k = new Kit(M);
  k.box(mat, w, h, 0.03, 0, h / 2, -d / 2 + 0.015);
  k.box(mat, 0.03, h, d, -w / 2 + 0.015, h / 2, 0);
  k.box(mat, 0.03, h, d, w / 2 - 0.015, h / 2, 0);
  k.box(mat, w, 0.03, d, 0, h - 0.015, 0);
  k.box(mat, w, 0.1, d, 0, 0.05, 0);
  k.box(mat, w - 0.06, 0.02, d - 0.04, 0, h * 0.7, 0);
  return k;
}

export function shelf(M: MatLib, seed: number, w = 1.2, h = 1.8, d = 0.35, mat: MatName = 'planks') {
  const R = rng(seed);
  const k = new Kit(M);
  for (const x of [-w / 2, w / 2]) k.box(mat, 0.03, h, d, x, h / 2, 0);
  for (let i = 0; i < 4; i++) {
    const y = 0.1 + i * ((h - 0.15) / 3);
    k.box(mat, w, 0.025, d, 0, y, 0);
    if (i < 3)
      for (let j = 0; j < 4; j++) {
        if (R() < 0.35) continue;
        const bw = 0.12 + R() * 0.2, bh = 0.1 + R() * 0.22;
        const mats: MatName[] = ['fabric', 'paper', 'metalGrey', 'planksGrey', 'fabricBlue'];
        k.box(mats[Math.floor(R() * mats.length)], bw, bh, d * 0.7, -w / 2 + 0.15 + j * (w / 4) + R() * 0.05, y + bh / 2 + 0.015, 0, 0, 0, (R() - 0.5) * 0.2);
      }
  }
  return k;
}

export function stove(M: MatLib) {
  const k = new Kit(M);
  k.box('concrete', 1.6, 1.4, 1.8, 0, 0.7, 0);
  k.box('concrete', 1.2, 0.7, 1.4, 0.2, 1.75, -0.2);
  k.box('concreteDark', 0.5, 0.35, 0.05, 0, 0.75, 0.91);
  k.box('black', 0.42, 0.28, 0.02, 0, 0.75, 0.93);
  k.box('concrete', 0.45, 1.2, 0.45, 0.3, 2.7, -0.3);
  return k;
}

export function locker(M: MatLib) {
  const k = new Kit(M);
  k.box('metalBlue', 0.6, 1.8, 0.5, 0, 0.9, 0);
  for (let i = 0; i < 4; i++) k.box('black', 0.3, 0.015, 0.01, 0, 1.55 + i * 0.04, 0.255);
  k.box('metalGrey', 0.02, 0.12, 0.02, 0.24, 1.0, 0.26);
  k.box('black', 0.005, 1.78, 0.012, 0, 0.9, 0.252);
  return k;
}

export function metalCabinet(M: MatLib, w = 0.9, h = 1.9) {
  const k = new Kit(M);
  k.box('metalWhite', w, h, 0.45, 0, h / 2, 0);
  k.box('black', 0.006, h - 0.1, 0.01, 0, h / 2, 0.227);
  for (const x of [-0.06, 0.06]) k.box('metalGrey', 0.015, 0.14, 0.02, x, h * 0.55, 0.235);
  return k;
}

export function labTable(M: MatLib, w = 1.8) {
  const k = new Kit(M);
  k.box('metalWhite', w, 0.05, 0.8, 0, 0.9, 0);
  k.box('tilesLab', w - 0.02, 0.02, 0.78, 0, 0.935, 0);
  k.box('metalWhite', 0.5, 0.85, 0.75, -w / 2 + 0.27, 0.43, 0);
  for (const sx of [1]) for (const sz of [-1, 1]) k.box('metalGrey', 0.04, 0.88, 0.04, sx * (w / 2 - 0.05), 0.44, sz * 0.35);
  return k;
}

export function gurney(M: MatLib) {
  const k = new Kit(M);
  k.box('metalGrey', 0.7, 0.04, 1.9, 0, 0.8, 0);
  k.box('mattress', 0.66, 0.06, 1.85, 0, 0.85, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.cyl('metalGrey', 0.02, 0.02, 0.72, sx * 0.3, 0.42, sz * 0.85, 6);
    k.cyl('rubber', 0.05, 0.05, 0.04, sx * 0.3, 0.05, sz * 0.85, 8, 0, 0, Math.PI / 2);
  }
  return k;
}

export function restraintChair(M: MatLib) {
  const k = new Kit(M);
  k.box('metalGrey', 0.6, 0.06, 0.6, 0, 0.5, 0);
  k.box('metalGrey', 0.6, 1.0, 0.06, 0, 1.0, -0.3);
  k.box('metalGrey', 0.3, 0.3, 0.05, 0, 1.6, -0.3);
  for (const sx of [-1, 1]) {
    k.box('metalGrey', 0.06, 0.04, 0.55, sx * 0.3, 0.75, 0);
    k.box('metalGrey', 0.05, 0.25, 0.05, sx * 0.3, 0.62, 0.25);
    k.box('fabric', 0.09, 0.03, 0.08, sx * 0.3, 0.78, 0.1); // leather straps
  }
  k.cyl('metalGrey', 0.05, 0.05, 0.5, 0, 0.25, 0, 8);
  k.box('metalGrey', 0.6, 0.03, 0.6, 0, 0.015, 0);
  // head cap with wires
  k.sphere('metalWhite', 0.16, 0, 1.75, -0.18, 10);
  for (let i = 0; i < 6; i++) k.cyl('black', 0.008, 0.008, 1.4, -0.15 + i * 0.06, 1.2, -0.45, 4, 0.4, 0, 0);
  return k;
}

export function crate(M: MatLib, s = 0.6, mat: MatName = 'planks') {
  const k = new Kit(M);
  k.box(mat, s, s, s, 0, s / 2, 0);
  for (const y of [0.03, s - 0.03]) for (const z of [-1, 1]) k.box('planksDark', s + 0.01, 0.06, 0.03, 0, y, z * (s / 2));
  return k;
}

export function barrel(M: MatLib) {
  const k = new Kit(M);
  k.cyl('metalRust', 0.29, 0.29, 0.88, 0, 0.44, 0, 14);
  for (const y of [0.25, 0.63]) k.cyl('metalRust', 0.3, 0.3, 0.03, 0, y, 0, 14);
  return k;
}

export function lampPost(M: MatLib, arm = 1.4, h = 6) {
  const k = new Kit(M);
  k.cyl('concreteDark', 0.13, 0.09, h, 0, h / 2, 0, 8);
  k.box('metalGrey', 0.06, 0.06, arm, 0, h - 0.2, arm / 2, 0.15, 0, 0);
  k.box('metalGrey', 0.3, 0.12, 0.5, 0, h - 0.18, arm, 0, 0, 0);
  const bulb = k.box('bulbOff', 0.22, 0.03, 0.36, 0, h - 0.255, arm);
  bulb.name = 'bulb';
  return { kit: k, light: new THREE.Vector3(0, h - 0.45, arm) };
}

export function woodPole(M: MatLib, h = 7.5) {
  const k = new Kit(M);
  k.cyl('barkDead', 0.14, 0.11, h, 0, h / 2, 0, 7);
  k.box('planksDark', 1.4, 0.1, 0.1, 0, h - 0.5, 0);
  for (const x of [-0.6, 0, 0.6]) k.cyl('glassDirty', 0.04, 0.03, 0.1, x, h - 0.4, 0, 6);
  return k;
}

export function generator(M: MatLib) {
  const k = new Kit(M);
  k.box('metalGrey', 2.2, 0.15, 1.0, 0, 0.075, 0); // skid
  k.box('metalGreen', 1.2, 0.8, 0.85, -0.4, 0.55, 0); // engine
  k.cyl('metalGreen', 0.38, 0.38, 0.9, 0.62, 0.55, 0, 16, 0, 0, Math.PI / 2); // alternator
  k.box('metalGreen', 0.8, 0.28, 0.5, -0.4, 1.09, 0); // fuel tank
  k.cyl('metalGrey', 0.07, 0.07, 0.05, -0.4, 1.26, 0.1, 10); // filler cap
  k.cyl('metalRust', 0.05, 0.05, 0.9, -0.85, 1.3, -0.3, 8); // exhaust
  k.box('metalGrey', 0.4, 0.45, 0.06, 0.62, 0.75, 0.45); // control panel
  k.box('black', 0.3, 0.12, 0.01, 0.62, 0.85, 0.485);
  k.cyl('metalGrey', 0.03, 0.03, 0.1, -0.95, 0.7, 0.3, 8, 0, 0, Math.PI / 2); // pull start
  return k;
}

export function radioStation(M: MatLib) {
  const k = new Kit(M);
  k.box('metalGrey', 0.52, 0.18, 0.34, 0, 0.09, 0);
  k.box('black', 0.48, 0.1, 0.01, 0, 0.1, 0.171);
  for (let i = 0; i < 4; i++) k.cyl('black', 0.018, 0.018, 0.025, -0.18 + i * 0.07, 0.06, 0.18, 8, Math.PI / 2);
  k.box('black', 0.07, 0.11, 0.05, 0.32, 0.06, 0.05); // handset
  k.cyl('black', 0.006, 0.004, 0.5, 0.2, 0.43, -0.1, 4); // antenna
  const led = k.box('redLed', 0.015, 0.015, 0.01, 0.2, 0.15, 0.172);
  led.name = 'led';
  return k;
}

export function crtMonitor(M: MatLib) {
  const k = new Kit(M);
  k.box('metalWhite', 0.42, 0.36, 0.38, 0, 0.18, -0.04);
  k.box('metalWhite', 0.3, 0.26, 0.15, 0, 0.18, -0.29);
  return k;
}

export function electricPanel(M: MatLib, w = 0.6, h = 0.8) {
  const k = new Kit(M);
  k.box('metalGrey', w, h, 0.18, 0, h / 2, 0);
  k.box('black', w - 0.08, 0.02, 0.01, 0, h * 0.85, 0.091);
  k.box('metalRust', 0.04, 0.04, 0.05, w / 2 - 0.06, h * 0.5, 0.1);
  return k;
}

/** Generic old cab-over van, rusted and abandoned. */
export function van(M: MatLib, seed: number, broken = true) {
  const R = rng(seed);
  const k = new Kit(M);
  const paint: MatName = R() > 0.5 ? 'metalGreen' : 'metalBlue';
  k.box(paint, 1.9, 1.25, 4.3, 0, 1.15, 0);
  k.box(paint, 1.86, 0.55, 1.2, 0, 2.0, 1.4); // cab roof part with windows
  k.box(paint, 1.86, 0.5, 3.1, 0, 1.97, -0.6);
  k.box('glassDirty', 1.6, 0.48, 0.02, 0, 2.0, 2.16, -0.12);
  for (const sx of [-1, 1]) {
    k.box('glassDirty', 0.02, 0.4, 0.8, sx * 0.94, 2.0, 1.4);
    for (let i = 0; i < 3; i++) k.box('glassDirty', 0.02, 0.36, 0.7, sx * 0.94, 1.98, 0.35 - i * 0.95);
  }
  k.box('metalGrey', 1.9, 0.18, 0.12, 0, 0.62, 2.2); // bumper
  for (const sx of [-1, 1]) k.cyl('glassDirty', 0.09, 0.09, 0.05, sx * 0.62, 1.05, 2.16, 10, Math.PI / 2);
  for (const sx of [-1, 1]) for (const z of [1.35, -1.35]) {
    const flat = broken && R() < 0.5;
    k.cyl('rubber', 0.38, 0.38, 0.25, sx * 0.86, flat ? 0.28 : 0.38, z, 14, 0, 0, Math.PI / 2);
    k.cyl('metalGrey', 0.2, 0.2, 0.27, sx * 0.86, flat ? 0.28 : 0.38, z, 10, 0, 0, Math.PI / 2);
  }
  k.box('metalRust', 1.7, 0.1, 4.0, 0, 0.5, 0);
  return k;
}

/** Old flatbed truck cab (front half) with an empty frame. */
export function truck(M: MatLib) {
  const k = new Kit(M);
  k.box('metalRust', 2.3, 0.2, 6, 0, 0.9, -0.8); // frame
  k.box('metalGreen', 2.3, 1.1, 1.8, 0, 1.6, 1.6); // cab
  k.box('metalGreen', 2.2, 0.8, 1.6, 0, 2.5, 1.5);
  k.box('glassDirty', 2.0, 0.6, 0.02, 0, 2.5, 2.31, -0.08);
  k.box('metalGreen', 2.0, 0.9, 1.4, 0, 1.4, 3.1); // hood
  k.box('metalGrey', 1.6, 0.7, 0.05, 0, 1.4, 3.82); // grille
  for (const sx of [-1, 1]) {
    k.box('metalGreen', 0.4, 0.15, 1.2, sx * 1.15, 1.25, 3.0); // fenders
    for (const z of [3.0, -1.0, -2.4]) k.cyl('rubber', 0.52, 0.52, 0.3, sx * 1.0, 0.52, z, 14, 0, 0, Math.PI / 2);
  }
  // rotten wooden bed
  k.box('planksGrey', 2.4, 0.06, 3.8, 0, 1.05, -1.8);
  k.box('planksGrey', 0.05, 0.5, 3.8, -1.18, 1.3, -1.8);
  return k;
}

export function barrier(M: MatLib) {
  const k = new Kit(M);
  k.box('metalGrey', 0.3, 1.0, 0.3, 0, 0.5, 0);
  for (let i = 0; i < 8; i++) k.box(i % 2 ? 'metalWhite' : 'metalRust', 0.6, 0.09, 0.09, 0.4 + i * 0.6, 0.95, 0);
  k.box('metalGrey', 0.15, 0.8, 0.15, 5.2, 0.4, 0);
  return k;
}

export function signBoard(M: MatLib, tex: THREE.Texture, w: number, h: number, post = 1.2) {
  const k = new Kit(M);
  if (post > 0) for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) k.box('metalGrey', 0.05, post + h, 0.05, x, (post + h) / 2, -0.03);
  const mat = new THREE.MeshLambertMaterial({ map: tex });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(0, post + h / 2, 0);
  k.g.add(m);
  return k;
}

export function woodPile(M: MatLib, seed: number) {
  const R = rng(seed);
  const k = new Kit(M);
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 6 - row; i++) k.cyl('barkPine', 0.13, 0.13, 1.4 + R() * 0.2, (i - (5 - row) / 2) * 0.27, 0.13 + row * 0.24, 0, 7, Math.PI / 2, (R() - 0.5) * 0.1);
  return k;
}

export function tire(M: MatLib) {
  const k = new Kit(M);
  k.geo('rubber', new THREE.TorusGeometry(0.3, 0.12, 8, 14), 0, 0.12, 0, Math.PI / 2);
  return k;
}

export function cage(M: MatLib, w = 2, h = 2.2, d = 2) {
  const k = new Kit(M);
  for (let i = 0; i <= 10; i++) {
    const x = -w / 2 + (i / 10) * w;
    k.cyl('metalGrey', 0.012, 0.012, h, x, h / 2, d / 2, 4);
  }
  k.box('metalGrey', w, 0.05, 0.05, 0, h, d / 2);
  k.box('metalGrey', w, 0.05, 0.05, 0, 0.05, d / 2);
  return k;
}

export function pallet(M: MatLib) {
  const k = new Kit(M);
  for (let i = 0; i < 5; i++) k.box('planksGrey', 0.12, 0.022, 1.2, -0.4 + i * 0.2, 0.13, 0);
  for (const x of [-0.45, 0, 0.45]) k.box('planksGrey', 0.1, 0.1, 1.2, x, 0.06, 0);
  return k;
}
