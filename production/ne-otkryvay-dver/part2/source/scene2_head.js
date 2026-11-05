// «НЕ ОТКРЫВАЙ ДВЕРЬ» — Roblox-style horror short. Deterministic per-frame renderer.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const W = 1080, H = 1920, FPS = 30;
const params = new URLSearchParams(location.search);
const SCALE = parseFloat(params.get('scale') || '1');

// ---------- utils ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = k => k * k * (3 - 2 * k);
const easeOut = k => 1 - Math.pow(1 - k, 3);
const easeIn = k => k * k * k;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const vlerp = (a, b, k) => a.clone().lerp(b, k);
function noise1(x, s = 0) { // smooth deterministic noise in [-1,1]
  return (Math.sin(x * 1.7 + s) * 0.5 + Math.sin(x * 3.1 + s * 2.3) * 0.3 + Math.sin(x * 7.3 + s * 4.1) * 0.2);
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
// multi-key interpolation: keys = [[t, value], ...]
function keys(t, ks, fn = ease) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 0; i < ks.length - 1; i++) {
    const [t0, v0] = ks[i], [t1, v1] = ks[i + 1];
    if (t <= t1) { const k = fn(seg(t, t0, t1)); return typeof v0 === 'number' ? lerp(v0, v1, k) : vlerp(v0, v1, k); }
  }
  return ks[ks.length - 1][1];
}

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W * SCALE, H * SCALE);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.55;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const out = document.createElement('canvas');
out.width = W; out.height = H;
document.body.appendChild(out);
const ctx = out.getContext('2d');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070c);
scene.fog = new THREE.FogExp2(0x070a14, 0.07);

const cam = new THREE.PerspectiveCamera(50, W / H, 0.02, 40);
const videoCam = new THREE.PerspectiveCamera(72, W / H, 0.02, 40);
videoCam.layers.enable(2); // sees the double
const rtVideo = new THREE.WebGLRenderTarget(540, 960, { colorSpace: THREE.SRGBColorSpace });

// ---------- materials / textures ----------
const M = (c, r = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0, ...extra });
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const wallTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#3a4258'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(255,255,255,0.035)'; g.fillRect(x, 0, 14, h); }
  const r = rng(7); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.06})`; g.fillRect(r() * w, r() * h, 2, 2); }
}, [6, 3]);
const floorTex = canvasTex(512, 512, (g, w, h) => {
  const r = rng(3);
  for (let y = 0; y < 8; y++) {
    const off = (y % 2) * 128;
    for (let x = -1; x < 3; x++) {
      const l = 30 + r() * 10; g.fillStyle = `hsl(24,32%,${l}%)`; g.fillRect(x * 256 + off, y * 64, 256, 64);
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x * 256 + off, y * 64, 3, 64);
    }
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, y * 64, w, 3);
  }
}, [3, 4]);
const woodTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#5a3a24'; g.fillRect(0, 0, w, h);
  const r = rng(11); for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(30,15,5,${0.15 + r() * 0.2})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const y = r() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + r() * 8 - 4, w * 0.6, y + r() * 8 - 4, w, y + r() * 6 - 3); g.stroke(); }
});

const matWall = M(0xffffff, 0.92, { map: wallTex });
const matFloor = M(0xffffff, 0.8, { map: floorTex });
const matWood = M(0xffffff, 0.65, { map: woodTex });
const matDark = M(0x1b1d24, 0.8);
const matTrim = M(0xc9ccd6, 0.6);

function box(w, h, d, mat, r = 0.02, seg = 2) {
  const m = new THREE.Mesh(r > 0 ? new RoundedBoxGeometry(w, h, d, seg, r) : new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true; m.receiveShadow = true; return m;
}
function add(parent, m, x, y, z) { m.position.set(x, y, z); parent.add(m); return m; }

// ---------- ROOM (fixed layout, never changes) ----------
// x: -2.1..2.1, z: -2.6 (door wall) .. 2.6 (mirror wall), y: 0..3.0
const RX = 2.1, RZ = 2.6, RH = 3.0;
const room = new THREE.Group(); scene.add(room);
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, RZ * 2), matFloor);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; room.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, RZ * 2), M(0x2a2f3c, 0.95));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = RH; room.add(ceil);
  const mkWall = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, RH), matWall); m.position.set(x, RH / 2, z); m.rotation.y = ry; m.receiveShadow = true; room.add(m); return m; };
  const piece = (x0, x1, y0, y1, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), matWall); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); m.rotation.y = ry; m.receiveShadow = true; room.add(m); };
  // back wall with a doorway (x -0.63..0.33, y 0..2.04)
  piece(-RX, -0.63, 0, RH, -RZ, 0); piece(0.33, RX, 0, RH, -RZ, 0); piece(-0.63, 0.33, 2.04, RH, -RZ, 0);
  // front wall with the mirror opening (x -0.3..0.7, y 0.2..2.8)
  piece(-RX, -0.3, 0, RH, RZ, Math.PI); piece(0.7, RX, 0, RH, RZ, Math.PI); piece(-0.3, 0.7, 0, 0.2, RZ, Math.PI); piece(-0.3, 0.7, 2.8, RH, RZ, Math.PI);
  mkWall(RZ * 2, -RX, 0, Math.PI / 2); mkWall(RZ * 2, RX, 0, -Math.PI / 2);
  // baseboards
  add(room, box(0.03, 0.12, RZ * 2, matTrim, 0), -RX + 0.015, 0.06, 0);
  add(room, box(0.03, 0.12, RZ * 2, matTrim, 0), RX - 0.015, 0.06, 0);
  // ceiling lamp (off)
  add(room, box(0.5, 0.06, 0.5, M(0x9aa0ad, 0.5), 0.02), 0, RH - 0.03, 0);
}

// DOOR on back wall
const DOOR_X = -0.15;
const doorGroup = new THREE.Group(); doorGroup.position.set(DOOR_X, 0, -RZ); room.add(doorGroup);
const doorSlab = new THREE.Group(); doorGroup.add(doorSlab);
{
  const frameMat = M(0x3b2618, 0.6);
  add(doorGroup, box(0.1, 2.18, 0.08, frameMat, 0.01), -0.53, 1.09, 0.03);
  add(doorGroup, box(0.1, 2.18, 0.08, frameMat, 0.01), 0.53, 1.09, 0.03);
  add(doorGroup, box(1.16, 0.1, 0.08, frameMat, 0.01), 0, 2.13, 0.03);
  const slab = add(doorSlab, box(0.96, 2.04, 0.05, matWood, 0.01), 0, 1.04, 0.02);
  // panels
  for (const [y, h] of [[1.55, 0.7], [0.55, 0.7]]) for (const x of [-0.21, 0.21]) add(doorSlab, box(0.32, h, 0.015, M(0x4a2f1d, 0.6), 0.005), x, y, 0.05);
  // handle
  const hm = M(0xb8b8c0, 0.3, { metalness: 0.9 });
  add(doorSlab, box(0.06, 0.12, 0.02, hm, 0.005), 0.38, 1.0, 0.055);
  const lever = add(doorSlab, box(0.13, 0.025, 0.025, hm, 0.01), 0.33, 1.0, 0.085);
  doorSlab.userData.lever = lever;
}
// light gap under door (feet shadows animate here)
const gapCanvas = document.createElement('canvas'); gapCanvas.width = 256; gapCanvas.height = 8;
const gapTex = new THREE.CanvasTexture(gapCanvas); gapTex.colorSpace = THREE.SRGBColorSpace;
const gap = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.022), new THREE.MeshBasicMaterial({ map: gapTex, toneMapped: false }));
gap.position.set(DOOR_X, 0.011, -RZ + 0.046); room.add(gap);
const floorGlowCanvas = document.createElement('canvas'); floorGlowCanvas.width = 256; floorGlowCanvas.height = 128;
const floorGlowTex = new THREE.CanvasTexture(floorGlowCanvas); floorGlowTex.colorSpace = THREE.SRGBColorSpace;
const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: floorGlowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
floorGlow.rotation.x = -Math.PI / 2; floorGlow.position.set(DOOR_X, 0.004, -RZ + 0.35); room.add(floorGlow);
function drawGap(on, feet, feetX) {
  const g = gapCanvas.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 8);
  if (on > 0) {
    g.fillStyle = `rgba(255,${170},${90},${on})`; g.fillRect(0, 0, 256, 8);
    if (feet > 0) { g.fillStyle = `rgba(0,0,0,${feet})`; g.fillRect(70 + feetX, 0, 42, 8); g.fillRect(140 + feetX, 0, 42, 8); }
  }
  gapTex.needsUpdate = true;
  const f = floorGlowCanvas.getContext('2d');
  f.clearRect(0, 0, 256, 128);
  if (on > 0) {
    const gr = f.createRadialGradient(128, 0, 4, 128, 0, 120);
    gr.addColorStop(0, `rgba(255,150,70,${0.55 * on})`); gr.addColorStop(1, 'rgba(255,150,70,0)');
    f.fillStyle = gr; f.fillRect(0, 0, 256, 128);
    if (feet > 0) { // shadow wedges of the feet
      f.fillStyle = `rgba(0,0,0,${0.9 * feet})`;
      for (const fx of [70, 140]) { f.beginPath(); f.moveTo(fx + feetX + 8, 0); f.lineTo(fx + feetX + 34, 0); f.lineTo(fx + feetX + 60, 128); f.lineTo(fx + feetX - 18, 128); f.fill(); }
    }
  }
  floorGlowTex.needsUpdate = true;
}

// WINDOW on right wall
{
  const win = new THREE.Group(); win.position.set(RX - 0.01, 1.6, 1.25); win.rotation.y = -Math.PI / 2; room.add(win);
  const sky = canvasTex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a2c55'); gr.addColorStop(1, '#0a1226'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(210,225,255,0.95)'; g.beginPath(); g.arc(180, 70, 22, 0, 7); g.fill();
    g.fillStyle = '#050810'; for (let i = 0; i < 9; i++) { const x = i * 30, hh = 40 + (i * 37 % 60); g.fillRect(x, h - hh, 26, hh); }
  });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.2), new THREE.MeshBasicMaterial({ map: sky, toneMapped: false, color: 0x9fb4e8 }));
  win.add(pane);
  const fm = M(0xd8dbe4, 0.5);
  add(win, box(1.2, 0.06, 0.06, fm, 0.01), 0, 0.62, 0.02); add(win, box(1.2, 0.08, 0.1, fm, 0.01), 0, -0.62, 0.04);
  add(win, box(0.06, 1.3, 0.06, fm, 0.01), -0.58, 0, 0.02); add(win, box(0.06, 1.3, 0.06, fm, 0.01), 0.58, 0, 0.02);
  add(win, box(0.04, 1.2, 0.04, fm, 0.01), 0, 0, 0.02); add(win, box(1.1, 0.04, 0.04, fm, 0.01), 0, 0.05, 0.02);
  const cm = M(0x1f2a44, 0.95);
  add(win, box(0.32, 1.7, 0.06, cm, 0.02), -0.75, -0.1, 0.08); add(win, box(0.32, 1.7, 0.06, cm, 0.02), 0.75, -0.1, 0.08);
}

// BED along left wall (head toward mirror wall)
{
  const bed = new THREE.Group(); bed.position.set(-1.45, 0, 1.35); room.add(bed);
  add(bed, box(1.05, 0.32, 2.05, matWood, 0.02), 0, 0.2, 0);
  add(bed, box(1.0, 0.2, 1.98, M(0xdfe3ea, 0.9), 0.05), 0, 0.46, 0);
  add(bed, box(1.04, 0.1, 1.45, M(0x1d2b52, 0.95), 0.04), 0, 0.58, -0.27);
  add(bed, box(0.62, 0.14, 0.34, M(0xeef0f5, 0.95), 0.06), 0, 0.62, 0.78);
  add(bed, box(1.08, 0.95, 0.08, matWood, 0.02), 0, 0.48, 1.03);
}
// DESK + CHAIR + LAMP + CLOCK on right wall
const DESK_TOP = 0.76;
{
  const desk = new THREE.Group(); desk.position.set(1.72, 0, -0.15); room.add(desk);
  add(desk, box(0.7, 0.05, 1.3, matWood, 0.01), 0, DESK_TOP - 0.025, 0);
  for (const [x, z] of [[-0.3, -0.6], [0.3, -0.6], [-0.3, 0.6], [0.3, 0.6]]) add(desk, box(0.05, DESK_TOP - 0.05, 0.05, matDark, 0.005), x, (DESK_TOP - 0.05) / 2, z);
  // lamp (off)
  add(desk, box(0.14, 0.03, 0.14, matDark, 0.01), 0.18, DESK_TOP + 0.015, -0.45);
  add(desk, box(0.025, 0.4, 0.025, matDark, 0.005), 0.18, DESK_TOP + 0.2, -0.45);
  add(desk, box(0.16, 0.1, 0.16, M(0x2c3040, 0.5), 0.03), 0.1, DESK_TOP + 0.42, -0.45);
  // books
  add(desk, box(0.22, 0.05, 0.3, M(0x2f5d4a, 0.8), 0.005), 0.12, DESK_TOP + 0.025, 0.42);
  add(desk, box(0.2, 0.04, 0.28, M(0x6b2430, 0.8), 0.005), 0.13, DESK_TOP + 0.07, 0.43);
  // clock 3:17 (red LED accent)
  const clockTex = canvasTex(256, 96, (g, w, h) => { g.fillStyle = '#050505'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff2a2a'; g.font = 'bold 76px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('3:17', w / 2, h / 2 + 4); });
  const clock = new THREE.Group(); clock.position.set(0.2, DESK_TOP + 0.05, 0.05); clock.rotation.y = -Math.PI / 2; desk.add(clock);
  add(clock, box(0.2, 0.08, 0.06, matDark, 0.01), 0, 0, 0);
  const cf = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.065), new THREE.MeshBasicMaterial({ map: clockTex, toneMapped: false })); cf.position.z = 0.031; clock.add(cf);
  const clockLight = new THREE.PointLight(0xff2020, 0.06, 0.8, 2); clockLight.position.set(-0.1, 0.02, 0); clock.add(clockLight);
  // chair
  const chair = new THREE.Group(); chair.position.set(1.08, 0, -0.1); room.add(chair);
  add(chair, box(0.46, 0.05, 0.46, matDark, 0.02), 0, 0.46, 0);
  add(chair, box(0.06, 0.6, 0.46, matDark, 0.02), -0.24, 0.76, 0);
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) add(chair, box(0.04, 0.44, 0.04, matDark, 0.005), x, 0.22, z);
  // poster
  const posterTex = canvasTex(200, 280, (g, w, h) => { g.fillStyle = '#16233d'; g.fillRect(0, 0, w, h); g.fillStyle = '#c33'; g.fillRect(20, 30, 160, 110); g.fillStyle = '#e8e2d0'; g.font = 'bold 30px sans-serif'; g.fillText('SPACE', 40, 200); g.fillText('RACE', 52, 236); });
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), M(0xffffff, 0.9, { map: posterTex })); poster.position.set(RX - 0.012, 1.7, -0.6); poster.rotation.y = -Math.PI / 2; room.add(poster);
}

// MIRROR on front wall (z = +RZ), facing the door
const MIRROR = { x: 0.2, y: 1.5, w: 1.0, h: 2.6 };
const mirrorGroup = new THREE.Group(); mirrorGroup.position.set(MIRROR.x, MIRROR.y, RZ - 0.03); mirrorGroup.rotation.y = Math.PI; room.add(mirrorGroup);
const reflector = new Reflector(new THREE.PlaneGeometry(MIRROR.w, MIRROR.h), { textureWidth: 720 * SCALE, textureHeight: 1440 * SCALE, color: 0x9aa3b5, clipBias: 0.003 });
reflector.camera.layers.enable(1); // the figure exists only here
mirrorGroup.add(reflector);
{
  const fm = M(0x20140c, 0.55);
  add(mirrorGroup, box(MIRROR.w + 0.14, 0.08, 0.06, fm, 0.01), 0, MIRROR.h / 2 + 0.04, 0.0);
  add(mirrorGroup, box(MIRROR.w + 0.14, 0.08, 0.06, fm, 0.01), 0, -MIRROR.h / 2 - 0.04, 0.0);
  add(mirrorGroup, box(0.08, MIRROR.h + 0.16, 0.06, fm, 0.01), -MIRROR.w / 2 - 0.04, 0, 0.0);
  add(mirrorGroup, box(0.08, MIRROR.h + 0.16, 0.06, fm, 0.01), MIRROR.w / 2 + 0.04, 0, 0.0);
}
// crack overlay
const crackCanvas = document.createElement('canvas'); crackCanvas.width = 512; crackCanvas.height = 1050;
const crackTex = new THREE.CanvasTexture(crackCanvas); crackTex.colorSpace = THREE.SRGBColorSpace;
const crackPlane = new THREE.Mesh(new THREE.PlaneGeometry(MIRROR.w, MIRROR.h), new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, depthWrite: false, toneMapped: false }));
crackPlane.position.z = 0.004; mirrorGroup.add(crackPlane);
const cracks = (() => {
  const r = rng(1337), list = [];
  const impacts = [[300, 360, 0.0], [190, 560, 0.35], [330, 700, 0.6]];
  for (const [cx, cy, t0] of impacts) {
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.4; let x = cx, y = cy; const pts = [[x, y]];
      const len = 120 + r() * 380; let ang = a;
      for (let s = 0; s < 14; s++) { ang += (r() - 0.5) * 0.5; x += Math.cos(ang) * len / 14; y += Math.sin(ang) * len / 14; pts.push([x, y]); }
      list.push({ pts, t0: t0 + r() * 0.15, dur: 0.25 + r() * 0.35, w: 1.2 + r() * 2.2 });
    }
    // concentric ring fragments
    for (let k = 1; k <= 2; k++) { const rad = 40 * k + r() * 20; const pts = []; for (let s = 0; s <= 20; s++) { const a = s / 20 * Math.PI * 2; pts.push([cx + Math.cos(a) * rad * (0.8 + r() * 0.4), cy + Math.sin(a) * rad * (0.8 + r() * 0.4)]); } list.push({ pts, t0: t0 + 0.1 * k, dur: 0.3, w: 1.4 }); }
  }
  return list;
})();
function drawCracks(p) { // p: seconds since crack start
  const g = crackCanvas.getContext('2d'); g.clearRect(0, 0, 512, 1050);
  if (p <= 0) { crackTex.needsUpdate = true; return; }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const c of cracks) {
    const k = clamp((p - c.t0) / c.dur); if (k <= 0) continue;
    const n = Math.max(2, Math.floor(c.pts.length * k));
    for (const [style, wmul] of [['rgba(0,0,0,0.6)', 2.6], ['rgba(215,228,255,0.7)', 1]]) {
      g.strokeStyle = style; g.lineWidth = c.w * wmul; g.beginPath(); g.moveTo(...c.pts[0]);
      for (let i = 1; i < n; i++) g.lineTo(...c.pts[i]); g.stroke();
    }
  }
  crackTex.needsUpdate = true;
}

// ---------- LIGHTS ----------
scene.add(new THREE.HemisphereLight(0x4a62a8, 0x10101a, 1.1));
const moon = new THREE.SpotLight(0x86a6ff, 80, 12, 1.05, 0.7, 1.5);
moon.position.set(3.6, 2.9, 1.25); moon.target.position.set(-0.4, 0.2, 0.3); scene.add(moon, moon.target);
moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); moon.shadow.bias = -0.0008; moon.shadow.radius = 4;
const fill = new THREE.PointLight(0x5a70b0, 4.0, 8, 1.3); fill.position.set(-0.6, 2.7, 0.4); scene.add(fill);
const hallLight = new THREE.PointLight(0xffa860, 1.2, 2.4, 1.6); hallLight.position.set(DOOR_X, 0.06, -RZ + 0.12); scene.add(hallLight);
const phoneLight = new THREE.PointLight(0xcfe6ff, 0.0, 1.6, 2); scene.add(phoneLight);
// cold light on the door wall behind the figure -> readable silhouette in the mirror
const figLight = new THREE.PointLight(0x7f98d8, 0, 3.2, 1.4); figLight.position.set(0.1, 1.9, -2.2); scene.add(figLight);

// walls: right wall must not block the moon spotlight -> walls don't cast shadows (planes default castShadow=false)

// ---------- AVATAR (Roblox-style) ----------
function drawFace(g, p) {
  g.clearRect(0, 0, 256, 256);
  const eyeY = 112 + p.ly * 3, gapX = 44;
  const eo = clamp(p.eye * (1 - p.blink), 0.05, 1.4);
  for (const side of [-1, 1]) {
    const ex = 128 + side * gapX;
    const bk = p.blackK !== undefined ? p.blackK : (p.black ? 1 : 0);
    if (bk >= 1) {
      g.fillStyle = '#000'; g.beginPath(); g.ellipse(ex, eyeY, 24, 30 * eo, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,40,60,0.85)'; g.lineWidth = 4; g.beginPath(); g.ellipse(ex, eyeY, 26, 32 * eo, 0, 0, 7); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(ex + 7 + p.lx * 6, eyeY - 9, 5, 0, 7); g.fill();
      continue;
    }
    g.fillStyle = '#fbfbf6'; g.strokeStyle = '#111'; g.lineWidth = 6;
    g.beginPath(); g.ellipse(ex, eyeY, 26, 32 * eo, 0, 0, 7); g.fill(); g.stroke();
    if (eo > 0.15) {
      g.save(); g.beginPath(); g.ellipse(ex, eyeY, 24, 30 * eo, 0, 0, 7); g.clip();
      g.fillStyle = '#121212'; g.beginPath(); g.arc(ex + p.lx * 10, eyeY + p.ly * 8, 17 * p.pupil, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + p.lx * 10 + 5 * p.pupil, eyeY + p.ly * 8 - 6 * p.pupil, 5 * p.pupil, 0, 7); g.fill();
      g.restore();
    }
    if (bk > 0) { g.fillStyle = `rgba(0,0,0,${bk})`; g.beginPath(); g.ellipse(ex, eyeY, 28, 34 * eo, 0, 0, 7); g.fill(); }
    // brows: worry raises inner end
    g.strokeStyle = '#111'; g.lineWidth = 11; g.lineCap = 'round';
    const by = eyeY - 44 - p.brow * 6, inner = p.brow * 16;
    g.beginPath(); g.moveTo(ex - side * 22, by + 4); g.lineTo(ex + side * 22, by - inner + (p.angry || 0) * 18); g.stroke();
  }
  // mouth
  g.fillStyle = '#1a0d0d'; g.strokeStyle = '#111'; g.lineWidth = 7; g.lineCap = 'round';
  if (p.mouth < 0.15) { g.beginPath(); g.moveTo(108, 186); g.quadraticCurveTo(128, 184 - (p.smile || 0) * -14, 148, 186); g.stroke(); }
  else { g.beginPath(); g.ellipse(128, 188, 12 + p.mouth * 6, 6 + p.mouth * 16, 0, 0, 7); g.fill(); }
}
function makeAvatar(layer) {
  const root = new THREE.Group();
  const skin = M(0xf2c94c, 0.55), hood = M(0xb5232b, 0.85), hoodD = M(0x84171e, 0.85), jeans = M(0x22365c, 0.85), shoe = M(0xe9e9e9, 0.6), hair = M(0x121216, 0.75), white = M(0xf2f2f2, 0.7);
  const hips = new THREE.Group(); hips.position.y = 0.68; root.add(hips);
  const torso = add(hips, box(0.64, 0.66, 0.32, hood, 0.04), 0, 0.33, 0);
  add(hips, box(0.42, 0.16, 0.02, hoodD, 0.01), 0, 0.14, 0.165);
  add(hips, box(0.025, 0.16, 0.012, white, 0.004), -0.07, 0.53, 0.168);
  add(hips, box(0.025, 0.16, 0.012, white, 0.004), 0.07, 0.53, 0.168);
  add(hips, box(0.52, 0.2, 0.14, hoodD, 0.05), 0, 0.62, -0.16);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.16, 0, 0); hips.add(leg);
    add(leg, box(0.31, 0.56, 0.31, jeans, 0.03), 0, -0.28, 0);
    add(leg, box(0.32, 0.12, 0.38, shoe, 0.03), 0, -0.62, 0.03);
    legs.push(leg);
    const arm = new THREE.Group(); arm.position.set(s * 0.475, 0.6, 0); hips.add(arm);
    add(arm, box(0.3, 0.5, 0.3, hood, 0.04), 0, -0.2, 0);
    add(arm, box(0.27, 0.15, 0.27, skin, 0.04), 0, -0.52, 0);
    arms.push(arm);
  }
  const neck = new THREE.Group(); neck.position.y = 0.66; hips.add(neck);
  const head = add(neck, box(0.44, 0.42, 0.42, skin, 0.1, 3), 0, 0.23, 0);
  const faceCanvas = document.createElement('canvas'); faceCanvas.width = faceCanvas.height = 256;
  const faceTex = new THREE.CanvasTexture(faceCanvas); faceTex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshStandardMaterial({ map: faceTex, transparent: true, roughness: 0.6 }));
  face.position.set(0, 0.22, 0.212); neck.add(face);
  // hair: messy blocks
  add(neck, box(0.48, 0.13, 0.47, hair, 0.04), 0, 0.47, -0.005);
  add(neck, box(0.48, 0.3, 0.1, hair, 0.03), 0, 0.33, -0.19);
  add(neck, box(0.18, 0.1, 0.08, hair, 0.03), -0.13, 0.4, 0.2).rotation.z = 0.25;
  add(neck, box(0.2, 0.09, 0.08, hair, 0.03), 0.08, 0.41, 0.2).rotation.z = -0.15;
  add(neck, box(0.08, 0.2, 0.4, hair, 0.03), -0.225, 0.36, -0.01);
  add(neck, box(0.08, 0.2, 0.4, hair, 0.03), 0.225, 0.36, -0.01);
  add(neck, box(0.14, 0.09, 0.14, hair, 0.03), 0.05, 0.55, -0.05).rotation.y = 0.5;
  root.traverse(o => o.layers.set(layer));
  return { root, hips, legs, arms, neck, head, face, faceCanvas, faceTex, torso };
}
const hero = makeAvatar(0); scene.add(hero.root);
const dup = makeAvatar(2); scene.add(dup.root);

// ---------- THE FIGURE (mirror-only, layer 1) ----------
const fig = (() => {
  const root = new THREE.Group();
  const black = M(0x040406, 0.95), smoke = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
  const hips = new THREE.Group(); hips.position.y = 1.2; root.add(hips);
  const parts = [];
  const P = (parent, w, h, d, x, y, z) => { const m = add(parent, box(w, h, d, black, 0.02), x, y, z); parts.push(m); const s = new THREE.Mesh(m.geometry, smoke); s.scale.set(1.12, 1.03, 1.12); m.add(s); return m; };
  const legs = [];
  for (const s of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(s * 0.09, 0, 0); hips.add(leg); P(leg, 0.11, 1.2, 0.11, 0, -0.6, 0); legs.push(leg); }
  const chest = new THREE.Group(); chest.rotation.x = 0.28; hips.add(chest);
  P(chest, 0.34, 0.86, 0.17, 0, 0.43, 0);
  const arms = [];
  for (const s of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(s * 0.22, 0.8, 0); chest.add(arm); P(arm, 0.08, 1.3, 0.08, 0, -0.65, 0); P(arm, 0.05, 0.22, 0.03, -0.02 * s, -1.38, 0.0); P(arm, 0.05, 0.25, 0.03, 0.02 * s, -1.4, 0.0); arms.push(arm); }
  const neck = new THREE.Group(); neck.position.y = 0.86; neck.rotation.x = 0.35; chest.add(neck);
  P(neck, 0.1, 0.16, 0.1, 0, 0.08, 0);
  const head = P(neck, 0.24, 0.42, 0.24, 0, 0.36, 0.02);
  const faceTex = canvasTex(128, 224, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.filter = 'blur(6px)';
    const gr = g.createRadialGradient(64, 100, 6, 64, 110, 64); gr.addColorStop(0, 'rgba(120,125,140,0.55)'); gr.addColorStop(1, 'rgba(60,60,70,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.95)'; g.beginPath(); g.ellipse(42, 92, 13, 18, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(86, 92, 13, 18, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(64, 160, 10, 26, 0, 0, 7); g.fill();
    g.filter = 'none'; g.shadowColor = '#cfe0ff'; g.shadowBlur = 8; g.fillStyle = 'rgba(240,245,255,1)'; g.beginPath(); g.arc(42, 94, 4, 0, 7); g.fill(); g.beginPath(); g.arc(86, 94, 4, 0, 7); g.fill();
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.23, 0.4), new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false }));
  face.position.set(0, 0.36, 0.145); neck.add(face);
  root.traverse(o => o.layers.set(1));
  return { root, hips, chest, arms, neck, legs, parts };
})();
scene.add(fig.root);

// ---------- PHONE ----------
const phone = new THREE.Group(); scene.add(phone);
const PH = { w: 0.075, h: 0.158 };
add(phone, box(PH.w, PH.h, 0.009, M(0x0c0c10, 0.3, { metalness: 0.4 }), 0.008), 0, 0, 0);
const screenCanvas = document.createElement('canvas'); screenCanvas.width = 400; screenCanvas.height = 840;
const screenTex = new THREE.CanvasTexture(screenCanvas); screenTex.colorSpace = THREE.SRGBColorSpace;
const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
const screen = new THREE.Mesh(new THREE.PlaneGeometry(PH.w - 0.006, PH.h - 0.008), screenMat); screen.position.z = 0.0047; phone.add(screen);

function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function wrapText(g, text, x, y, maxW, lh) {
  const lines = []; for (const para of text.split('\n')) { let line = ''; for (const w of para.split(' ')) { const test = line ? line + ' ' + w : w; if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; } lines.push(line); }
  lines.forEach((l, i) => g.fillText(l, x, y + i * lh)); return lines.length;
}
const MSG1 = 'НЕ ОТКРЫВАЙ ДВЕРЬ. ЭТО НЕ ТВОЯ МАМА.';
const MSG2 = 'НЕ ОТВЕЧАЙ ЕЙ. Я СЕРЬЁЗНО.';
function drawPhoneScreen(t) {
  const g = screenCanvas.getContext('2d'), w = 400, h = 840;
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  const font = (s, wgt = 700) => `${wgt} ${s}px Inter, "Noto Color Emoji", sans-serif`;
  if (t < 2.6) { // lock screen + notification
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0d1630'); gr.addColorStop(1, '#03050c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#dfe6ff'; g.textAlign = 'center'; g.font = font(92, 300); g.fillText('3:17', w / 2, 170);
    g.font = font(22, 500); g.fillText('четверг, 5 ноября', w / 2, 92);
    const pop = easeOut(seg(t, 0.0, 0.18));
    g.save(); g.globalAlpha = pop; g.translate(0, (1 - pop) * -30);
    g.fillStyle = 'rgba(40,44,60,0.92)'; rr(g, 18, 250, w - 36, 250, 26); g.fill();
    g.fillStyle = '#ff3b3b'; rr(g, 38, 272, 44, 44, 11); g.fill(); g.fillStyle = '#fff'; g.font = font(30, 800); g.fillText('?', 60, 305);
    g.textAlign = 'left'; g.font = font(24, 700); g.fillStyle = '#fff'; g.fillText('Неизвестный', 96, 302); g.fillStyle = '#9aa'; g.font = font(20, 500); g.fillText('сейчас', 300, 302);
    g.fillStyle = '#fff'; g.font = font(36, 900); wrapText(g, MSG1, 38, 360, w - 76, 44);
    g.restore();
  } else if (t < 12.4) { // chat
    g.fillStyle = '#0b0d14'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#161a26'; g.fillRect(0, 0, w, 110); g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(60, 66, 24, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = font(28, 800); g.textAlign = 'center'; g.fillText('?', 60, 76); g.textAlign = 'left'; g.font = font(24, 700); g.fillText('Неизвестный', 98, 64); g.fillStyle = '#8a8'; g.font = font(17, 500); g.fillText('в сети', 98, 90);
    const bubble = (y, text, k) => { g.save(); g.globalAlpha = k; g.fillStyle = '#262c3d'; rr(g, 22, y, 320, 150, 22); g.fill(); g.fillStyle = '#fff'; g.font = font(30, 900); wrapText(g, text, 40, y + 48, 290, 38); g.restore(); };
    bubble(150, MSG1, 1);
    if (t > 7.5) bubble(330, MSG2, easeOut(seg(t, 7.5, 7.7)));
    if (t > 12.0) { // incoming video message
      const k = easeOut(seg(t, 12.0, 12.2)); g.save(); g.globalAlpha = k; g.fillStyle = '#262c3d'; rr(g, 22, 510, 260, 260, 22); g.fill();
      g.fillStyle = '#000'; rr(g, 34, 522, 236, 236, 16); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(135, 600); g.lineTo(135, 680); g.lineTo(195, 640); g.fill(); g.restore();
    }
  } else if (t < 12.9) { // video message opening
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.font = font(26, 700); g.textAlign = 'center'; g.fillText('Видеосообщение', w / 2, 120);
    const a = (t - 12.4) * 12; g.strokeStyle = '#fff'; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, h / 2, 46, a, a + 4.2); g.stroke();
  } else if (t < 16.4) { // video plays (handled by rt texture) — fallback black
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  } else if (t < 25.0) { // voice from the phone
    g.fillStyle = '#05060a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(w / 2, 220, 70, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = font(80, 800); g.textAlign = 'center'; g.fillText('?', w / 2, 248);
    g.font = font(30, 700); g.fillText('Неизвестный', w / 2, 360);
    const speaking = t > 16.6 && t < 19.6;
    g.fillStyle = speaking ? '#7fd3ff' : '#334'; for (let i = 0; i < 24; i++) { const amp = speaking ? (0.2 + 0.8 * Math.abs(noise1(t * 9 + i * 0.7, i))) : 0.06; const bh = 160 * amp; rr(g, 40 + i * 13.5, 520 - bh / 2, 8, bh, 4); g.fill(); }
    g.fillStyle = '#8a91a6'; g.font = font(22, 500); g.fillText(speaking ? 'говорит…' : 'на линии', w / 2, 650);
  } else { // incoming call from MAMA
    const answered = t > 26.3;
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a1830'); gr.addColorStop(1, '#07050a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = font(54, 800); g.fillText('МАМА ❤️', w / 2, 230);
    g.font = font(24, 500); g.fillStyle = '#c9b8d0'; g.fillText(answered ? '00:0' + Math.floor(t - 26.3) : 'входящий вызов…', w / 2, 280);
    if (!answered) {
      const pulse = 1 + 0.12 * Math.sin(t * 14);
      g.fillStyle = '#e5383b'; g.beginPath(); g.arc(110, 700, 44, 0, 7); g.fill();
      g.fillStyle = '#2ecc71'; g.beginPath(); g.arc(290, 700, 44 * pulse, 0, 7); g.fill();
    }
  }
  screenTex.needsUpdate = true;
}

// ---------- CHARACTER TIMELINE (global, so every shot is continuous) ----------
const CHAIR = V(1.08, 0, -0.1), DOOR_SPOT = V(-0.05, 0, -1.72), BACK_SPOT = V(0.12, 0, 0.6);
const FIG_SPOT = V(-0.32, 0, -0.42);
function heroState(t) {
  const s = {};
  // position & heading
  let pos, rotY, sit = 0, walk = 0, back = 0;
  if (t < 4.4) { pos = CHAIR.clone(); rotY = Math.PI / 2; sit = 1; }
  else if (t < 5.4) { const k = ease(seg(t, 4.4, 5.4)); pos = CHAIR.clone(); rotY = lerp(Math.PI / 2, Math.PI + 0.6, k); sit = 1 - k; }
  else if (t < 6.9) { const k = ease(seg(t, 5.4, 6.9)); pos = vlerp(CHAIR, DOOR_SPOT, k); rotY = Math.PI + 0.6 - 0.6 * ease(seg(t, 6.2, 6.9)); walk = Math.sin(seg(t, 5.4, 6.9) * Math.PI); }
  else if (t < 9.4) { pos = DOOR_SPOT.clone(); rotY = Math.PI; }
  else if (t < 12.3) { const k = ease(seg(t, 9.4, 12.3)); pos = vlerp(DOOR_SPOT, BACK_SPOT, k); rotY = Math.PI; walk = Math.sin(seg(t, 9.4, 12.3) * Math.PI) * 0.7; back = 1; }
  else if (t < 15.1) { pos = BACK_SPOT.clone(); rotY = Math.PI; }
  else { pos = BACK_SPOT.clone(); rotY = lerp(Math.PI, 2 * Math.PI, easeOut(seg(t, 15.1, 15.42))); }
  s.pos = pos; s.rotY = rotY; s.sit = sit; s.walk = walk; s.back = back;
  s.lean = t > 6.9 && t < 7.6 ? Math.sin(seg(t, 6.9, 7.6) * Math.PI) * 0.12 : 0;
  // phone handling
  s.phoneMode = t < 2.05 ? 'desk' : (t > 26.3 && t < 28.0 ? 'ear' : 'hand');
  s.lift = ease(seg(t, 2.05, 2.5));
  s.holdUp = keys(t, [[2.5, 1], [4.4, 1], [4.9, 0.25], [7.45, 0.25], [7.7, 1], [8.6, 1], [9.2, 0.45], [11.8, 0.45], [12.2, 1], [15.1, 1], [15.3, 0.2], [16.4, 0.2], [16.7, 0.55], [19.5, 0.55], [19.8, 0.15], [25.0, 0.15], [25.3, 0.9], [26.2, 0.9]]);
  s.toEar = ease(seg(t, 26.2, 26.65));
  // look target: 'phone' | world point
  let look = null, lookAmt = 1;
  const doorPt = V(DOOR_X, 1.45, -RZ);
  if (t < 3.45) look = 'phone';
  else if (t < 4.4) look = doorPt;
  else if (t < 7.45) look = doorPt;
  else if (t < 8.6) look = 'phone';
  else if (t < 12.2) look = doorPt;
  else if (t < 15.1) look = 'phone';
  else if (t < 16.4) look = V(0.2, 1.3, 2.6);
  else if (t < 18.15) look = 'phone';
  else if (t < 19.7) look = V(MIRROR.x - 0.1, 1.35, RZ);
  else look = V(MIRROR.x, 2.05, RZ);
  s.look = look;
  // face
  const fear = seg(t, 1.15, 1.45);
  s.face = {
    eye: lerp(0.95, 1.18, fear) + seg(t, 15.0, 15.2) * 0.12 + seg(t, 20.5, 20.8) * 0.1,
    pupil: lerp(0.62, 0.42, fear) - seg(t, 15.0, 15.2) * 0.1 - seg(t, 18.0, 18.4) * 0.07,
    brow: fear * 0.85, lx: 0, ly: 0,
    mouth: (t > 6.95 && t < 7.45 ? 0.55 : 0) + (t > 15.1 && t < 15.8 ? 0.5 : 0) + seg(t, 20.6, 20.9) * 0.7 + (t > 26.7 && t < 27.6 ? 0.2 : 0),
    blink: [0.55, 4.9, 9.1, 12.05].reduce((b, bt) => b + (t > bt && t < bt + 0.12 ? Math.sin(seg(t, bt, bt + 0.12) * Math.PI) : 0), 0),
  };
  s.tremble = seg(t, 16.0, 17.5) * 0.6 + seg(t, 20.6, 21.0) * 0.6;
  return s;
}

const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4();
function aimArm(rigRoot, arm, worldTarget) {
  // point local -Y of the arm at a world target (simple 1-bone IK)
  arm.parent.updateWorldMatrix(true, false);
  const sh = new THREE.Vector3().setFromMatrixPosition(arm.matrixWorld);
  const dir = worldTarget.clone().sub(sh).normalize();
  const parentQ = new THREE.Quaternion(); arm.parent.getWorldQuaternion(parentQ);
  dir.applyQuaternion(parentQ.invert());
  arm.quaternion.setFromUnitVectors(V(0, -1, 0), dir);
}
function poseAvatar(rig, s, t, isDup = false) {
  rig.root.position.copy(s.pos); rig.root.rotation.set(0, s.rotY, 0);
  rig.root.position.y = -0.2 * s.sit;
  const ph = s.walk * Math.sin(t * 9.5) * (s.back ? -1 : 1);
  rig.legs[0].rotation.set(-Math.PI / 2 * s.sit + ph * 0.45, 0, 0);
  rig.legs[1].rotation.set(-Math.PI / 2 * s.sit - ph * 0.45, 0, 0);
  rig.hips.rotation.set(s.lean, 0, 0);
  const tr = s.tremble || 0;
  rig.hips.position.x = tr * 0.004 * noise1(t * 40, 3);
  // left arm: idle / desk / swing
  rig.arms[1].rotation.set(lerp(-ph * 0.4 + 0.05, -1.25, s.sit), 0, 0.06);
  rig.root.updateMatrixWorld(true);
  // head look
  const headW = new THREE.Vector3(); rig.neck.getWorldPosition(headW); headW.y += 0.23;
  let target = s.look === 'phone' ? phone.position.clone() : s.look === 'phone2' ? phone2.position.clone() : (s.look ? s.look.clone() : null);
  if (target) {
    const local = rig.root.worldToLocal(target.clone()); const hl = rig.root.worldToLocal(headW.clone());
    const d = local.sub(hl);
    const yaw = clamp(Math.atan2(d.x, d.z), -1.1, 1.1), pitch = clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.7, 0.75);
    rig.neck.rotation.set(pitch - s.lean, yaw, 0, 'YXZ');
  } else rig.neck.rotation.set(0, 0, 0);
  rig.neck.rotation.x += tr * 0.01 * noise1(t * 33, 1); rig.neck.rotation.y += tr * 0.012 * noise1(t * 29, 7);
  // face
  const f = { ...s.face };
  if (tr > 0) { f.lx = 0.15 * noise1(t * 25, 2) * tr; f.ly = 0.1 * noise1(t * 31, 5) * tr; }
  if (isDup) { Object.assign(f, { black: true, eye: 1.05, brow: 0, mouth: 0, blink: 0, smile: 0.6 }, s.dupFace || {}); }
  drawFace(rig.faceCanvas.getContext('2d'), f); rig.faceTex.needsUpdate = true;
}
function placePhone(s, t) {
  const headW = new THREE.Vector3(); hero.neck.getWorldPosition(headW); headW.y += 0.2;
  const fwd = V(Math.sin(s.rotY), 0, Math.cos(s.rotY)), right = V(-Math.cos(s.rotY), 0, Math.sin(s.rotY)); // hero's right hand side
  const deskPos = V(1.62, DESK_TOP + 0.006, -0.08);
  const handPos = headW.clone().addScaledVector(fwd, 0.3 - 0.06 * (1 - s.holdUp)).addScaledVector(V(0, 1, 0), -0.17 - 0.38 * (1 - s.holdUp)).addScaledVector(right, 0.07);
  const earPos = headW.clone().addScaledVector(right, 0.27).addScaledVector(fwd, 0.02).addScaledVector(V(0, 1, 0), -0.02);
  if (s.phoneMode === 'desk' || s.lift < 1 && t < 2.6) {
    const k = s.lift;
    phone.position.copy(vlerp(deskPos, handPos, k));
    const qDesk = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0.3));
    const m = new THREE.Object3D(); m.position.copy(handPos); m.lookAt(headW); m.rotateX(-0.15);
    phone.quaternion.copy(qDesk).slerp(m.quaternion, k);
  } else {
    const pos = vlerp(handPos, earPos, s.toEar);
    phone.position.copy(pos);
    const m = new THREE.Object3D(); m.position.copy(handPos); m.lookAt(headW); m.rotateX(-0.15);
    const e = new THREE.Object3D(); e.position.copy(earPos); e.lookAt(headW); e.rotateZ(Math.PI / 2 * 0.6);
    phone.quaternion.copy(m.quaternion).slerp(e.quaternion, s.toEar);
  }
  // vibration
  const vib = [[0.0, 0.85], [7.45, 8.3], [12.0, 12.35], [25.0, 26.25]].some(([a, b]) => t > a && t < b);
  if (vib) { phone.position.x += 0.0025 * Math.sin(t * 180); phone.position.z += 0.0025 * Math.cos(t * 210); }
  phone.updateMatrixWorld(true);
  // right arm reaches the phone
  if (s.phoneMode !== 'desk' || s.lift > 0) { const n = V(0, 0, 1).applyQuaternion(phone.quaternion); const dn = V(0, -1, 0).applyQuaternion(phone.quaternion); aimArm(hero.root, hero.arms[0], phone.position.clone().addScaledVector(dn, 0.2 - 0.12 * s.toEar).addScaledVector(n, -0.12)); }
  else hero.arms[0].rotation.set(-1.25, 0, -0.06);
  // phone light
  const screenOn = t < 28.0;
  phoneLight.intensity = screenOn ? (t < 0.9 ? 0.35 : 0.6) * (t > 26.3 ? 0.4 : 1) * (t > 12.2 && t < 15.3 ? 2.2 : 1) : 0;
  const wp = new THREE.Vector3(0, 0, 0.06).applyMatrix4(phone.matrixWorld); phoneLight.position.copy(wp);
}

