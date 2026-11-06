// «Я ПРОСТО ХОТЕЛ КУПИТЬ БУРГЕР» — Roblox-style comedy short with FOMA. Deterministic per-frame renderer.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const W = 1080, H = 1920, FPS = 30, TOTAL = 1044; // 34.8 s
const VO = window.VO || [];
const vo = id => VO.find(v => v.id === id) || { t0: 0, t1: 0 };

// ---------- utils ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = k => k * k * (3 - 2 * k);
const easeOut = k => 1 - Math.pow(1 - k, 3);
const easeIn = k => k * k * k;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const vlerp = (a, b, k) => a.clone().lerp(b, k);
const noise1 = (x, s = 0) => Math.sin(x * 1.7 + s) * 0.5 + Math.sin(x * 3.1 + s * 2.3) * 0.3 + Math.sin(x * 7.3 + s * 4.1) * 0.2;
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function path(t, pts) { // pts: [[t, Vector3], ...] eased linear segments
  if (t <= pts[0][0]) return pts[0][1].clone();
  for (let i = 0; i < pts.length - 1; i++) { const [a, p] = pts[i], [b, q] = pts[i + 1]; if (t <= b) return vlerp(p, q, (t - a) / (b - a)); }
  return pts[pts.length - 1][1].clone();
}
const speaking = (id, t) => t >= vo(id).t0 && t <= vo(id).t1;

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const out = document.createElement('canvas'); out.width = W; out.height = H; document.body.appendChild(out);
const ctx = out.getContext('2d');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd0ff);
scene.fog = new THREE.Fog(0x9fd6ff, 30, 90);
const cam = new THREE.PerspectiveCamera(50, W / H, 0.03, 200);

// ---------- materials / textures ----------
const M = (c, r = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0, ...extra });
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const studTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#4caf50'; g.fillRect(0, 0, w, h); for (const [x, y] of [[32, 32], [96, 32], [32, 96], [96, 96]]) { const gr = g.createRadialGradient(x - 5, y - 5, 2, x, y, 20); gr.addColorStop(0, '#6fd273'); gr.addColorStop(1, '#3e9a43'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 18, 0, 7); g.fill(); } }, [60, 60]);
const asphaltTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#3a3d44'; g.fillRect(0, 0, w, h); const r = rng(4); for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},255,${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2, 2); } }, [30, 3]);
const sidewalkTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#c9ccd3'; g.fillRect(0, 0, w, h); g.strokeStyle = '#aeb2bb'; g.lineWidth = 3; g.strokeRect(0, 0, w, h); }, [40, 2]);
const tileTex = canvasTex(256, 256, (g, w, h) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#f4f1ea' : '#e23b3b'; g.fillRect(x * 64, y * 64, 64, 64); } }, [6, 6]);
const brickTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#b8342c'; g.fillRect(0, 0, w, h); g.fillStyle = '#922820'; for (let y = 0; y < 8; y++) { g.fillRect(0, y * 32, w, 3); for (let x = 0; x < 4; x++) g.fillRect(x * 64 + (y % 2) * 32, y * 32, 3, 32); } }, [6, 2]);
const wallInTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#ffe9a8'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,190,60,0.25)'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 14, h); }, [4, 2]);
const steelTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#b9c0c8'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(255,255,255,${0.05 + 0.05 * Math.sin(y)})`; g.fillRect(0, y, w, 1); } });

const box = (w, h, d, mat, r = 0.03, sg = 2) => { const m = new THREE.Mesh(r > 0 ? new RoundedBoxGeometry(w, h, d, sg, r) : new THREE.BoxGeometry(w, h, d), mat); m.castShadow = m.receiveShadow = true; return m; };
const add = (parent, m, x, y, z) => { m.position.set(x, y, z); parent.add(m); return m; };
const cyl = (rt, rb, h, mat, seg = 24) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.castShadow = m.receiveShadow = true; return m; };
const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false });

// ---------- WORLD ----------
const FLOOR = 0.12;
const world = new THREE.Group(); scene.add(world);
{
  const base = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), M(0xffffff, 0.8, { map: studTex })); base.rotation.x = -Math.PI / 2; base.position.y = -0.01; base.receiveShadow = true; world.add(base);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(120, 7), M(0xffffff, 0.9, { map: asphaltTex })); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.005, 9.5); road.receiveShadow = true; world.add(road);
  for (let x = -58; x < 60; x += 4) add(world, box(2, 0.01, 0.18, M(0xf6d232, 0.6), 0), x, 0.012, 9.5);
  for (const z of [6.15, 12.85]) add(world, box(120, 0.02, 0.12, M(0xffffff, 0.6), 0), 0, 0.012, z);
  const walk = add(world, box(120, FLOOR, 3.7, M(0xffffff, 0.85, { map: sidewalkTex }), 0), 0, FLOOR / 2, 4.15); walk.receiveShadow = true;
  add(world, box(120, FLOOR + 0.04, 0.2, M(0x9ea3ad, 0.7), 0), 0, (FLOOR + 0.04) / 2, 6.0);
  // far side buildings & trees for depth
  const r = rng(9);
  for (let i = -9; i <= 9; i++) {
    const hgt = 4 + r() * 7, col = [0x7fb3ff, 0xffc36b, 0xb48cff, 0x8ce0b0, 0xff8f8f][(i + 9) % 5];
    add(world, box(5.4, hgt, 5, M(col, 0.8), 0.05), i * 6.2, hgt / 2, 19);
    for (let wy = 1.2; wy < hgt - 0.6; wy += 1.4) for (const wx of [-1.5, 0, 1.5]) add(world, box(0.8, 0.8, 0.05, M(0x2b3d63, 0.2, { emissive: 0x111a33 }), 0), i * 6.2 + wx, wy, 16.48);
  }
  for (let x = -22; x <= 22; x += 7) { if (Math.abs(x) < 8) continue; add(world, cyl(0.12, 0.15, 1.6, M(0x7a5230, 0.9), 8), x, 0.9, 4.9); const crown = add(world, box(1.6, 1.6, 1.6, M(0x3dbb55, 0.8), 0.25), x, 2.2, 4.9); crown.rotation.y = 0.4; }
  for (const x of [-9, 0.5, 12]) { add(world, cyl(0.06, 0.08, 3.6, M(0x30343c, 0.5), 8), x, 1.9, 5.6); add(world, box(0.6, 0.12, 0.25, M(0x30343c, 0.5), 0.02), x - 0.25, 3.7, 5.6); add(world, box(0.3, 0.06, 0.2, M(0xffffee, 0.3, { emissive: 0xfff1b0, emissiveIntensity: 0.4 }), 0), x - 0.4, 3.62, 5.6); }
}

// RESTAURANT «БУРГЕР-БЛОК»: footprint x -6..6, z -9..2.4
const R = { x0: -6, x1: 6, z0: -9, z1: 2.4, h: 4.2, doorX: -3.0, sideDoorZ: 1.0 };
const rest = new THREE.Group(); world.add(rest);
const matBrick = M(0xffffff, 0.85, { map: brickTex }), matIn = M(0xffffff, 0.9, { map: wallInTex }), matTrim = M(0xffffff, 0.5), matRed = M(0xe0302a, 0.5), matYellow = M(0xffc928, 0.5);
const wallBox = (x0, x1, y0, y1, z0, z1, mat) => add(rest, box(x1 - x0, y1 - y0, z1 - z0, mat, 0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
const doorSlabs = {};
{
  // floor + ceiling
  const fl = add(rest, box(12, FLOOR, 11.4, M(0xffffff, 0.5, { map: tileTex }), 0), 0, FLOOR / 2, -3.3); fl.receiveShadow = true;
  add(rest, box(12.4, 0.3, 11.8, M(0xf2f2f2, 0.9), 0), 0, R.h + 0.15, -3.3);
  const T = 0.2;
  // front wall (z1) with door (x -3.8..-2.2) and big window (x -1.6..5.6, y 0.9..3.2) and small window (-5.6..-4.4)
  const z0 = R.z1 - T, z1 = R.z1;
  wallBox(-6, -5.6, 0, R.h, z0, z1, matBrick); wallBox(-4.4, -3.8, 0, R.h, z0, z1, matBrick); wallBox(-2.2, -1.6, 0, R.h, z0, z1, matBrick); wallBox(5.6, 6, 0, R.h, z0, z1, matBrick);
  wallBox(-3.8, -2.2, 2.7, R.h, z0, z1, matBrick); wallBox(-5.6, -4.4, 0, 0.9, z0, z1, matBrick); wallBox(-5.6, -4.4, 3.2, R.h, z0, z1, matBrick);
  wallBox(-1.6, 5.6, 0, 0.9, z0, z1, matBrick); wallBox(-1.6, 5.6, 3.2, R.h, z0, z1, matBrick);
  for (const [a, b] of [[-1.6, 5.6], [-5.6, -4.4]]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(b - a, 2.3), glassMat); g.position.set((a + b) / 2, 2.05, R.z1 - 0.1); rest.add(g); for (let x = a; x <= b + 0.01; x += (b - a) / Math.max(1, Math.round((b - a) / 1.8))) wallBox(x - 0.04, x + 0.04, 0.9, 3.2, z0 - 0.02, z1 + 0.02, matTrim); }
  // inside face of walls (cream)
  const inner = (w, h, x, y, z, ry) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matIn); p.position.set(x, y, z); p.rotation.y = ry; p.receiveShadow = true; rest.add(p); };
  // back wall z0, side walls (east wall with side door z 0.4..1.6)
  wallBox(-6, 6, 0, R.h, R.z0, R.z0 + T, matBrick);
  wallBox(R.x0, R.x0 + T, 0, R.h, R.z0, R.z1, matBrick);
  wallBox(R.x1 - T, R.x1, 0, R.h, R.z0, 0.4, matBrick); wallBox(R.x1 - T, R.x1, 0, R.h, 1.6, R.z1, matBrick); wallBox(R.x1 - T, R.x1, 2.6, R.h, 0.4, 1.6, matBrick);
  inner(11.6, R.h, 0, R.h / 2, R.z0 + T + 0.005, 0); inner(11.2, R.h, R.x0 + T + 0.005, R.h / 2, -3.3, Math.PI / 2);
  // kitchen divider z = -5 with swing door x 2.4..3.8
  wallBox(-6, 2.4, 0, R.h, -5.1, -4.9, matIn); wallBox(3.8, 6, 0, R.h, -5.1, -4.9, matIn); wallBox(2.4, 3.8, 2.6, R.h, -5.1, -4.9, matIn);
  // wainscot red band
  add(rest, box(11.6, 0.9, 0.02, matRed, 0), 0, 0.45 + FLOOR, -4.88); add(rest, box(0.02, 0.9, 7.1, matRed, 0), R.x0 + 0.21, 0.45 + FLOOR, -1.4);
  // doors
  const mkDoor = (name, hingeX, z, w, h, mat, axis = 'x') => { const piv = new THREE.Group(); piv.position.set(hingeX, FLOOR, z); rest.add(piv); const s = box(w, h, 0.08, mat, 0.02); if (axis === 'x') s.position.set(w / 2, h / 2, 0); else { s.rotation.y = Math.PI / 2; s.position.set(0, h / 2, w / 2); } piv.add(s); doorSlabs[name] = piv; return piv; };
  const doorMat = new THREE.MeshPhysicalMaterial({ color: 0xcfefff, transparent: true, opacity: 0.45, roughness: 0.1 });
  const fd = mkDoor('front', -3.8, R.z1 - 0.1, 1.6, 2.55, doorMat); add(fd, box(0.06, 2.55, 0.1, M(0x333333, 0.4), 0), 0.03, 1.27, 0); add(fd, box(0.5, 0.06, 0.06, M(0xcccccc, 0.2, { metalness: 0.8 }), 0.02), 1.3, 1.1, 0.08);
  const kdMat = M(0xd8dde3, 0.4, { metalness: 0.4 });
  mkDoor('kitchenL', 2.4, -5.0, 0.7, 2.4, kdMat); mkDoor('kitchenR', 3.8, -5.0, -0.7, 2.4, kdMat);
  for (const d of ['kitchenL', 'kitchenR']) { const port = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), new THREE.MeshBasicMaterial({ color: 0x9fe0ff })); port.position.set(d === 'kitchenL' ? 0.35 : -0.35, 1.7, 0.05); doorSlabs[d].add(port); }
  mkDoor('side', R.x1 - 0.1, 0.4, 1.2, 2.5, M(0x2f6fdf, 0.5), 'z');
  add(rest, box(0.08, 0.5, 0.9, M(0x22aa44, 0.4, { emissive: 0x22aa44, emissiveIntensity: 0.6 }), 0.02), R.x1 + 0.02, 2.95, 1.0); // exit sign
  // awning + roof sign
  for (let i = 0; i < 14; i++) add(rest, box(0.86, 0.12, 1.3, i % 2 ? matRed : M(0xffffff, 0.6), 0.02), -5.6 + i * 0.86, 3.45, R.z1 + 0.6).rotation.x = 0.35;
  add(rest, box(12.4, 0.35, 0.4, matYellow, 0.04), 0, R.h + 0.1, R.z1 + 0.05);
  const signTex = canvasTex(1024, 256, (g, w, h) => { g.fillStyle = '#e0302a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffc928'; g.lineWidth = 18; g.strokeRect(9, 9, w - 18, h - 18); g.fillStyle = '#ffc928'; g.font = '900 150px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('БУРГЕР-БЛОК', w / 2, h / 2 + 8); });
  const sign = add(rest, box(7.2, 1.8, 0.3, [M(0xe0302a), M(0xe0302a), M(0xe0302a), M(0xe0302a), M(0xffffff, 0.4, { map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.25 }), M(0xe0302a)], 0), 0.6, R.h + 1.3, R.z1 - 0.3);
  // giant burger on the roof
  const bg = new THREE.Group(); bg.position.set(-4.6, R.h + 0.3, R.z1 - 0.6); rest.add(bg);
  [[0.85, 0.45, 0xe8a33d, 0.2], [0.9, 0.12, 0x5dcf4a, 0.47], [0.86, 0.22, 0x6b3a1e, 0.62], [0.92, 0.07, 0xffd23a, 0.76], [0.85, 0.5, 0xe8a33d, 1.02]].forEach(([r0, h0, c, y], i) => { const m = add(bg, cyl(r0, r0, h0, M(c, 0.6), 28), 0, y, 0); if (i === 4) m.scale.set(1, 1, 1); });
  add(bg, new THREE.Mesh(new THREE.SphereGeometry(0.85, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0xe8a33d, 0.6)), 0, 1.25, 0);
  // COUNTER
  const counter = new THREE.Group(); rest.add(counter);
  add(counter, box(5.4, 1.0, 0.8, matRed, 0.04), 2.1, FLOOR + 0.5, -2.2);
  add(counter, box(5.6, 0.08, 0.95, M(0xffffff, 0.3), 0.02), 2.1, FLOOR + 1.04, -2.2);
  add(counter, box(5.4, 0.2, 0.02, matYellow, 0), 2.1, FLOOR + 0.75, -1.79);
  // register
  const reg = new THREE.Group(); reg.position.set(0.35, FLOOR + 1.08, -2.35); rest.add(reg);
  add(reg, box(0.6, 0.18, 0.45, M(0x3a3f47, 0.4), 0.03), 0, 0.09, 0);
  add(reg, box(0.08, 0.3, 0.08, M(0x3a3f47, 0.4), 0.02), 0, 0.33, 0);
  const regC = document.createElement('canvas'); regC.width = 256; regC.height = 128; const regTex = new THREE.CanvasTexture(regC); regTex.colorSpace = THREE.SRGBColorSpace;
  const regScreen = add(reg, box(0.5, 0.26, 0.06, [M(0x222222), M(0x222222), M(0x222222), M(0x222222), new THREE.MeshBasicMaterial({ map: regTex, toneMapped: false }), M(0x222222)], 0), 0, 0.55, 0); regScreen.rotation.x = -0.2;
  rest.userData.regC = regC; rest.userData.regTex = regTex;
  // the red button
  const btn = new THREE.Group(); btn.position.set(2.75, FLOOR + 1.08, -2.3); rest.add(btn);
  add(btn, cyl(0.17, 0.2, 0.1, M(0x333333, 0.4), 24), 0, 0.05, 0);
  const dome = add(btn, new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0xff1a1a, 0.25, { emissive: 0x550000 })), 0, 0.1, 0);
  rest.userData.dome = dome;
  // menu boards
  const menuTex = canvasTex(1024, 320, (g, w, h) => {
    g.fillStyle = '#1c1c22'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffc928'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    const items = [['БУРГЕР', '9999 R$'], ['КАРТОШКА', '4999 R$'], ['КОЛА', '2999 R$']];
    items.forEach(([n, p], i) => { const x = 40 + i * 330; g.fillStyle = '#e8a33d'; g.beginPath(); g.ellipse(x + 130, 110, 90, 50, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '900 44px Inter'; g.fillText(n, x, 220); g.fillStyle = '#ffc928'; g.font = '900 52px Inter'; g.fillText(p, x, 285); });
  });
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.7), new THREE.MeshBasicMaterial({ map: menuTex, toneMapped: false })); menu.position.set(2.1, 3.25, -4.86); rest.add(menu);
  // dining tables & chairs
  rest.userData.tables = [];
  for (const [x, z] of [[-1.6, -0.4], [-4.3, -0.4], [-1.6, -3.2], [-4.3, -3.2]]) {
    const tb = new THREE.Group(); tb.position.set(x, FLOOR, z); rest.add(tb);
    add(tb, box(1.3, 0.08, 1.0, matYellow, 0.03), 0, 0.82, 0); add(tb, cyl(0.06, 0.06, 0.8, M(0x444444, 0.4), 10), 0, 0.4, 0); add(tb, cyl(0.35, 0.35, 0.04, M(0x444444, 0.4), 16), 0, 0.02, 0);
    // tray with food
    const tray = new THREE.Group(); tray.position.set(0, 0.87, 0); tb.add(tray);
    add(tray, box(0.5, 0.03, 0.36, M(0xe0302a, 0.5), 0.01), 0, 0, 0); add(tray, cyl(0.1, 0.1, 0.09, M(0xe8a33d, 0.6), 14), -0.1, 0.06, 0); add(tray, cyl(0.05, 0.045, 0.2, M(0xd92020, 0.5), 12), 0.13, 0.11, 0);
    rest.userData.tables.push({ tb, tray, x, z });
  }
}
// chairs with simple physics
function mkChair(col) { const g = new THREE.Group(); add(g, box(0.5, 0.07, 0.5, M(col, 0.5), 0.03), 0, 0.5, 0); add(g, box(0.5, 0.5, 0.07, M(col, 0.5), 0.03), 0, 0.78, -0.22); for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) add(g, box(0.05, 0.5, 0.05, M(0x444444, 0.4), 0.01), x, 0.25, z); return g; }
const chairs = [];
{
  const spots = [[-1.6, 0.35, 0], [-1.6, -1.15, Math.PI], [-4.3, 0.35, 0], [-4.3, -1.15, Math.PI], [-3.45, -0.4, -Math.PI / 2], [-5.15, -0.4, Math.PI / 2], [-1.6, -2.45, 0], [-4.3, -3.95, Math.PI]];
  spots.forEach(([x, z, ry], i) => { const c = mkChair(i % 2 ? 0xffc928 : 0xe0302a); c.position.set(x, FLOOR, z); c.rotation.y = ry; world.add(c); chairs.push({ obj: c, p0: V(x, FLOOR, z), r0: ry, hit: null }); });
  // chairs that Foma smashes through (around table at x -4.3)
  const hits = [[2, 18.72, V(-3.5, 4.2, 2.6), V(5, 1, 7)], [4, 18.6, V(-4.0, 5.0, -1.2), V(-6, 3, 4)], [3, 18.8, V(-3.2, 3.8, -2.4), V(4, -5, 2)], [5, 18.95, V(-5.0, 4.4, 1.2), V(-3, 7, -5)]];
  for (const [i, th, v, w] of hits) chairs[i].hit = { t: th, v, w };
}
function chairAt(c, t) {
  if (!c.hit || t < c.hit.t) { c.obj.position.copy(c.p0); c.obj.rotation.set(0, c.r0, 0); return; }
  // integrate deterministically with floor bounce
  let p = c.p0.clone(), v = c.hit.v.clone(), ang = V(0, c.r0, 0), w = c.hit.w.clone(); const dt = 1 / 240;
  for (let s = c.hit.t; s < t; s += dt) { v.y -= 22 * dt; p.addScaledVector(v, dt); ang.addScaledVector(w, dt); if (p.y < FLOOR) { p.y = FLOOR; v.y = -v.y * 0.35; v.x *= 0.7; v.z *= 0.7; w.multiplyScalar(0.6); } }
  c.obj.position.copy(p); c.obj.rotation.set(ang.x, ang.y, ang.z);
}
// KITCHEN props (z -9..-5)
const flyers = [];
{
  const steel = M(0xffffff, 0.3, { map: steelTex, metalness: 0.6 });
  add(rest, box(5.0, 1.0, 1.1, steel, 0.03), 2.5, FLOOR + 0.5, -7.0);
  add(rest, box(2.2, 1.0, 0.9, M(0x2b2f36, 0.4), 0.03), -2.6, FLOOR + 0.5, -8.4); // stove
  for (const x of [-3.2, -2.0]) add(rest, cyl(0.25, 0.22, 0.35, M(0x9aa3ad, 0.3, { metalness: 0.7 }), 18), x, FLOOR + 1.2, -8.4);
  add(rest, box(1.2, 1.1, 0.9, steel, 0.03), 0.3, FLOOR + 0.55, -8.4); // fryer
  add(rest, box(1.0, 0.1, 0.7, M(0xffd23a, 0.4, { emissive: 0x553300 }), 0.02), 0.3, FLOOR + 1.12, -8.4);
  for (let i = 0; i < 4; i++) add(rest, box(5.6, 0.05, 0.4, steel, 0.01), 0, 2.3 + i * 0.45, -8.75);
  const r = rng(77);
  for (let i = 0; i < 6; i++) { // pans/plates on the island: get knocked flying
    const isPan = i % 2 === 0; const o = isPan ? cyl(0.2, 0.17, 0.06, M(0x2b2b30, 0.3, { metalness: 0.5 }), 18) : cyl(0.16, 0.16, 0.03, M(0xffffff, 0.3), 18);
    const x = 0.5 + i * 0.75, p0 = V(x, FLOOR + 1.05, -7.0 + (r() - 0.5) * 0.5); o.position.copy(p0); world.add(o);
    flyers.push({ obj: o, p0, t: 19.35 + (x - 0.5) / 5.5 * 0.55, v: V(1.5 + r() * 2, 3.5 + r() * 2.5, (r() - 0.5) * 4), w: V(r() * 12, r() * 6, r() * 12) });
  }
}
function flyerAt(f, t) { if (t < f.t) { f.obj.position.copy(f.p0); f.obj.rotation.set(0, 0, 0); return; } const d = t - f.t; f.obj.position.copy(f.p0).addScaledVector(f.v, d); f.obj.position.y += -11 * d * d; if (f.obj.position.y < FLOOR) f.obj.position.y = FLOOR + 0.02; f.obj.rotation.set(f.w.x * d, f.w.y * d, f.w.z * d); }

// ---------- LIGHTS ----------
const hemi = new THREE.HemisphereLight(0xdfefff, 0xb8ab92, 1.3); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3dd, 2.6); sun.position.set(-12, 22, 16); sun.target.position.set(0, 0, 0); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 70 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
const interior = [];
for (const [x, z] of [[-3, -1], [2, -1], [-3, -3.6], [2.5, -3.4], [1.5, -7], [-2, -7]]) { const l = new THREE.PointLight(0xfff0d0, 9, 9, 1.6); l.position.set(x, R.h - 0.3, z); scene.add(l); interior.push(l); add(rest, box(0.8, 0.06, 0.8, M(0xffffff, 0.3, { emissive: 0xfff6dd, emissiveIntensity: 1.2 }), 0.02), x, R.h - 0.03, z); }
const sirenLights = [0, 1, 2].map(i => { const l = new THREE.PointLight(0xff1020, 0, 10, 1.4); l.position.set(-2 + i * 3, R.h - 0.6, -2); scene.add(l); return l; });
const beacon = new THREE.Group(); beacon.position.set(2.1, R.h - 0.2, -2.4); rest.add(beacon); add(beacon, cyl(0.16, 0.16, 0.2, M(0xff2020, 0.3, { emissive: 0xff0000, emissiveIntensity: 0.3 }), 16), 0, -0.1, 0);
const rim = new THREE.DirectionalLight(0xbcd8ff, 1.2); rim.position.set(6, 6, -10); scene.add(rim);

// ---------- R15 CHARACTERS ----------
function faceCanvas() { const c = document.createElement('canvas'); c.width = c.height = 256; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { c, t }; }
function drawNPCFace(g, mood, talk = 0) { // classic Roblox-ish faces
  g.clearRect(0, 0, 256, 256); g.fillStyle = '#111'; g.strokeStyle = '#111'; g.lineCap = 'round';
  const eyeH = { smile: 30, talk: 30, angry: 22, scream: 34, surprised: 40, deadpan: 16, smug: 18 }[mood] || 30;
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(128 + s * 42, 108, 13, eyeH / 2, 0, 0, 7); g.fill(); if (mood === 'surprised' || mood === 'scream') { g.fillStyle = '#fff'; g.beginPath(); g.arc(128 + s * 42 + 4, 102, 4, 0, 7); g.fill(); g.fillStyle = '#111'; } }
  g.lineWidth = 10;
  if (mood === 'angry' || mood === 'scream') { for (const s of [-1, 1]) { g.beginPath(); g.moveTo(128 + s * 22, 78); g.lineTo(128 + s * 64, 64); g.stroke(); } }
  if (mood === 'deadpan' || mood === 'smug') { for (const s of [-1, 1]) { g.beginPath(); g.moveTo(128 + s * 24, 86); g.lineTo(128 + s * 60, 86); g.stroke(); } }
  const open = talk;
  if (mood === 'scream') { g.beginPath(); g.ellipse(128, 178, 34, 30 + 8 * open, 0, 0, 7); g.fill(); g.fillStyle = '#c2373f'; g.beginPath(); g.ellipse(128, 192, 20, 10, 0, 0, 7); g.fill(); }
  else if (mood === 'surprised') { g.beginPath(); g.ellipse(128, 176, 14, 18 + 6 * open, 0, 0, 7); g.fill(); }
  else if (open > 0.15) { g.beginPath(); g.ellipse(128, 172, 28, 8 + 18 * open, 0, 0, Math.PI); g.fill(); }
  else if (mood === 'angry') { g.beginPath(); g.arc(128, 196, 34, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
  else if (mood === 'deadpan') { g.beginPath(); g.moveTo(100, 172); g.lineTo(156, 172); g.stroke(); }
  else if (mood === 'smug') { g.beginPath(); g.moveTo(98, 168); g.quadraticCurveTo(140, 186, 160, 158); g.stroke(); }
  else { g.beginPath(); g.arc(128, 150, 36, Math.PI * 0.18, Math.PI * 0.82); g.stroke(); }
}
// Foma's mask: asymmetric black/white with cracks; eyes go to an emissive map
function drawMask(g, e, w, glowOnly) {
  g.clearRect(0, 0, 256, 256);
  const eh = e.h; // eye opening 0.4..1.4
  if (!glowOnly) {
    g.fillStyle = '#0b0b0e'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#ececef'; g.beginPath(); g.moveTo(132, 0); g.lineTo(138, 60); g.lineTo(126, 118); g.lineTo(136, 170); g.lineTo(128, 256); g.lineTo(256, 256); g.lineTo(256, 0); g.closePath(); g.fill();
    g.strokeStyle = '#0b0b0e'; g.lineWidth = 3; g.lineJoin = 'round';
    const cracks = [[[150, 0], [158, 30], [150, 58], [170, 92]], [[198, 0], [190, 26], [206, 48]], [[140, 140], [164, 160], [158, 196], [176, 240]], [[220, 150], [206, 184], [224, 230]], [[132, 210], [150, 226], [146, 256]]];
    for (const c of cracks) { g.beginPath(); g.moveTo(...c[0]); for (const p of c.slice(1)) g.lineTo(...p); g.stroke(); }
    g.strokeStyle = 'rgba(90,90,100,0.9)'; g.lineWidth = 2; for (const c of [[[40, 30], [54, 52], [46, 70]], [[70, 190], [86, 214], [80, 240]]]) { g.beginPath(); g.moveTo(...c[0]); for (const p of c.slice(1)) g.lineTo(...p); g.stroke(); }
    // dark socket on the white half
    g.fillStyle = '#16161a'; g.beginPath(); g.ellipse(184, 120, 40, 22 * Math.max(0.6, eh), -0.12, 0, 7); g.fill();
  }
  // glowing eyes (almond, stern, angled inward)
  const eye = (cx, cy, tilt) => { g.save(); g.translate(cx, cy); g.rotate(tilt); g.beginPath(); g.moveTo(-30, 2); g.quadraticCurveTo(0, -20 * eh, 30, -4); g.quadraticCurveTo(0, 14 * eh, -30, 2); g.closePath(); g.fillStyle = glowOnly ? `rgba(255,255,255,${w})` : '#f8fbff'; g.fill(); if (!glowOnly) { g.fillStyle = '#3a3d44'; g.beginPath(); g.ellipse(e.px * 8, -2, 5, 7 * Math.min(1, eh), 0, 0, 7); g.fill(); } g.restore(); };
  eye(72, 120, 0.14); eye(184, 120, -0.14);
}
function makeR15(o) {
  const rig = { o };
  const root = new THREE.Group(); rig.root = root;
  const body = new THREE.Group(); root.add(body); rig.body = body; // squash/scale
  const s = o.scale || 1; body.scale.setScalar(s);
  const L = o.L; // lengths
  const pelvis = new THREE.Group(); pelvis.position.y = L.hip; body.add(pelvis); rig.pelvis = pelvis;
  const chest = new THREE.Group(); chest.position.y = L.lower; pelvis.add(chest); rig.chest = chest;
  o.buildLower(pelvis); o.buildUpper(chest);
  const neck = new THREE.Group(); neck.position.y = L.upper; chest.add(neck); rig.neck = neck;
  o.buildHead(neck, rig);
  rig.sh = [], rig.el = [], rig.hip = [], rig.kn = [], rig.hand = [];
  for (const side of [1, -1]) { // index 0 = left (+x), 1 = right (-x)
    const sh = new THREE.Group(); sh.position.set(side * L.shX, L.upper - 0.1, 0); chest.add(sh);
    o.buildUpperArm(sh, side);
    const el = new THREE.Group(); el.position.y = -L.uArm; sh.add(el);
    o.buildLowerArm(el, side);
    const hand = new THREE.Group(); hand.position.y = -L.lArm; el.add(hand); rig.hand.push(hand);
    rig.sh.push(sh); rig.el.push(el);
    const hp = new THREE.Group(); hp.position.set(side * L.hipX, 0, 0); pelvis.add(hp);
    o.buildUpperLeg(hp, side);
    const kn = new THREE.Group(); kn.position.y = -L.uLeg; hp.add(kn);
    o.buildLowerLeg(kn, side);
    rig.hip.push(hp); rig.kn.push(kn);
  }
  root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  scene.add(root);
  return rig;
}
// FOMA
const FOMA_MAT = { hoodie: M(0x17171b, 0.85), hoodie2: M(0x1f1f25, 0.85), cargo: M(0x202027, 0.9), cargo2: M(0x16161b, 0.9), skin: M(0xe3b58f, 0.6), shoe: M(0x141417, 0.45), sole: M(0xeeeeee, 0.5), hair: M(0x0d0d10, 0.55), metal: M(0xbfc5cc, 0.25, { metalness: 0.9 }) };
const fomaMask = { c: document.createElement('canvas'), g: document.createElement('canvas') }; fomaMask.c.width = fomaMask.c.height = fomaMask.g.width = fomaMask.g.height = 256;
const maskTex = new THREE.CanvasTexture(fomaMask.c); maskTex.colorSpace = THREE.SRGBColorSpace;
const glowTex = new THREE.CanvasTexture(fomaMask.g); glowTex.colorSpace = THREE.SRGBColorSpace;
const maskMat = new THREE.MeshStandardMaterial({ map: maskTex, emissive: 0xffffff, emissiveMap: glowTex, emissiveIntensity: 2.2, roughness: 0.35 });
const glowSprite = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(220,235,255,0.55)'); gr.addColorStop(1, 'rgba(200,220,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const FOMA_L = { hip: 0.98, lower: 0.24, upper: 0.66, shX: 0.56, uArm: 0.42, lArm: 0.32, hipX: 0.2, uLeg: 0.44, lLeg: 0.4 };
const foma = makeR15({
  scale: 0.8, L: FOMA_L,
  buildLower(p) { const m = FOMA_MAT; add(p, box(0.78, 0.26, 0.46, m.cargo, 0.05), 0, 0.12, 0); add(p, box(0.8, 0.06, 0.48, m.cargo2, 0.02), 0, 0.24, 0);
    // chain from front to side
    for (let i = 0; i < 9; i++) { const a = i / 8; const link = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 6, 10), m.metal); link.position.set(0.1 + a * 0.3, 0.1 - Math.sin(a * Math.PI) * 0.22, 0.25 - a * 0.05); link.rotation.set(Math.PI / 2, 0, i % 2 ? 0 : Math.PI / 2); p.add(link); } },
  buildUpper(c) { const m = FOMA_MAT;
    add(c, box(0.9, 0.66, 0.54, m.hoodie, 0.1, 3), 0, 0.33, 0);
    add(c, box(0.92, 0.09, 0.56, m.hoodie2, 0.04), 0, 0.03, 0); // hem band
    add(c, box(0.66, 0.36, 0.26, m.hoodie2, 0.12, 3), 0, 0.62, -0.2); // hood
    add(c, box(0.6, 0.12, 0.5, m.hoodie2, 0.05), 0, 0.66, 0.02); // collar
    add(c, box(0.025, 0.6, 0.01, M(0x8a8f98, 0.3, { metalness: 0.8 }), 0), 0, 0.33, 0.275); // zipper
    add(c, box(0.05, 0.07, 0.02, M(0xa8aeb6, 0.3, { metalness: 0.8 }), 0.01), 0, 0.58, 0.28);
    for (const s of [-1, 1]) { add(c, box(0.022, 0.26, 0.015, m.hoodie2, 0.005), s * 0.09, 0.48, 0.28); add(c, box(0.03, 0.04, 0.03, m.metal, 0.01), s * 0.09, 0.34, 0.285); }
    add(c, box(0.5, 0.18, 0.02, m.hoodie2, 0.03), 0, 0.16, 0.275); },
  buildHead(n, rig) { const m = FOMA_MAT;
    add(n, box(0.5, 0.5, 0.5, m.skin, 0.12, 3), 0, 0.27, 0);
    const mask = add(n, box(0.49, 0.46, 0.04, [m.hair, m.hair, m.hair, m.hair, maskMat, m.hair], 0), 0, 0.26, 0.245); rig.mask = mask;
    // glow halos
    rig.halo = [];
    for (const x of [-0.105, 0.105]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite, color: 0xdfeaff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true })); sp.position.set(x, 0.26 + 0.02, 0.29); sp.scale.setScalar(0.16); n.add(sp); rig.halo.push(sp); }
    // hair: cap + spikes
    add(n, box(0.56, 0.2, 0.56, m.hair, 0.08), 0, 0.5, -0.01); add(n, box(0.58, 0.34, 0.16, m.hair, 0.06), 0, 0.34, -0.23);
    for (const s of [-1, 1]) add(n, box(0.1, 0.32, 0.46, m.hair, 0.04), s * 0.27, 0.36, -0.02);
    const r = rng(1234), geo = new THREE.ConeGeometry(1, 1, 5);
    for (let i = 0; i < 58; i++) {
      const front = i < 13; let dir;
      if (front) dir = V((i - 6) * 0.1 + (r() - 0.5) * 0.08, -0.55 - r() * 0.25, 0.85).normalize();
      else { const a = r() * Math.PI * 2, el = 0.15 + r() * 1.0; dir = V(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el) - 0.25).normalize(); }
      const sp = new THREE.Mesh(geo, m.hair); const len = front ? 0.18 + r() * 0.1 : 0.16 + r() * 0.2, rad = 0.04 + r() * 0.035;
      sp.scale.set(rad, len, rad); sp.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
      const basePos = front ? V((i - 6) * 0.04, 0.5, 0.22) : V(dir.x * 0.22, 0.42 + dir.y * 0.12, dir.z * 0.22);
      sp.position.copy(basePos).addScaledVector(dir, len * 0.45); n.add(sp);
    } },
  buildUpperArm(sh, side) { const m = FOMA_MAT; add(sh, box(0.42, 0.48, 0.44, m.hoodie, 0.1, 3), side * 0.02, -0.2, 0); add(sh, box(0.44, 0.08, 0.46, m.hoodie2, 0.04), side * 0.02, -0.42, 0); },
  buildLowerArm(el, side) { const m = FOMA_MAT; add(el, box(0.23, 0.3, 0.23, m.skin, 0.06), 0, -0.14, 0); add(el, box(0.25, 0.18, 0.25, m.skin, 0.07), 0, -0.37, 0); },
  buildUpperLeg(hp, side) { const m = FOMA_MAT; add(hp, box(0.4, 0.46, 0.44, m.cargo, 0.06), 0, -0.22, 0);
    add(hp, box(0.06, 0.24, 0.28, m.cargo2, 0.02), side * 0.22, -0.28, 0.02); add(hp, box(0.07, 0.07, 0.3, m.cargo2, 0.02), side * 0.225, -0.16, 0.02); // cargo pocket + flap
    add(hp, box(0.025, 0.3, 0.025, m.cargo2, 0.005), side * 0.24, -0.4, -0.08); },
  buildLowerLeg(kn, side) { const m = FOMA_MAT; add(kn, box(0.42, 0.4, 0.46, m.cargo, 0.06), 0, -0.18, 0); add(kn, box(0.44, 0.06, 0.48, m.cargo2, 0.02), 0, -0.36, 0);
    add(kn, box(0.36, 0.17, 0.56, m.shoe, 0.06), 0, -0.36 - 0.1, 0.06); add(kn, box(0.38, 0.06, 0.6, m.sole, 0.03), 0, -0.36 - 0.19, 0.06); add(kn, box(0.37, 0.03, 0.2, m.sole, 0.01), 0, -0.36 - 0.06, 0.2); },
});
function drawFomaMask(e) { drawMask(fomaMask.c.getContext('2d'), e, 1, false); drawMask(fomaMask.g.getContext('2d'), e, e.glow, true); maskTex.needsUpdate = true; glowTex.needsUpdate = true; maskMat.emissiveIntensity = 1.6 + 1.6 * e.glow; for (const h of foma.halo) { h.material.opacity = 0.35 + 0.65 * e.glow; h.scale.setScalar(0.12 + 0.14 * e.glow); } }

// generic Roblox NPC
function npc({ scale = 0.8, skin = 0xf2c94c, shirt, pants, shoe = 0x2a2a2a, extra }) {
  const L = { hip: 0.86, lower: 0.2, upper: 0.62, shX: 0.48, uArm: 0.36, lArm: 0.3, hipX: 0.17, uLeg: 0.4, lLeg: 0.38 };
  const fc = faceCanvas(); const mSkin = M(skin, 0.6), mShirt = M(shirt, 0.7), mPants = M(pants, 0.8), mShoe = M(shoe, 0.6);
  const r = makeR15({ scale, L,
    buildLower(p) { add(p, box(0.64, 0.22, 0.34, mPants, 0.04), 0, 0.1, 0); },
    buildUpper(c) { add(c, box(0.66, 0.62, 0.34, mShirt, 0.05), 0, 0.31, 0); },
    buildHead(n, rig) { add(n, box(0.44, 0.44, 0.44, mSkin, 0.1, 3), 0, 0.24, 0); const f = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshStandardMaterial({ map: fc.t, transparent: true, roughness: 0.7 })); f.position.set(0, 0.24, 0.222); n.add(f); },
    buildUpperArm(sh, side) { add(sh, box(0.3, 0.38, 0.3, mShirt, 0.05), 0, -0.17, 0); },
    buildLowerArm(el, side) { add(el, box(0.26, 0.28, 0.26, mSkin, 0.05), 0, -0.13, 0); add(el, box(0.27, 0.12, 0.27, mSkin, 0.05), 0, -0.32, 0); },
    buildUpperLeg(hp, side) { add(hp, box(0.32, 0.42, 0.32, mPants, 0.04), 0, -0.2, 0); },
    buildLowerLeg(kn, side) { add(kn, box(0.32, 0.36, 0.32, mPants, 0.04), 0, -0.17, 0); add(kn, box(0.34, 0.12, 0.42, mShoe, 0.04), 0, -0.36, 0.04); },
  });
  r.face = fc; if (extra) extra(r); return r;
}
const cashier = npc({ shirt: 0xffc928, pants: 0x2b2b33, extra(r) {
  const n = r.neck; add(n, box(0.48, 0.1, 0.48, M(0xe0302a, 0.5), 0.03), 0, 0.48, 0); add(n, box(0.4, 0.04, 0.24, M(0xe0302a, 0.5), 0.02), 0, 0.44, 0.3); add(n, box(0.46, 0.1, 0.12, M(0x6b3a1e, 0.6), 0.03), 0, 0.36, -0.2);
  add(r.chest, box(0.5, 0.5, 0.02, M(0xffffff, 0.7), 0.01), 0, 0.22, 0.18);
  const logo = canvasTex(128, 128, (g) => { g.fillStyle = '#e0302a'; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill(); g.fillStyle = '#ffc928'; g.font = '900 70px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Б', 64, 68); });
  const l = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshStandardMaterial({ map: logo, transparent: true })); l.position.set(0.16, 0.48, 0.175); r.chest.add(l); } });
const chefs = [0, 1, 2, 3, 4].map(i => npc({ scale: 1.25 + (i % 3) * 0.08, skin: [0xf2c94c, 0xe3b58f, 0xc68a5a, 0xf2c94c, 0x8d5a3b][i], shirt: 0xf4f4f4, pants: 0x30303a, shoe: 0x111111, extra(r) {
  add(r.neck, cyl(0.2, 0.18, 0.42, M(0xffffff, 0.8), 18), 0, 0.68, 0); add(r.neck, new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 10), M(0xffffff, 0.8)), 0, 0.92, 0);
  for (let b = 0; b < 3; b++) add(r.chest, box(0.05, 0.05, 0.02, M(0x222222), 0.01), 0.1, 0.48 - b * 0.15, 0.175);
  add(r.chest, box(0.67, 0.1, 0.35, M(0xe0302a, 0.6), 0.02), 0, 0.02, 0);
  const tool = new THREE.Group(); tool.position.y = -0.06; r.hand[1].add(tool);
  if (i % 2) { add(tool, cyl(0.025, 0.025, 0.7, M(0x8a5a2b, 0.6), 8), 0, -0.25, 0.1).rotation.x = Math.PI / 2; add(tool, box(0.22, 0.03, 0.3, M(0xbfc5cc, 0.3, { metalness: 0.8 }), 0.01), 0, -0.25, 0.5); }
  else { add(tool, cyl(0.02, 0.02, 0.6, M(0xbfc5cc, 0.3, { metalness: 0.8 }), 8), 0, -0.22, 0.12).rotation.x = Math.PI / 2; add(tool, new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M(0xbfc5cc, 0.3, { metalness: 0.8 })), 0, -0.2, 0.44); }
} }));
const player = npc({ shirt: 0x19b5a5, pants: 0x4a4f5a, skin: 0xffd9a8, extra(r) {
  add(r.neck, box(0.5, 0.18, 0.5, M(0xff7a1a, 0.7), 0.05), 0, 0.5, -0.02); add(r.neck, box(0.5, 0.3, 0.1, M(0xff7a1a, 0.7), 0.04), 0, 0.36, -0.22);
  add(r.neck, box(0.16, 0.08, 0.1, M(0xff7a1a, 0.7), 0.03), -0.1, 0.48, 0.24).rotation.z = 0.4; add(r.neck, box(0.16, 0.08, 0.1, M(0xff7a1a, 0.7), 0.03), 0.12, 0.49, 0.24).rotation.z = -0.3; } });

// ---------- POSES ----------
const Z = () => ({ rp: 0, py: 0, pz: 0, lean: 0, twist: 0, tilt: 0, pl: 0, hx: 0, hy: 0, hz: 0, lsx: 0, lsy: 0, lsz: 0.08, le: -0.1, rsx: 0, rsy: 0, rsz: -0.08, re: -0.1, lhx: 0, lhz: 0, lk: 0, rhx: 0, rhz: 0, rk: 0, sq: 1 });
function mix(a, b, k) { const o = {}; for (const key in a) o[key] = lerp(a[key], b[key] ?? a[key], k); return o; }
function addP(a, b) { const o = { ...a }; for (const k in b) o[k] = (o[k] ?? 0) + b[k] * (k === 'sq' ? 0 : 1); if (b.sq) o.sq = a.sq * b.sq; return o; }
const P = {
  idle: t => ({ ...Z(), lean: 0.03 + 0.01 * Math.sin(t * 2), hx: 0.02 * Math.sin(t * 1.3), lsz: 0.14 + 0.02 * Math.sin(t * 2), rsz: -0.14 - 0.02 * Math.sin(t * 2), le: -0.2, re: -0.2, sq: 1 + 0.01 * Math.sin(t * 2.6) }),
  walk: ph => { const s = Math.sin(ph); return { ...Z(), py: 0.03 * Math.abs(Math.cos(ph)), lean: 0.06, twist: 0.08 * s, lhx: -0.55 * s, rhx: 0.55 * s, lk: 0.7 * Math.max(0, Math.sin(ph + 1.2)), rk: 0.7 * Math.max(0, Math.sin(ph + 1.2 + Math.PI)), lsx: 0.45 * s, rsx: -0.45 * s, le: -0.35, re: -0.35, lsz: 0.12, rsz: -0.12 }; },
  run: ph => { const s = Math.sin(ph); return { ...Z(), py: 0.08 * Math.abs(Math.cos(ph)), lean: 0.32, twist: 0.15 * s, lhx: -1.0 * s - 0.2, rhx: 1.0 * s - 0.2, lk: 1.3 * Math.max(0, Math.sin(ph + 1.2)) + 0.2, rk: 1.3 * Math.max(0, Math.sin(ph + 1.2 + Math.PI)) + 0.2, lsx: 1.1 * s, rsx: -1.1 * s, le: -1.4, re: -1.4, lsz: 0.15, rsz: -0.15 }; },
  crouch: () => ({ ...Z(), py: -0.18, lean: 0.35, lhx: -0.9, rhx: -0.9, lk: 1.4, rk: 1.4, lsx: 0.6, rsx: 0.6, le: -0.4, re: -0.4, sq: 0.94 }),
  air: () => ({ ...Z(), lean: 0.1, lhx: -1.3, rhx: -0.7, lk: 1.6, rk: 1.0, lsx: -2.6, rsx: -2.2, lsz: 0.5, rsz: -0.5, le: -0.3, re: -0.3, sq: 1.08 }),
  land: () => ({ ...Z(), py: -0.22, lean: 0.25, lhx: -1.0, rhx: -1.0, lk: 1.5, rk: 1.5, lsz: 0.9, rsz: -0.9, le: -0.3, re: -0.3, sq: 0.88 }),
  dive: () => ({ ...Z(), rp: 1.45, lean: 0.05, hx: -1.2, lsx: -3.0, rsx: -3.0, lsz: 0.15, rsz: -0.15, le: 0, re: 0, lhx: 0.2, rhx: 0.1, lk: 0.3, rk: 0.1 }),
  shock: t => ({ ...Z(), lean: -0.18, hx: -0.2, lsx: -2.7 + 0.15 * Math.sin(t * 30), rsx: -2.7 - 0.15 * Math.sin(t * 30), lsz: 0.7, rsz: -0.7, le: -0.5, re: -0.5, lhz: 0.12, rhz: -0.12, sq: 1.05 }),
  confused: t => ({ ...Z(), hz: 0.28, hx: 0.05, rsx: -2.8, rsz: 0.25, re: -1.9 + 0.15 * Math.sin(t * 18), lsx: 0.15, lsz: 0.55, le: -1.6 }),
  skeptic: t => ({ ...Z(), lean: -0.04, tilt: 0.06, hz: -0.18, rsx: -1.15, rsy: 0.3, rsz: -0.35, re: -0.7 - 0.15 * Math.sin(t * 6), lsz: 0.5, lsx: 0.2, le: -1.7, lhz: 0.05 }),
  count: t => ({ ...Z(), lean: 0.06, rsx: -1.5, rsz: -0.1, re: -1.3 + 0.25 * Math.abs(Math.sin(t * 5.5)), lsz: 0.14, le: -0.2 }),
  sit: () => ({ ...Z(), lhx: -1.55, rhx: -1.55, lk: 1.5, rk: 1.5, lsx: -0.5, rsx: -0.5, le: -0.6, re: -0.6 }),
  drive: t => ({ ...Z(), lhx: -1.55, rhx: -1.55, lk: 1.5, rk: 1.5, lsx: -1.25 + 0.05 * Math.sin(t * 3), rsx: -1.25 - 0.05 * Math.sin(t * 3), lsz: 0.1, rsz: -0.1, le: -0.5, re: -0.5 }),
  crossed: t => ({ ...Z(), lean: -0.05, lsx: -0.9, rsx: -0.9, lsz: -0.45, rsz: 0.45, le: -1.9, re: -1.9, hx: -0.05, rhx: 0.06 * Math.max(0, Math.sin(t * 9)) * -1, rk: 0.12 * Math.max(0, Math.sin(t * 9)) }),
  wave: t => ({ ...Z(), rsx: -2.6, rsz: -0.3, re: -0.4 + 0.5 * Math.sin(t * 10), lsz: 0.14 }),
  talk: t => ({ ...Z(), lsx: -0.4 - 0.2 * Math.sin(t * 6), le: -1.0, rsx: -0.3 + 0.2 * Math.sin(t * 5), re: -0.8, lsz: 0.2, rsz: -0.2, hx: 0.04 * Math.sin(t * 7) }),
  slam: k => ({ ...Z(), lean: 0.25 * k, rsx: lerp(-2.9, -0.9, k), rsz: -0.15, re: lerp(-0.2, -0.3, k), lsz: 0.4, sq: lerp(1.05, 0.95, k) }),
  scream: t => ({ ...Z(), lean: -0.12, py: 0.06 * Math.abs(Math.sin(t * 14)), hx: -0.15, rsx: -1.6, rsz: -0.05, re: 0, lsx: -2.7, lsz: 0.6, le: -0.3 + 0.3 * Math.sin(t * 20), sq: 1.04 }),
  chefRun: (ph, i) => { const s = Math.sin(ph); return { ...Z(), py: 0.1 * Math.abs(Math.cos(ph)), lean: 0.22, lhx: -0.9 * s, rhx: 0.9 * s, lk: 1.1 * Math.max(0, Math.sin(ph + 1.2)), rk: 1.1 * Math.max(0, Math.sin(ph + 1.2 + Math.PI)), lsx: -2.4 + 0.5 * s, lsz: 0.4, le: -0.4, rsx: -2.0 - 0.6 * s, rsz: -0.3, re: -0.3 }; },
  fallBack: k => ({ ...Z(), lean: -1.45 * k, py: -0.4 * k, lsx: -2.5 * k, rsx: -2.5 * k, lsz: 0.8 * k, rsz: -0.8 * k, lhx: -1.2 * k, rhx: -0.6 * k, lk: 0.6 * k }),
  point: () => ({ ...Z(), rsx: -1.5, rsz: -0.1, re: 0, lsz: 0.16 }),
};
function applyPose(rig, pos, rotY, p) {
  rig.root.position.copy(pos); rig.root.rotation.set(p.rp || 0, rotY, 0, 'YXZ');
  const s = rig.o.scale;
  rig.body.position.set(0, p.py * s, p.pz * s); rig.body.scale.set(s * (2 - p.sq) ** 0.5, s * p.sq, s * (2 - p.sq) ** 0.5);
  rig.pelvis.rotation.set(p.pl, 0, 0);
  rig.chest.rotation.set(p.lean, p.twist, p.tilt, 'YXZ');
  rig.neck.rotation.set(p.hx, p.hy, p.hz, 'YXZ');
  rig.sh[0].rotation.set(p.lsx, p.lsy, p.lsz); rig.el[0].rotation.set(p.le, 0, 0);
  rig.sh[1].rotation.set(p.rsx, p.rsy, p.rsz); rig.el[1].rotation.set(p.re, 0, 0);
  rig.hip[0].rotation.set(p.lhx, 0, p.lhz); rig.kn[0].rotation.set(p.lk, 0, 0);
  rig.hip[1].rotation.set(p.rhx, 0, p.rhz); rig.kn[1].rotation.set(p.rk, 0, 0);
  rig.root.updateMatrixWorld(true);
}
function headWorld(rig) { const v = new THREE.Vector3(); rig.neck.getWorldPosition(v); return v.add(V(0, 0.27 * rig.o.scale, 0)); }
function lookAtWorld(rig, target, amt = 1, extraPitch = 0) { // rotate neck toward a world target (adds yaw/pitch on top)
  rig.root.updateMatrixWorld(true);
  const h = headWorld(rig); const inv = new THREE.Matrix4().copy(rig.chest.matrixWorld).invert();
  const d = target.clone().applyMatrix4(inv).sub(h.clone().applyMatrix4(inv));
  const yaw = clamp(Math.atan2(d.x, d.z), -1.4, 1.4), pitch = clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.8, 0.8);
  rig.neck.rotation.y = lerp(rig.neck.rotation.y, yaw, amt); rig.neck.rotation.x = lerp(rig.neck.rotation.x, pitch + extraPitch, amt);
  rig.root.updateMatrixWorld(true);
}
function aimArm(rig, i, target, k = 1) {
  const sh = rig.sh[i]; sh.parent.updateWorldMatrix(true, false);
  const p = new THREE.Vector3().setFromMatrixPosition(sh.matrixWorld);
  const dir = target.clone().sub(p).normalize(); const q = new THREE.Quaternion(); sh.parent.getWorldQuaternion(q); dir.applyQuaternion(q.invert());
  const aim = new THREE.Quaternion().setFromUnitVectors(V(0, -1, 0), dir); sh.quaternion.slerp(aim, k); rig.el[i].rotation.set(lerp(rig.el[i].rotation.x, 0, k), 0, 0);
}

// ---------- CAR ----------
const car = new THREE.Group(); scene.add(car); let carGlass;
const wheels = [];
{
  const red = M(0xd7262b, 0.35, { metalness: 0.2 }), dark = M(0x1d1f24, 0.6), chrome = M(0xdfe3e8, 0.2, { metalness: 0.9 });
  // car faces -x: local +x is the back. Built in local coords facing -x.
  add(car, box(4.2, 0.55, 1.9, red, 0.12), 0, 0.68, 0);
  add(car, box(1.1, 0.3, 1.9, red, 0.1), -1.5, 1.0, 0); add(car, box(0.9, 0.3, 1.9, red, 0.1), 1.6, 1.0, 0);
  add(car, box(1.2, 0.08, 1.84, red, 0.04), 0.25, 2.12, 0); // roof (tall Roblox cabin)
  for (const x of [-0.55, 1.05]) for (const z of [-0.9, 0.9]) add(car, box(0.08, 1.12, 0.08, red, 0.02), x, 1.54, z);
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.8), glassMat); ws.position.set(-0.6, 1.53, 0); ws.scale.y = 1.45; ws.rotation.y = -Math.PI / 2; ws.rotation.x = 0; car.add(ws); carGlass = ws;
  add(car, box(0.22, 0.12, 0.4, M(0xfff8cc, 0.2, { emissive: 0xfff3b0, emissiveIntensity: 0.8 }), 0.03), -2.1, 0.8, -0.6); add(car, box(0.22, 0.12, 0.4, M(0xfff8cc, 0.2, { emissive: 0xfff3b0, emissiveIntensity: 0.8 }), 0.03), -2.1, 0.8, 0.6);
  add(car, box(0.1, 0.14, 0.5, M(0xff3030, 0.3, { emissive: 0xaa0000 }), 0.03), 2.1, 0.85, -0.6); add(car, box(0.1, 0.14, 0.5, M(0xff3030, 0.3, { emissive: 0xaa0000 }), 0.03), 2.1, 0.85, 0.6);
  add(car, box(0.15, 0.2, 1.95, chrome, 0.05), -2.13, 0.5, 0); add(car, box(0.15, 0.2, 1.95, chrome, 0.05), 2.13, 0.5, 0);
  // seats (front): passenger at z -0.42 (right side), driver z +0.42
  for (const z of [-0.42, 0.42]) { add(car, box(0.6, 0.18, 0.62, dark, 0.06), 0.15, 1.02, z); add(car, box(0.16, 0.8, 0.62, dark, 0.06), 0.5, 1.4, z); }
  add(car, box(0.35, 0.3, 1.8, dark, 0.06), -0.75, 1.1, 0); // dashboard
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 20), dark); wheel.position.set(-0.45, 1.3, 0.42); wheel.rotation.y = Math.PI / 2; wheel.rotation.x = 0.4; car.add(wheel); car.userData.steer = wheel;
  const cf = new THREE.PointLight(0xfff2e0, 5, 4, 1.5); cf.position.set(-0.9, 1.9, 0); car.add(cf);
  for (const x of [-1.3, 1.3]) for (const z of [-0.95, 0.95]) { const w = new THREE.Group(); w.position.set(x, 0.36, z); car.add(w); const t = cyl(0.36, 0.36, 0.3, M(0x15161a, 0.8), 22); t.rotation.x = Math.PI / 2; w.add(t); const hub = cyl(0.18, 0.18, 0.32, chrome, 12); hub.rotation.x = Math.PI / 2; w.add(hub); wheels.push(w); }
}
car.rotation.y = 0; car.scale.setScalar(1.3); // faces -x; scaled to fit R15 riders
// dust puffs
const puffTex = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(235,235,235,0.9)'); gr.addColorStop(1, 'rgba(235,235,235,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
const puffs = [...Array(14)].map((_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false })); scene.add(s); return s; });

// ---------- TIMELINE ----------
// key positions
const SPOT_FRONT = V(-3.0, FLOOR, 4.3), DOOR_IN = V(-3.0, FLOOR, 1.6), AT_COUNTER = V(1.5, FLOOR, -1.25);
const CASH_POS = V(1.5, FLOOR, -3.0), BTN = V(2.75, FLOOR + 1.2, -2.3);
const CAR_PARK = V(9.5, 0, 8.4), CAR_STOP = V(-2.2, 0, 8.4);
const T = {
  enter: 3.85, atCounter: 5.55, headTurn: [vo('C2').t1 + 0.0, vo('C2').t1 + 0.55], slam: [vo('F3').t1 + 0.0, vo('F3').t1 + 0.3],
  chefsOut: vo('F3').t1 + 0.35, runStart: vo('F4').t1, kitchen: 19.15, street: 20.0, dive: [20.8, 21.35], reveal: vo('F5').t1 - 0.05,
  launch: vo('F6').t1, ret: [26.75, 27.35], popup: [vo('P2').t1 + 0.04, vo('F8').t0], end: 34.8,
};
function carState(t) {
  let x = CAR_PARK.x, z = CAR_PARK.z, v = 0;
  if (t >= T.launch && t < T.ret[0]) { const d = t - T.launch; x = CAR_PARK.x - 0.5 * 34 * d * d; v = 34 * d; }
  else if (t >= T.ret[0]) { const tt = Math.min(t, T.ret[1]); const dd = T.ret[1] - tt; x = CAR_STOP.x + 0.5 * 110 * dd * dd; v = 110 * dd; z = CAR_STOP.z; }
  const nose = t >= T.ret[1] && t < T.ret[1] + 0.35 ? Math.sin(seg(t, T.ret[1], T.ret[1] + 0.35) * Math.PI) * -0.06 : (t >= T.launch && t < T.launch + 0.3 ? Math.sin(seg(t, T.launch, T.launch + 0.3) * Math.PI) * 0.07 : 0);
  return { pos: V(x, 0, z), v, nose };
}
function carLocal(lp) { car.updateMatrixWorld(true); return lp.clone().applyMatrix4(car.matrixWorld); }
const SEAT_P = V(0.12, 1.11, -0.42), SEAT_D = V(0.12, 1.11, 0.42);
function seatWorld(local, rig) { return carLocal(local).add(V(0, -rig.o.L.hip * rig.o.scale, 0)); }

function fomaState(t) {
  let pos, rotY, pose, look = null, glow = 0.45, eye = { h: 1, px: 0 }, sq = 1;
  if (t < T.enter) { pos = SPOT_FRONT.clone(); rotY = 0; pose = mix(P.idle(t), P.talk(t), speaking('F1', t) ? 0.6 : 0); eye.h = 0.85; }
  else if (t < T.atCounter) { const k = seg(t, T.enter, T.atCounter); pos = path(t, [[T.enter, DOOR_IN], [T.atCounter, AT_COUNTER]]); rotY = Math.atan2(AT_COUNTER.x - DOOR_IN.x, AT_COUNTER.z - DOOR_IN.z); pose = P.walk(t * 9); if (k > 0.85) rotY = lerp(rotY, Math.PI, (k - 0.85) / 0.15); }
  else if (t < T.slam[0]) {
    pos = AT_COUNTER.clone(); rotY = Math.PI; pose = P.idle(t);
    if (speaking('F2', t)) pose = P.count(t);
    if (t > vo('C2').t0 + 0.5 && t < T.headTurn[0]) { pose = mix(P.idle(t), { ...Z(), lean: -0.08, sq: 1.03 }, 0.8); eye.h = 1.3; } // freeze on the price
    if (t >= T.headTurn[0]) { pose = P.idle(t); look = 'camera'; eye.h = 0.6; }
    if (speaking('F3', t)) { pose = P.skeptic(t); look = 'camera'; eye.h = 0.6; }
  }
  else if (t < T.runStart) {
    pos = AT_COUNTER.clone(); rotY = Math.PI; pose = P.idle(t); look = CASH_POS.clone().add(V(0, 1.6, 0)); eye.h = 0.8;
    if (t > T.chefsOut) { look = V(3.4, 1.8, -4.5); eye.h = 1.2; }
    if (t > vo('F4').t0 - 0.1) { pose = P.shock(t); rotY = lerp(Math.PI, 0.35, ease(seg(t, vo('F4').t0 - 0.1, vo('F4').t0 + 0.25))); look = 'camera'; eye.h = 1.4; glow = 0.8; }
  }
  else if (t < T.kitchen) { // run west & jump the table, then through chairs
    const t0 = T.runStart, jA = t0 + 0.3, jB = jA + 0.5;
    const pts = [[t0, AT_COUNTER], [jA, V(-0.4, FLOOR, -0.4)], [jB, V(-2.9, FLOOR, -0.4)], [T.kitchen, V(-5.6, FLOOR, -0.5)]];
    pos = path(t, pts); rotY = -Math.PI / 2; pose = P.run(t * 15); glow = 0.7;
    if (t < t0 + 0.12) { rotY = lerp(0.35, -Math.PI / 2, seg(t, t0, t0 + 0.12)); }
    if (t > jA - 0.08 && t < jA) pose = P.crouch();
    if (t >= jA && t < jB) { const k = seg(t, jA, jB); pos.y += Math.sin(k * Math.PI) * 1.25; pose = P.air(); }
    if (t >= jB && t < jB + 0.12) pose = mix(P.land(), P.run(t * 15), seg(t, jB, jB + 0.12));
  }
  else if (t < T.street) { // superman dive across the kitchen island
    const k = seg(t, T.kitchen, T.street); pos = vlerp(V(-1.6, FLOOR + 1.25, -7.0), V(4.4, FLOOR + 1.1, -6.9), k); pos.y += Math.sin(k * Math.PI) * 0.2; rotY = Math.PI / 2; pose = P.dive(); glow = 0.9;
  }
  else if (t < T.dive[0]) { pos = path(t, [[T.street, V(6.4, FLOOR, 1.0)], [T.dive[0], V(8.3, FLOOR, 5.4)]]); rotY = Math.atan2(1.9, 4.4); pose = P.run(t * 15); glow = 0.7; }
  else if (t < T.dive[1]) { const k = seg(t, T.dive[0], T.dive[1]); const seat = seatWorld(SEAT_P, foma); pos = vlerp(V(8.3, FLOOR, 5.4), seat, easeOut(k)); pos.y += Math.sin(k * Math.PI) * 0.9; rotY = lerp(0.4, Math.PI / 2, k); pose = mix(P.dive(), P.sit(), seg(k, 0.6, 1)); }
  else if (t < T.end) {
    const cs = carState(t); pos = seatWorld(SEAT_P, foma); rotY = -Math.PI / 2 + 0.0; pose = P.sit();
    if (speaking('F5', t)) { pose = mix(P.sit(), { ...P.sit(), lean: -0.15, lsx: -2.8, rsx: -2.8, lsz: 1.0, rsz: -1.0, le: -1.9, re: -1.9 }, 0.9); eye.h = 0.5; glow = 0.3; } // hands behind head, chill
    if (t > T.reveal) { look = carLocal(SEAT_D.clone().add(V(0, 1.0, 0))); eye.h = 1.1; }
    if (t > T.reveal + 0.25 && t < vo('F6').t0) { pose = mix(P.sit(), { ...P.sit(), lean: -0.2 }, 0.8); }
    if (speaking('F6', t) || (t > vo('F6').t0 && t < T.launch)) { pose = mix(P.sit(), { ...P.sit(), lean: 0.12, rsx: -1.3, re: -1.0 }, 0.9); look = 'camera'; eye.h = 0.75; glow = 1.0; }
    if (t > T.launch && t < T.ret[0]) { pose = mix(P.sit(), { ...P.sit(), lean: -0.45, hx: -0.4, lsx: -2.2, rsx: -2.2, lsz: 0.8, rsz: -0.8 }, 1); eye.h = 1.4; }
    if (t >= T.ret[0]) { pose = P.sit(); look = carLocal(V(0, 1.4, -3)); eye.h = 1.3; }
    if (t > T.ret[1] && t < T.ret[1] + 0.15) pose = { ...P.sit(), lean: 0.4 };
    if (speaking('F7', t)) { pose = mix(P.sit(), P.shock(t), 0.6); look = 'camera'; eye.h = 1.45; glow = 0.8; }
    if (t > vo('F7').t1) { look = carLocal(SEAT_D.clone().add(V(0, 1.0, 0))); eye.h = 0.9; pose = P.sit(); }
    if (t > T.popup[0]) { look = 'camera'; eye.h = 0.45; glow = 0.55; }
    if (t > vo('F8').t0) { look = 'camera'; eye.h = 0.5; glow = 0.6; }
    if (t > vo('F8').t1) { glow = 1.0; eye.h = 0.42; }
  }
  return { pos, rotY, pose, look, glow, eye };
}
function cashierState(t) {
  let pos = CASH_POS.clone(), rotY = 0, pose = P.idle(t), mood = 'smile', talk = 0, look = null;
  if (t < T.ret[0]) {
    if (speaking('C1', t)) { pose = P.wave(t); talk = Math.abs(Math.sin(t * 16)); }
    if (speaking('C2', t)) { pose = P.talk(t); talk = Math.abs(Math.sin(t * 16)); mood = 'smile'; }
    if (t > vo('C2').t1) { mood = 'smug'; }
    if (t >= T.slam[0] - 0.15 && t < T.slam[1] + 0.3) { const k = easeIn(seg(t, T.slam[0] - 0.15, T.slam[0] + 0.12)); pose = P.slam(k); mood = 'angry'; rotY = 0.35; }
    if (t > T.slam[1] + 0.3) { mood = 'angry'; pose = P.point(); }
    if (speaking('C3', t) || (t > vo('C3').t0 && t < vo('C3').t1 + 0.2)) { pose = P.scream(t); mood = 'scream'; talk = 0.6 + 0.4 * Math.abs(Math.sin(t * 20)); }
    if (t > vo('C3').t1 + 0.2) { pose = P.point(); mood = 'angry'; }
    look = 'foma';
  } else { pos = V(-1.0, FLOOR, 5.0); rotY = 0.15; pose = P.crossed(t); mood = 'smug'; }
  return { pos, rotY, pose, mood, talk, look };
}
const CHEF_OFF = [V(0, 0, 0), V(0.9, 0, 0.8), V(-0.8, 0, 0.9), V(1.6, 0, -0.6), V(0.4, 0, 1.7)];
function chefState(i, t) {
  const off = CHEF_OFF[i]; let pos, rotY = 0, pose = P.idle(t + i), mood = 'angry', vis = true;
  if (t < T.chefsOut) { vis = false; pos = V(3.1, FLOOR, -6.5); }
  else if (t < T.runStart) { const k = seg(t, T.chefsOut + i * 0.1, T.chefsOut + 0.9 + i * 0.1); pos = vlerp(V(3.1, FLOOR, -5.6), V(4.6 + off.x * 0.6, FLOOR, -0.6 + off.z * 0.5), easeOut(k)); rotY = Math.PI * 0.85; pose = k < 1 ? P.chefRun(t * 14 + i, i) : P.crossed(t); if (k >= 1) pose = { ...P.idle(t), lsx: -2.4, lsz: 0.4, rsx: -2.2, rsz: -0.4, le: -0.3, re: -0.3 }; rotY = -Math.PI / 2 + 0.3; }
  else if (t < T.kitchen) { const f = fomaState(Math.max(T.runStart, t - 0.55 - i * 0.12)); pos = f.pos.clone().add(V(1.0 + off.x, 0, off.z * 0.6)); pos.y = FLOOR; rotY = -Math.PI / 2; pose = P.chefRun(t * 13 + i, i); }
  else if (t < T.street) { vis = i < 2; const k = seg(t, T.kitchen + 0.45, T.street); pos = V(-0.6 + k * 2.0 - i * 1.0, FLOOR, -6.2 + i * 0.4); rotY = Math.PI / 2; pose = P.chefRun(t * 13 + i, i); }
  else if (t < T.launch) { const st = T.street + 0.35 + i * 0.16; const k = seg(t, st, st + 1.4); vis = t > st; pos = vlerp(V(6.4, FLOOR, 1.0), V(7.2 + off.x * 0.7, FLOOR, 5.0 + off.z * 0.5), easeOut(k)); rotY = Math.atan2(0.8, 4); pose = k < 1 ? P.chefRun(t * 13 + i, i) : { ...P.idle(t), lsx: -2.4 + 0.4 * Math.sin(t * 9 + i), rsx: -2.2, lsz: 0.4, rsz: -0.4, le: -0.3, re: -0.3 }; }
  else if (t < T.ret[0]) { pos = V(7.2 + off.x * 0.7, FLOOR, 5.0 + off.z * 0.5); const k = easeOut(seg(t, T.launch + 0.1 + i * 0.03, T.launch + 0.45)); pose = P.fallBack(k); rotY = 0.3; pos.z -= k * 0.8; }
  else { pos = V(-5.2 + i * 1.35, FLOOR, 4.6 + (i % 2) * 0.3); if (i === 2) pos.x += 0.6; rotY = 0; pose = P.crossed(t + i); }
  return { pos, rotY, pose, mood, vis };
}
function playerState(t) {
  const pos = seatWorld(SEAT_D, player); let rotY = -Math.PI / 2, pose = P.drive(t), mood = 'smile', talk = 0, look = null;
  if (t > T.reveal && t < T.launch) { look = 'foma'; mood = 'surprised'; }
  if (speaking('P1', t)) { talk = Math.abs(Math.sin(t * 16)); pose = { ...P.drive(t), lean: -0.12 }; }
  if (t > T.launch && t < T.ret[0]) { mood = 'smug'; look = null; pose = { ...P.drive(t), lsz: 0.3 * Math.sin(t * 8), rsz: 0.3 * Math.sin(t * 8) }; }
  if (t >= T.ret[0]) { mood = 'deadpan'; look = 'foma'; }
  if (speaking('P2', t)) { talk = Math.abs(Math.sin(t * 15)); mood = 'deadpan'; if (t > vo('P2').t0 + 0.9) { pose = { ...P.drive(t), lsx: -1.4, lsz: 0.4, le: -0.1 }; } }
  return { pos, rotY, pose, mood, talk, look };
}

// ---------- SHOTS ----------
function setCam(pos, target, fov = 50, roll = 0) { cam.position.copy(pos); cam.up.set(0, 1, 0); cam.lookAt(target); if (roll) cam.rotateZ(roll); cam.fov = fov; cam.updateProjectionMatrix(); }
const shake = (a, t, s = 0) => V(noise1(t * 37, s) * a, noise1(t * 41, s + 3) * a, noise1(t * 29, s + 7) * a * 0.5);
const punch = (t, at, amt = 0.18, dur = 0.25) => t < at ? 0 : amt * Math.exp(-(t - at) / dur * 3) * (t - at < dur * 2 ? 1 : 0); // zoom punch (fov shrink)
const fHead = () => headWorld(foma);
const SHOTS = [
  { id: 'A1', t0: 0.0, t1: 1.55, f(t, u) { setCam(vlerp(V(-3.2, 1.2, 12.5), V(-3.1, 1.75, 8.2), easeOut(u)), V(-2.6, 2.3, 2.5), lerp(55, 46, u)); } },
  { id: 'A2', t0: 1.55, t1: T.enter, f(t, u) { const h = fHead(); setCam(h.clone().add(V(0.15, -0.05, lerp(2.2, 0.95, easeIn(u)))), h.clone().add(V(0, -0.08, 0)), lerp(38, 30, u)); } },
  { id: 'B1', t0: T.enter, t1: 4.6, f(t, u) { setCam(V(-1.2, 2.2, -1.2), fHead().add(V(0, -0.5, 0)), 52); } },
  { id: 'B2', t0: 4.6, t1: 5.8, f(t, u) { const h = headWorld(cashier); setCam(h.clone().add(V(-0.45, 0.05, 1.5 - 0.2 * u)), h.clone().add(V(0, -0.15, 0)), 40); } },
  { id: 'B3', t0: 5.8, t1: vo('C2').t0, f(t, u) { const h = fHead(); setCam(h.clone().add(V(0.55, 0.0, -1.7 + 0.2 * u)), h.clone().add(V(0, -0.25, 0)), 40); } },
  { id: 'B4', t0: vo('C2').t0, t1: 9.0, f(t, u) { const h = headWorld(cashier); setCam(h.clone().add(V(0.35, 0.05, 1.4)), h.clone().add(V(0, -0.12, 0)), 40 * (1 - punch(t, vo('C2').t0 + 0.45, 0.35))); } },
  { id: 'B4b', t0: 9.0, t1: 9.6, f(t, u) { const p = V(0.35, FLOOR + 1.63, -2.35); setCam(p.clone().add(V(0.05, 0.05, 0.62 - 0.1 * u)).add(shake(0.004, t, 8)), p, 40); } },
  { id: 'B5', t0: 9.6, t1: vo('F3').t1, f(t, u) { const h = fHead(); setCam(h.clone().add(V(lerp(1.6, 1.15, ease(u)), 0.02 + 0.06 * u, 0.15 + 0.1 * u)), h.clone().add(V(0, -0.06, 0)), 34 * (1 - punch(t, vo('F3').t0 + 1.95, 0.3))); } },
  { id: 'C1', t0: vo('F3').t1, t1: T.chefsOut, f(t, u) { setCam(BTN.clone().add(V(0.55, 0.25, 0.75)).add(shake(0.04 * seg(t, T.slam[0], T.slam[0] + 0.05) * (1 - seg(t, T.slam[0] + 0.05, T.slam[1])), t)), BTN.clone().add(V(0, -0.05, 0)), 42); } },
  { id: 'C2', t0: T.chefsOut, t1: vo('C3').t0, f(t, u) { setCam(V(-1.2, 2.9, 0.6).add(shake(0.03, t, 2)), V(3.1, 1.3, -4.6), 58); } },
  { id: 'C3', t0: vo('C3').t0, t1: vo('C3').t1 + 0.02, f(t, u) { const h = headWorld(cashier); setCam(h.clone().add(V(0.25, -0.15, 1.2)).add(shake(0.02, t, 3)), h, 40 * (1 - punch(t, vo('C3').t0, 0.25)), 0.2); } },
  { id: 'C4', t0: vo('C3').t1 + 0.02, t1: T.runStart, f(t, u) { const h = fHead(); setCam(h.clone().add(V(-0.45, -0.25, 2.1 - 0.4 * u)).add(shake(0.015, t, 4)), h.clone().add(V(0, -0.35, 0)), 44); } },
  { id: 'C5', t0: T.runStart, t1: 18.5, f(t, u) { const p = foma.root.position; setCam(V(p.x + 1.4, 1.7, 1.95), V(p.x - 0.8, 1.55, -0.6), 72); } },
  { id: 'C6', t0: 18.5, t1: T.kitchen, f(t, u) { setCam(V(-5.55, 0.55, 1.7), V(-4.0, 0.9, -0.6), 66); } },
  { id: 'C7', t0: T.kitchen, t1: T.street, f(t, u) { const p = foma.root.position; setCam(V(p.x + 0.3, 2.0, -5.35), V(p.x + 1.3, 1.45, -7.0), 62); } },
  { id: 'D1', t0: T.street, t1: T.dive[0], f(t, u) { setCam(V(10.4, 1.9, 4.0), V(6.4, 1.2, 1.2), 56); } },
  { id: 'D2', t0: T.dive[0], t1: T.dive[1] + 0.05, f(t, u) { setCam(V(9.6, 1.4, 4.2), carLocal(V(0, 1.1, 0)), 46); } },
  { id: 'D3', t0: T.dive[1] + 0.05, t1: T.reveal, f(t, u) { setCam(carLocal(V(-1.05, 1.95, -0.42)), headWorld(foma).add(V(0, -0.12, 0)), 56); } },
  { id: 'D4', t0: T.reveal, t1: vo('P1').t1 + 0.1, f(t, u) { const k = easeOut(seg(t, T.reveal, T.reveal + 0.25)); setCam(carLocal(V(-1.05, 1.95, lerp(-0.42, 0.42, k))), vlerp(headWorld(foma), headWorld(player), k).add(V(0, -0.12, 0)), 58); } },
  { id: 'D5', t0: vo('P1').t1 + 0.1, t1: T.launch, f(t, u) { const h = fHead(); setCam(carLocal(V(-1.05, 1.95, -0.42)).lerp(h, 0.25 + 0.35 * easeIn(u)), h.clone().add(V(0, -0.04, 0)), 42); } },
  { id: 'D6', t0: T.launch, t1: T.ret[0], f(t, u) { setCam(V(7.0, 0.7, 13.0).add(shake(0.06 * (1 - u), t, 5)), V(car.position.x - 1, 0.9, 8.4), 48); } },
  { id: 'E1', t0: T.ret[0], t1: vo('F7').t0, f(t, u) { setCam(V(-6.5, 1.5, 15.0).add(shake(0.05 * seg(t, T.ret[1], T.ret[1] + 0.05) * (1 - seg(t, T.ret[1] + 0.05, T.ret[1] + 0.3)), t, 6)), V(-2.2, 1.4, 6.5), 46); } },
  { id: 'E2', t0: vo('F7').t0, t1: vo('F7').t1 + 0.05, f(t, u) { setCam(carLocal(V(-1.05, 1.95, -0.42)), headWorld(foma).add(V(0, -0.12, 0)), 54 * (1 - punch(t, vo('F7').t0, 0.22))); } },
  { id: 'E3', t0: vo('F7').t1 + 0.05, t1: T.popup[0], f(t, u) { setCam(carLocal(V(-1.05, 1.95, 0.42)), headWorld(player).add(V(0, -0.12, 0)), 58 * (1 - punch(t, vo('P2').t0 + 0.85, 0.15))); } },
  { id: 'E4', t0: T.popup[0], t1: vo('F8').t0, f(t, u) { setCam(V(-2.0, 2.0, lerp(13.5, 12.3, u)), V(-2.2, 1.2, 6.6), 50); } },
  { id: 'E5', t0: vo('F8').t0, t1: vo('F8').t1, f(t, u) { setCam(carLocal(V(-1.05, 1.95, -0.42)), headWorld(foma).add(V(0, -0.1, 0)), 50); } },
  { id: 'E6', t0: vo('F8').t1, t1: T.end + 0.01, f(t, u) { const h = headWorld(foma); setCam(carLocal(V(-1.05, 1.95, -0.42)).lerp(h, 0.2 * easeOut(seg(u, 0, 0.3))), h.clone().add(V(0, 0.02, 0)), lerp(50, 24, easeOut(seg(u, 0, 0.3)))); } },
];
const shotAt = t => SHOTS.find(s => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1];

// ---------- OVERLAYS ----------
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
const SUBS = window.SUBS || [];
function drawSub(s, t) {
  const k = easeOut(seg(t, s.t0, s.t0 + 0.09));
  const lines = s.text.split('\n');
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const baseY = s.y || 1360;
  lines.forEach((line, li) => {
    // words marked *like this* are highlighted (bigger + yellow)
    const parts = line.split(/(\*[^*]+\*)/).filter(Boolean).map(p => p.startsWith('*') ? { txt: p.slice(1, -1), hi: true } : { txt: p, hi: false });
    const base = s.size || 74;
    const fontFor = p => `900 ${p.hi ? Math.round(base * 1.32) : base}px Inter`;
    let total = 0; for (const p of parts) { ctx.font = fontFor(p); total += ctx.measureText(p.txt).width; }
    const scale = Math.min(1, 960 / total);
    let x = W / 2 - total * scale / 2; const y = baseY + (li - (lines.length - 1) / 2) * base * 1.25;
    for (const p of parts) {
      ctx.font = fontFor(p); const w = ctx.measureText(p.txt).width;
      ctx.save(); ctx.translate(x + w * scale / 2, y); const pop = p.hi ? 1 + 0.25 * (1 - k) + 0.04 * Math.sin(t * 20) : 0.92 + 0.08 * k; ctx.scale(scale * pop, scale * pop); ctx.globalAlpha = k;
      ctx.lineWidth = 16; ctx.strokeStyle = '#000'; ctx.strokeText(p.txt, 0, 0); ctx.fillStyle = p.hi ? (s.color || '#ffd21a') : '#fff'; ctx.fillText(p.txt, 0, 0); ctx.restore();
      x += w * scale;
    }
  });
  ctx.restore();
}
function overlay(t) {
  // "Через 10 секунд…"
  if (t > 2.85 && t < T.enter) {
    const k = easeOut(seg(t, 2.85, 3.05)); ctx.save(); ctx.translate(W / 2, 520); ctx.rotate(-0.06); ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k); ctx.globalAlpha = k;
    ctx.fillStyle = '#000'; rr(ctx, -430, -95, 860, 190, 30); ctx.fill(); ctx.strokeStyle = '#ffd21a'; ctx.lineWidth = 8; rr(ctx, -430, -95, 860, 190, 30); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'italic 900 100px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Через 10 секунд…', 0, 6); ctx.restore();
  }
  // siren red flash vignette
  if (t > T.chefsOut && t < T.street) { const a = 0.18 * (0.5 + 0.5 * Math.sin(t * 18)); const gr = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75); gr.addColorStop(0, 'rgba(255,0,0,0)'); gr.addColorStop(1, `rgba(255,0,0,${a})`); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
  // account blocked popup
  if (t > T.popup[0] && t < T.end) {
    const k = easeOut(seg(t, T.popup[0], T.popup[0] + 0.15)); const fade = t > vo('F8').t0 ? 1 - seg(t, vo('F8').t0, vo('F8').t0 + 0.2) : 1;
    ctx.save(); ctx.globalAlpha = fade; ctx.fillStyle = `rgba(0,0,0,${0.55 * k})`; ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, 860); { const pz = (0.8 + 0.2 * k) * (1 + 0.025 * Math.sin((t - T.popup[0]) * 9) * k); ctx.rotate(0.012 * Math.sin((t - T.popup[0]) * 7)); ctx.scale(pz, pz); }
    const w = 900, h = 560; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 50; ctx.fillStyle = '#393b3d'; rr(ctx, -w / 2, -h / 2, w, h, 28); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '800 58px Inter'; ctx.fillText('Отключено', 0, -h / 2 + 90);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-w / 2 + 40, -h / 2 + 130, w - 80, 3);
    ctx.font = '800 50px Inter'; ctx.fillStyle = '#fff';
    ['ВАШ АККАУНТ ЗАБЛОКИРОВАН', 'ЗА НЕУПЛАТУ', '1 БУРГЕРА'].forEach((l, i) => { ctx.fillStyle = i === 2 ? '#ffd21a' : '#fff'; ctx.font = i === 2 ? '900 70px Inter' : '800 50px Inter'; ctx.fillText(l, 0, -h / 2 + 215 + i * 72); });
    ctx.fillStyle = '#ffffff'; rr(ctx, -170, h / 2 - 120, 340, 84, 16); ctx.fill(); ctx.fillStyle = '#393b3d'; ctx.font = '800 44px Inter'; ctx.fillText('Выйти', 0, h / 2 - 66);
    ctx.restore();
  }
  for (const s of SUBS) if (t >= s.t0 && t <= s.t1) drawSub(s, t);
}

// ---------- FRAME ----------
function drawRegister(t) {
  const c = rest.userData.regC, g = c.getContext('2d'); g.fillStyle = '#062b14'; g.fillRect(0, 0, 256, 128);
  const showPrice = t > vo('C2').t0 + 0.4; g.fillStyle = showPrice && Math.floor(t * 6) % 2 ? '#ff4040' : '#3dff7a'; g.font = '900 70px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(showPrice ? '9999' : (t > vo('F2').t1 ? '...' : '0'), 128, 64); rest.userData.regTex.needsUpdate = true;
}
function update(t) {
  // car
  const cs = carState(t); car.position.copy(cs.pos); car.rotation.set(0, 0, cs.nose);
  const dist = t >= T.launch ? (t < T.ret[0] ? CAR_PARK.x - cs.pos.x : 40 - cs.pos.x) : 0; for (const w of wheels) w.rotation.z = dist / 0.36;
  car.updateMatrixWorld(true);
  // puffs: launch smoke + stop skid
  puffs.forEach((p, i) => { const tl = i < 8 ? T.launch : T.ret[1] - 0.15; const d = t - tl - (i % 8) * 0.03; if (d < 0 || d > 1.2) { p.visible = false; return; } p.visible = true; const base = i < 8 ? CAR_PARK.clone().add(V(2.3, 0.3, (i % 2 ? 0.9 : -0.9))) : CAR_STOP.clone().add(V(1.5 + (i % 4) * 0.5, 0.3, (i % 2 ? 1 : -1))); p.position.copy(base).add(V(d * (1.5 + i % 3), d * 1.1, (i % 2 ? 1 : -1) * d * 0.8)); p.scale.setScalar(0.6 + d * 2.4); p.material.opacity = 0.85 * (1 - d / 1.2); });
  // doors
  doorSlabs.front.rotation.y = t > 3.7 && t < 4.7 ? -1.3 * Math.sin(seg(t, 3.7, 4.7) * Math.PI) : 0;
  const kd = t > T.chefsOut - 0.05 && t < T.chefsOut + 1.3 ? Math.sin(seg(t, T.chefsOut - 0.05, T.chefsOut + 1.3) * Math.PI) * 1.4 : 0;
  doorSlabs.kitchenL.rotation.y = kd; doorSlabs.kitchenR.rotation.y = -kd;
  doorSlabs.side.rotation.y = t > T.street - 0.1 && t < T.street + 2.6 ? -1.5 * easeOut(seg(t, T.street - 0.1, T.street + 0.08)) * (1 - seg(t, T.street + 2.0, T.street + 2.6)) : 0;
  // furniture
  for (const c of chairs) chairAt(c, t);
  for (const f of flyers) flyerAt(f, t);
  const tbl = rest.userData.tables[0]; const jt = T.runStart + 0.55; if (t > jt) { const d = t - jt; tbl.tray.position.set(-0.4 * d, 0.87 + 3.2 * d - 9 * d * d, 0.3 * d); tbl.tray.rotation.set(5 * d, 0, 3 * d); if (tbl.tray.position.y < -0.75) tbl.tray.position.y = -0.75; } else { tbl.tray.position.set(0, 0.87, 0); tbl.tray.rotation.set(0, 0, 0); }
  // siren
  const sir = t > T.chefsOut - 0.05 && t < T.street + 0.2; beacon.rotation.y = t * 9; beacon.children[0].material.emissiveIntensity = sir ? 2.5 : 0.2;
  sirenLights.forEach((l, i) => l.intensity = sir ? 14 * Math.max(0, Math.sin(t * 18 + i * 2.1)) : 0);
  rest.userData.dome.position.y = 0.1 - (t > T.slam[0] && t < T.slam[0] + 0.4 ? 0.05 : 0); rest.userData.dome.material.emissiveIntensity = sir ? 1.5 : 0.3;
  drawRegister(t);
  // characters
  const fs = fomaState(t); applyPose(foma, fs.pos, fs.rotY, fs.pose); foma.state = fs; drawFomaMask({ h: fs.eye.h, px: fs.eye.px, glow: fs.glow });
  if (fs.look && fs.look !== 'camera') lookAtWorld(foma, fs.look, 0.9);
  const cst = cashierState(t); applyPose(cashier, cst.pos, cst.rotY, cst.pose); drawNPCFace(cashier.face.c.getContext('2d'), cst.mood, cst.talk); cashier.face.t.needsUpdate = true;
  if (cst.look === 'foma') lookAtWorld(cashier, headWorld(foma), 0.8);
  if (cst.pose === undefined) {}
  if (t < T.ret[0] && t > T.slam[1] + 0.3) aimArm(cashier, 1, headWorld(foma), 0.9);
  chefs.forEach((c, i) => { const s = chefState(i, t); c.root.visible = s.vis; applyPose(c, s.pos, s.rotY, s.pose); drawNPCFace(c.face.c.getContext('2d'), s.mood, 0); c.face.t.needsUpdate = true; });
  const ps = playerState(t); applyPose(player, ps.pos, ps.rotY, ps.pose); drawNPCFace(player.face.c.getContext('2d'), ps.mood, ps.talk); player.face.t.needsUpdate = true;
  if (ps.look === 'foma') lookAtWorld(player, headWorld(foma), 0.9);
  if (speaking('P2', t) && t > vo('P2').t0 + 0.9) aimArm(player, 0, carLocal(V(0, 1.5, -4)), 0.9); // points at the restaurant
  player.root.visible = t > T.dive[0] - 0.5;
  car.userData.steer.rotation.z = t > T.launch ? 0.4 * Math.sin(t * 8) : 0;
  return fs;
}
function renderFrame(f) {
  const t = f / FPS, shot = shotAt(t);
  const fs = update(t);
  shot.f(t, (t - shot.t0) / (shot.t1 - shot.t0));
  if (fs.look === 'camera') lookAtWorld(foma, cam.position, 1);
  carGlass.visible = !['D3', 'D4', 'D5', 'E2', 'E3', 'E5', 'E6'].includes(shot.id);
  renderer.render(scene, cam);
  ctx.drawImage(renderer.domElement, 0, 0, W, H);
  overlay(t);
  return shot.id;
}
window.renderFrame = renderFrame;
window.grab = (q = 0.93) => out.toDataURL('image/jpeg', q);
window.TOTAL = TOTAL;
window.ready = document.fonts.load('900 60px Inter').then(() => document.fonts.load('italic 900 60px Inter')).then(() => true);
// character sheet renders
window.renderRef = (view) => {
  const keep = scene.background; scene.background = new THREE.Color(0x15151a); world.visible = false; car.visible = false; cashier.root.visible = false; player.root.visible = false; chefs.forEach(c => c.root.visible = false); puffs.forEach(p => p.visible = false);
  const poses = { front: [0, P.idle(0)], q: [-0.6, P.idle(0)], side: [-Math.PI / 2, P.idle(0)], back: [Math.PI, P.idle(0)], face: [0, P.idle(0)], run: [-0.5, P.run(1.2)], jump: [-0.4, P.air()], shock: [0, P.shock(0)], skeptic: [0.3, P.skeptic(0)], point: [0.4, P.point()], confused: [0.2, P.confused(0)] };
  const [ry, pose] = poses[view]; applyPose(foma, V(0, 0, 0), ry, pose); drawFomaMask({ h: view === 'shock' ? 1.4 : 0.8, px: 0, glow: 0.7 });
  const h = headWorld(foma);
  if (view === 'face') setCam(h.clone().add(V(0.25, 0.05, 1.3)), h, 30); else setCam(V(0, 1.2, 5.2), V(0, 1.05, 0), 40);
  const key = new THREE.PointLight(0xffffff, 30, 12, 1.5); key.position.set(2, 3, 4); scene.add(key);
  renderer.render(scene, cam); scene.remove(key); scene.background = keep; world.visible = true; car.visible = true;
  ctx.drawImage(renderer.domElement, 0, 0, W, H); return out.toDataURL('image/jpeg', 0.92);
};
window.__scene = { THREE, scene, foma, P, applyPose, makeClips: null };
window.__dbg = () => { const f = v => v.toArray().map(x => +x.toFixed(2)); const h = headWorld(foma); return { cam: f(cam.position), foma: f(foma.root.position), head: f(h), ndc: f(h.clone().project(cam)), vis: foma.root.visible }; };
// ---------- exports: GLB with animation clips, cover ----------
function nameRig(rig, prefix = '') {
  rig.root.name = prefix + 'Root'; rig.body.name = prefix + 'Body'; rig.pelvis.name = prefix + 'LowerTorso'; rig.chest.name = prefix + 'UpperTorso'; rig.neck.name = prefix + 'Head';
  ['Left', 'Right'].forEach((s, i) => { rig.sh[i].name = prefix + s + 'UpperArm'; rig.el[i].name = prefix + s + 'LowerArm'; rig.hand[i].name = prefix + s + 'Hand'; rig.hip[i].name = prefix + s + 'UpperLeg'; rig.kn[i].name = prefix + s + 'LowerLeg'; });
}
window.exportGLB = async () => {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  nameRig(foma);
  const joints = [foma.body, foma.pelvis, foma.chest, foma.neck, ...foma.sh, ...foma.el, ...foma.hip, ...foma.kn];
  const defs = {
    Idle: [2.0, t => P.idle(t)], Walk: [0.7, t => P.walk(t / 0.7 * Math.PI * 2)], Run: [0.42, t => P.run(t / 0.42 * Math.PI * 2)],
    Jump: [0.9, t => t < 0.15 ? mix(Z(), P.crouch(), t / 0.15) : t < 0.7 ? { ...P.air(), py: Math.sin((t - 0.15) / 0.55 * Math.PI) * 1.4 } : mix(P.land(), Z(), (t - 0.7) / 0.2)],
    Landing: [0.4, t => mix(P.land(), Z(), t / 0.4)], HeadTurn: [0.6, t => ({ ...P.idle(t), hy: lerp(0, 1.25, ease(t / 0.6)) })],
    Confused: [1.5, t => P.confused(t)], Shock: [1.0, t => P.shock(t)], Pointing: [1.0, t => mix(Z(), P.point(), ease(Math.min(1, t / 0.3)))],
    Driving: [2.0, t => P.drive(t)], LookAtCamera: [0.5, t => ({ ...P.idle(t), hy: lerp(1.1, 0, ease(t / 0.5)), hx: lerp(0, -0.05, t / 0.5) })],
    Skeptic: [1.2, t => P.skeptic(t)], Dive: [0.6, t => P.dive()],
  };
  const clips = [];
  for (const [name, [dur, fn]] of Object.entries(defs)) {
    const times = [], q = joints.map(() => []), bp = [], bs = [];
    for (let f = 0; f <= Math.round(dur * 30); f++) {
      const t = f / 30; applyPose(foma, V(0, 0, 0), 0, fn(t)); times.push(t);
      joints.forEach((j, i) => q[i].push(...j.quaternion.toArray())); bp.push(...foma.body.position.toArray()); bs.push(...foma.body.scale.toArray());
    }
    const tracks = joints.map((j, i) => new THREE.QuaternionKeyframeTrack(j.name + '.quaternion', times, q[i]));
    tracks.push(new THREE.VectorKeyframeTrack('Body.position', times, bp), new THREE.VectorKeyframeTrack('Body.scale', times, bs));
    clips.push(new THREE.AnimationClip(name, dur, tracks));
  }
  applyPose(foma, V(0, 0, 0), 0, Z()); drawFomaMask({ h: 0.8, px: 0, glow: 0.7 });
  const halos = foma.halo; halos.forEach(h => h.parent.remove(h));
  const glb = await new GLTFExporter().parseAsync(foma.root, { binary: true, animations: clips });
  halos.forEach(h => foma.neck.add(h));
  const u8 = new Uint8Array(glb); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return { b64: btoa(s), clips: clips.map(c => c.name) };
};
window.renderCover = () => {
  const t = 11.9, shot = shotAt(t); update(t); shot.f(t, (t - shot.t0) / (shot.t1 - shot.t0)); lookAtWorld(foma, cam.position, 1);
  cam.position.add(cam.getWorldDirection(new THREE.Vector3()).multiplyScalar(-0.9)); cam.position.y += 0.15; cam.lookAt(headWorld(foma).add(V(0, -0.35, 0))); cam.fov = 44; cam.updateProjectionMatrix(); renderer.render(scene, cam); ctx.drawImage(renderer.domElement, 0, 0, W, H);
  const gr = ctx.createLinearGradient(0, 0, 0, 700); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, 700);
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  const big = (txt, y, size, col) => { ctx.font = `900 ${size}px Inter`; ctx.lineWidth = 22; ctx.strokeStyle = '#000'; ctx.strokeText(txt, W / 2, y); ctx.fillStyle = col; ctx.fillText(txt, W / 2, y); };
  big('БУРГЕР ЗА', 250, 130, '#fff'); big('9999 R$?!', 420, 190, '#ffd21a');
  ctx.save(); ctx.translate(820, 1560); ctx.rotate(-0.12); ctx.fillStyle = '#e0302a'; rr(ctx, -200, -80, 400, 160, 30); ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = '#fff'; rr(ctx, -200, -80, 400, 160, 30); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = '900 64px Inter'; ctx.fillText('ЗАБАН?!', 0, 24); ctx.restore();
  return out.toDataURL('image/png');
};
