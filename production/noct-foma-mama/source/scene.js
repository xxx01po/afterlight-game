// «Я ПРОСТО ХОТЕЛ КУПИТЬ БУРГЕР» — Roblox-style comedy short with FOMA. Deterministic per-frame renderer.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const W = 1080, H = 1920, FPS = 30, TOTAL = 1050; // 35.0 s
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
scene.fog = new THREE.Fog(0xcfe6ff, 40, 120);
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


const FLOOR = 0;
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

// ======================= NOCT · FOMA — «МАМА ПРИДЁТ ЧЕРЕЗ 30 СЕКУНД» =======================
// Room x -5..5, z -4..4, h 3. Table (0,0) · fridge (-4.2,-3.3) · dog bed (3,-2.6) · front door east wall x=5 z 1.2..2.4 · window north wall z=-4 x 1.6..3.4
const RH = 3.0;
const world = new THREE.Group(); scene.add(world);
const wb = (x0, x1, y0, y1, z0, z1, mat) => add(world, box(x1 - x0, y1 - y0, z1 - z0, mat, 0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
const wallpaper = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#cfe3f2'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.45)'; for (let y = 16; y < h; y += 48) for (let x = 16 + (y / 48 % 2) * 24; x < w; x += 48) { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); } g.fillStyle = '#9fbfd8'; g.fillRect(0, 210, w, 46); }, [5, 1]);
const parquet = canvasTex(256, 256, (g, w, h) => { const r = rng(17); for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { g.fillStyle = `hsl(28,42%,${40 + r() * 10}%)`; g.fillRect(x * 64 + (y % 2) * 32, y * 32, 64, 32); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x * 64 + (y % 2) * 32, y * 32, 2, 32); } }, [5, 4]);
const mW = M(0xffffff, 0.9, { map: wallpaper });
const frontDoor = new THREE.Group(), winSash = new THREE.Group();
{
  add(world, box(10, 0.06, 8, M(0xffffff, 0.7, { map: parquet }), 0), 0, -0.03, 0).receiveShadow = true;
  add(world, box(10, 0.08, 8, M(0xf6f6f6, 0.9), 0), 0, RH + 0.04, 0);
  wb(-5.2, -5, 0, RH, -4, 4, mW); wb(-5, 5, 0, RH, 4, 4.2, mW);
  wb(5, 5.2, 0, RH, -4, 1.2, mW); wb(5, 5.2, 0, RH, 2.4, 4, mW); wb(5, 5.2, 2.3, RH, 1.2, 2.4, mW);
  wb(-5, 1.6, 0, RH, -4.2, -4, mW); wb(3.4, 5, 0, RH, -4.2, -4, mW); wb(1.6, 3.4, 0, 1.0, -4.2, -4, mW); wb(1.6, 3.4, 2.3, RH, -4.2, -4, mW);
  // outside behind the window: sky + tree + bushes
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshBasicMaterial({ color: 0x9fd6ff })); sky.position.set(2.5, 2, -9); world.add(sky);
  add(world, box(12, 0.1, 6, M(0x58b85c, 0.9), 0), 2.5, 0, -7.2); add(world, box(1.6, 1.2, 1.2, M(0x3dbb55, 0.8), 0.25), 4.2, 0.6, -5.6); add(world, box(1.2, 1.0, 1.0, M(0x3dbb55, 0.8), 0.25), 0.6, 0.5, -5.8);
  // window frame + sash (opens outward on a hinge at x=1.6)
  const fm = M(0xffffff, 0.5); wb(1.55, 1.65, 1.0, 2.3, -4.15, -3.95, fm); wb(3.35, 3.45, 1.0, 2.3, -4.15, -3.95, fm); wb(1.55, 3.45, 0.95, 1.05, -4.25, -3.85, fm); wb(1.55, 3.45, 2.25, 2.35, -4.15, -3.95, fm);
  winSash.position.set(1.65, 1.05, -4.05); world.add(winSash);
  add(winSash, box(1.7, 1.2, 0.05, new THREE.MeshPhysicalMaterial({ color: 0xcfefff, transparent: true, opacity: 0.35, roughness: 0.1 }), 0), 0.85, 0.6, 0); add(winSash, box(1.7, 0.05, 0.07, fm, 0), 0.85, 0.6, 0); add(winSash, box(0.05, 1.2, 0.07, fm, 0), 0.85, 0.6, 0);
  // front door on the east wall (hinge at z=1.2)
  frontDoor.position.set(4.97, 0, 1.2); world.add(frontDoor);
  add(frontDoor, box(0.07, 2.3, 1.2, M(0x7a4a26, 0.6), 0.02), 0, 1.15, 0.6); add(frontDoor, box(0.1, 0.05, 0.16, M(0xd8c060, 0.3, { metalness: 0.8 }), 0.01), -0.05, 1.05, 1.05);
  const hall = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.4), new THREE.MeshBasicMaterial({ color: 0xffe2b8 })); hall.position.set(5.6, 1.2, 1.8); hall.rotation.y = -Math.PI / 2; world.add(hall);
  // kitchen: fridge with freezer door, counter
  const white = M(0xf4f6f8, 0.35);
  add(world, box(0.95, 1.4, 0.8, white, 0.05), -4.3, 0.7, -3.4);
  add(world, box(0.95, 0.6, 0.8, white, 0.05), -4.3, 1.75, -3.4);
  add(world, box(0.04, 0.3, 0.05, M(0x999999, 0.3, { metalness: 0.8 }), 0.01), -3.95, 1.0, -2.98);
  add(world, box(3.0, 0.9, 0.7, M(0xffffff, 0.5), 0.03), -2.2, 0.45, -3.6); add(world, box(3.0, 0.05, 0.75, M(0x3a3f47, 0.4), 0.01), -2.2, 0.93, -3.6);
  // living: sofa, TV, rug, lamp, table with candle
  add(world, box(2.4, 0.5, 0.9, M(0x5b6ee1, 0.8), 0.08), -2.4, 0.25, 2.8); add(world, box(2.4, 0.6, 0.25, M(0x4a5bc4, 0.8), 0.08), -2.4, 0.75, 3.2);
  add(world, box(1.8, 0.05, 1.2, M(0xd8584a, 0.9), 0), 0, 0.01, 0.4);
  add(world, box(1.6, 0.06, 1.0, M(0xc79356, 0.5), 0.02), 0, 0.78, 0); for (const [x, z] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]]) add(world, box(0.07, 0.76, 0.07, M(0x7a5230, 0.6), 0.01), x, 0.38, z);
  add(world, box(1.6, 0.9, 0.08, M(0x15161a, 0.3), 0.02), -2.4, 1.6, -0.4).rotation.y = 0;
  const posterT = canvasTex(256, 320, (g, w, h) => { g.fillStyle = '#ffcf3a'; g.fillRect(0, 0, w, h); g.fillStyle = '#2b2b33'; g.font = '900 54px Inter'; g.textAlign = 'center'; g.fillText('ROBLOX', w / 2, 140); g.fillText('ЧЕМПИОН', w / 2, 210); });
  const pst = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), M(0xffffff, 0.8, { map: posterT })); pst.position.set(-0.6, 1.8, -3.98); world.add(pst);
  // dog bed
  add(world, cyl(0.6, 0.65, 0.18, M(0x8a5a2b, 0.8), 20), 3.0, 0.09, -2.6);
  // smoke detector + sprinkler above the table
  add(world, cyl(0.12, 0.12, 0.05, M(0xffffff, 0.4), 16), 0, RH - 0.03, 0);
}
const ledMat = new THREE.MeshBasicMaterial({ color: 0x330000 }); add(world, new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), ledMat), 0.06, RH - 0.06, 0.06);
const freezerDoor = new THREE.Group(); freezerDoor.position.set(-3.82, 1.45, -3.0); world.add(freezerDoor); add(freezerDoor, box(0.06, 0.58, 0.95, M(0xf4f6f8, 0.35), 0.03), 0, 0.3, -0.47);
const candle = new THREE.Group(); candle.position.set(0.45, 0.81, -0.15); world.add(candle); add(candle, cyl(0.04, 0.04, 0.2, M(0xfff3d6, 0.6), 12), 0, 0.1, 0);
const flame = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb02e })); flame.scale.y = 1.8; flame.position.y = 0.24; candle.add(flame);
const flameLight = new THREE.PointLight(0xffa040, 0.8, 2, 2); flameLight.position.y = 0.3; candle.add(flameLight);

// the diary: open book with a live page texture
const diaryC = document.createElement('canvas'); diaryC.width = 512; diaryC.height = 360;
const diaryTex = new THREE.CanvasTexture(diaryC); diaryTex.colorSpace = THREE.SRGBColorSpace;
const diary = new THREE.Group(); world.add(diary);
add(diary, box(0.56, 0.03, 0.4, M(0x1f4fa8, 0.6), 0.01), 0, 0, 0);
const page = new THREE.Mesh(new THREE.PlaneGeometry(0.53, 0.37), new THREE.MeshStandardMaterial({ map: diaryTex, transparent: true, alphaTest: 0.5, roughness: 0.8 })); page.rotation.x = -Math.PI / 2; page.position.y = 0.017; diary.add(page);
function drawDiary(st) {
  const g = diaryC.getContext('2d'); g.clearRect(0, 0, 512, 360);
  g.fillStyle = st.wet ? '#dfe9f1' : '#fbf8ef'; g.fillRect(0, 0, 512, 360);
  g.strokeStyle = 'rgba(80,110,170,0.35)'; g.lineWidth = 2; for (let y = 50; y < 360; y += 30) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  g.fillStyle = '#c33'; g.fillRect(254, 0, 4, 360);
  g.fillStyle = '#334'; g.font = '700 30px Inter'; g.fillText('Математика', 24, 92); g.fillText('Русский', 24, 182); g.fillText('Физ-ра', 24, 272);
  g.fillStyle = '#2b6'; g.font = '900 54px Inter'; g.fillText('5', 200, 280);
  // the grade
  g.save(); g.fillStyle = '#e01919'; g.font = '900 210px Inter'; g.textAlign = 'center'; g.translate(380, 190); g.rotate(-0.12);
  g.fillText(st.grade || '2', 0, 70); g.restore();
  if (st.rub > 0) { g.fillStyle = `rgba(251,248,239,${Math.min(1, st.rub)})`; g.beginPath(); g.ellipse(380, 190, 70, 90, 0, 0, 7); g.fill(); }
  if (st.hole) { g.fillStyle = '#5a3a22'; g.beginPath(); g.ellipse(380, 200, 34, 26, 0.3, 0, 7); g.fill(); }
  if (st.frost) { g.fillStyle = `rgba(220,240,255,${0.6 * st.frost})`; g.fillRect(0, 0, 512, 360); }
  if (st.wet) { g.fillStyle = 'rgba(60,110,200,0.25)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(40 + i * 55, 60 + (i * 97) % 280, 26, 18, 0, 0, 7); g.fill(); } }
  if (st.bite) { g.globalCompositeOperation = 'destination-out'; for (const [x, y] of [[512, 300], [470, 340], [512, 250]]) { g.beginPath(); g.arc(x, y, 56, 0, 7); g.fill(); } g.globalCompositeOperation = 'source-over'; }
  diaryTex.needsUpdate = true;
}
const eraser = add(world, box(0.12, 0.05, 0.07, M(0xff7aa8, 0.6), 0.015), 0, 0, 0);
const pencil = add(world, cyl(0.012, 0.012, 0.28, M(0xffc928, 0.5), 8), 0, 0, 0);
const phone = add(world, box(0.08, 0.16, 0.012, M(0x111114, 0.3), 0.01), 0, 0, 0);
const pizza = add(world, box(0.5, 0.06, 0.5, M(0xc9a26b, 0.8), 0.01), 0, 0, 0);
// water drops for the sprinkler
const drops = []; { const r = rng(88), dm = new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.75 }); for (let i = 0; i < 70; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.12, 0.012), dm); d.userData = { x: (r() - 0.5) * 2.6, z: (r() - 0.5) * 2.2 + 0.4, o: r() }; world.add(d); drops.push(d); } }
const smokeT = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(120,120,125,0.8)'); gr.addColorStop(1, 'rgba(120,120,125,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
const iceT = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(230,245,255,0.85)'); gr.addColorStop(1, 'rgba(230,245,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
const puffs = [...Array(10)].map((_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: i < 5 ? smokeT : iceT, transparent: true, depthWrite: false })); scene.add(s); return s; });

// ---------- LIGHTS ----------
scene.add(new THREE.HemisphereLight(0xfff6ea, 0xb8a58a, 1.35));
const sun = new THREE.DirectionalLight(0xfff0d8, 1.4); sun.position.set(4, 9, -9); sun.target.position.set(0, 0, 0); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
for (const [x, z] of [[-2.5, -1.5], [2.5, -1.5], [0, 2]]) { const l = new THREE.PointLight(0xfff2e0, 6, 8, 1.6); l.position.set(x, RH - 0.3, z); scene.add(l); }
const alarmLight = new THREE.PointLight(0xff2020, 0, 5, 1.5); alarmLight.position.set(0, RH - 0.2, 0); scene.add(alarmLight);

// ---------- CAST ----------
const mom = npc({ skin: 0xf2c94c, shirt: 0xd23f7a, pants: 0x3a3f5a, shoe: 0x5a2a1e, extra(r) {
  add(r.neck, box(0.48, 0.14, 0.48, M(0x7a4a26, 0.7), 0.05), 0, 0.47, -0.01); add(r.neck, box(0.48, 0.32, 0.12, M(0x7a4a26, 0.7), 0.04), 0, 0.33, -0.2);
  add(r.neck, new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), M(0x7a4a26, 0.7)), 0, 0.6, -0.16);
  add(r.chest, box(0.5, 0.52, 0.02, M(0xffffff, 0.7), 0.01), 0, 0.24, 0.18); add(r.chest, box(0.3, 0.12, 0.02, M(0xffffff, 0.7), 0.01), 0, 0.58, 0.18);
  const bag = new THREE.Group(); bag.position.y = -0.1; r.hand[1].add(bag); add(bag, box(0.3, 0.24, 0.12, M(0x2b2b33, 0.5), 0.03), 0, -0.15, 0); } });
const courier = npc({ skin: 0xc68a5a, shirt: 0xe0302a, pants: 0x30303a, extra(r) { add(r.neck, box(0.48, 0.1, 0.48, M(0xe0302a, 0.5), 0.03), 0, 0.5, 0); add(r.neck, box(0.4, 0.04, 0.24, M(0xe0302a, 0.5), 0.02), 0, 0.46, 0.3);
  const lb = canvasTex(128, 64, (g) => { g.fillStyle = '#fff'; g.font = '900 30px Inter'; g.textAlign = 'center'; g.fillText('ПИЦЦА', 64, 42); }); const p = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshBasicMaterial({ map: lb, transparent: true })); p.position.set(0, 0.4, 0.175); r.chest.add(p); } });
// the dog (blocky)
const dog = { root: new THREE.Group() }; scene.add(dog.root);
{ const fur = M(0xc98a4b, 0.8), dark = M(0x6b4426, 0.8); const d = dog.root;
  add(d, box(0.42, 0.36, 0.8, fur, 0.06), 0, 0.5, 0);
  dog.head = new THREE.Group(); dog.head.position.set(0, 0.68, 0.42); d.add(dog.head);
  add(dog.head, box(0.36, 0.34, 0.34, fur, 0.07), 0, 0.05, 0.06); add(dog.head, box(0.2, 0.15, 0.2, M(0xe8c09a, 0.8), 0.04), 0, -0.04, 0.3); add(dog.head, box(0.08, 0.06, 0.05, M(0x111111, 0.4), 0.02), 0, 0.02, 0.41);
  for (const s of [-1, 1]) { add(dog.head, box(0.1, 0.2, 0.06, dark, 0.03), s * 0.17, 0.12, 0.0).rotation.z = s * 0.3; add(dog.head, box(0.05, 0.06, 0.02, M(0x111111, 0.3), 0.01), s * 0.08, 0.1, 0.235); }
  dog.legs = []; for (const [x, z] of [[-0.14, 0.28], [0.14, 0.28], [-0.14, -0.28], [0.14, -0.28]]) { const l = new THREE.Group(); l.position.set(x, 0.36, z); d.add(l); add(l, box(0.12, 0.36, 0.12, fur, 0.03), 0, -0.18, 0); dog.legs.push(l); }
  dog.tail = new THREE.Group(); dog.tail.position.set(0, 0.62, -0.4); d.add(dog.tail); add(dog.tail, box(0.07, 0.07, 0.3, fur, 0.03), 0, 0.05, -0.12);
  d.traverse(m => { if (m.isMesh) { m.castShadow = true; } }); }

// ---------- TIMELINE ----------
const TBL = V(0, 0, 0.82), FRIDGE = V(-3.2, 0, -2.4), DOGP = V(2.1, 0, -1.6), DOORP = V(3.9, 0, 1.8), WINP = V(2.5, 0, -3.25);
const B = { erase: 2.0, write: 5.0, fridge: 8.0, dog: 11.0, door: 14.0, fire: 17.0, call: 20.0, bite: 23.0, run: 26.0, zero: 29.0, end: 35.0 };
// beat starts snap to the voice timeline when it exists
function beats() { if (VO.length) { B.erase = vo('F1').t0 - 0.1; B.write = vo('F2').t0 - 0.9; B.fridge = vo('F3').t0 - 0.1; B.dog = vo('F4').t0 - 0.1; B.door = vo('F5').t0 - 0.7; B.fire = vo('F5').t1 + 1.4; B.call = vo('F6').t0 - 0.2; B.bite = vo('D1').t1 + 0.35; B.run = vo('F8').t0 - 0.15; B.zero = vo('M1').t1 + 0.1; } }
beats();
const timerVal = t => Math.max(0, Math.ceil(30 - t * 30 / B.zero));
function fomaState(t) {
  let pos = t < B.fridge ? TBL.clone().add(V(0, 0, 0.32)) : TBL.clone(), rotY = Math.PI, pose = P.idle(t), look = null, glow = 0.55, eye = { h: 0.9, px: 0 };
  if (t < B.erase) { pose = { ...P.idle(t), lean: 0.25, lsx: -1.1, rsx: -1.1, le: -0.7, re: -0.7, lsz: -0.2, rsz: 0.2, tilt: 0.04 * Math.sin(t * 30) }; look = V(0, 0.8, 0); eye.h = 1.35; glow = 0.8; }
  else if (t < B.write) { pose = { ...P.idle(t), lean: 0.3, rsx: -1.0 + 0.15 * Math.sin(t * 22), re: -0.8, rsy: 0.3 * Math.sin(t * 22), lsx: -0.6, le: -0.8 }; look = V(0, 0.8, 0); eye.h = 0.8;
    if (t > B.erase + 2.0) { pose = P.idle(t); look = 'camera'; eye.h = 1.3; } }
  else if (t < B.fridge) { pose = { ...P.idle(t), lean: 0.3, rsx: -1.05, re: -0.9, rsz: 0.05 * Math.sin(t * 9), lsx: -0.6, le: -0.8 }; look = V(0, 0.8, 0); eye.h = 0.7; if (speaking('F2', t)) { pose = P.confused(t); look = 'camera'; eye.h = 1.2; } }
  else if (t < B.dog) { pos = FRIDGE.clone(); rotY = Math.PI * 1.25; const k = seg(t, B.fridge, B.fridge + 0.8); pose = k < 1 ? { ...P.idle(t), lean: 0.2, lsx: -1.9, rsx: -1.9, le: -0.2, re: -0.2 } : { ...P.idle(t), lsx: -1.5, rsx: -1.5, lsz: 0.4, rsz: -0.4, le: -0.3, re: -0.3, lean: -0.05 + 0.08 * Math.sin(t * 12) }; look = V(-3.9, 1.7, -3.0); eye.h = 1.0; }
  else if (t < B.door) { pos = DOGP.clone().add(V(-0.5, 0, 0.7)); rotY = Math.PI * 0.8; pose = t < B.dog + 1.4 ? { ...P.idle(t), lean: 0.35, rsx: -1.2, re: -0.2 } : { ...P.idle(t), lsx: -1.1, le: -0.6 }; look = dog.head.getWorldPosition(new THREE.Vector3()); eye.h = t < B.dog + 1.6 ? 0.8 : 1.3; if (t > B.dog + 2.2) look = 'camera'; }
  else if (t < B.fire) { pos = DOORP.clone(); rotY = Math.PI / 2; pose = { ...P.idle(t), lsx: 0.6, le: -1.5, rsx: 0.6, re: -1.5, lean: -0.08 }; look = V(5, 1.5, 1.8); eye.h = 1.4; glow = 0.85; if (speaking('F5', t)) pose = { ...pose, sq: 1.05, py: 0.04 }; if (t > vo('F5').t1 + 0.6) { eye.h = 0.6; look = 'camera'; pose = { ...pose, lean: 0.1, sq: 0.97 }; } }
  else if (t < B.call) { pos = TBL.clone(); rotY = Math.PI; pose = { ...P.idle(t), lean: 0.2, lsx: -1.2, rsx: -1.2, le: -0.5, re: -0.5 }; look = V(0.45, 1.0, -0.15); eye.h = 0.7;
    if (t > B.fire + 1.0) { pose = { ...P.shock(t), sq: 0.96 }; look = V(0, 3, 0); eye.h = 1.4; } if (t > B.fire + 1.8) { pose = { ...P.idle(t), lean: 0.05, sq: 0.94, hx: 0.2 }; eye.h = 0.35; look = 'camera'; glow = 0.4; } }
  else if (t < B.bite) { pos = TBL.clone().add(V(0.3, 0, 0.6)); rotY = Math.PI * 0.85; pose = { ...P.idle(t), lsx: -0.35, le: -0.5, lsz: 0.2 }; eye.h = 0.9; if (t > vo('D1').t0 + 0.3) { look = V(0.05, 1.0, 0.95); eye.h = 1.3; } }
  else if (t < B.run) { pos = TBL.clone().add(V(0.3, 0, 0.6)); rotY = Math.PI * 0.85; pose = { ...P.idle(t), lsx: -1.4, lsz: -0.3, le: -1.4 + 0.15 * Math.abs(Math.sin(t * 9)), hx: 0.1 }; eye.h = 0.6; if (speaking('F7', t) || t > vo('F7').t0) { look = 'camera'; eye.h = 0.45; } }
  else if (t < B.zero + 0.2) { const k = ease(seg(t, B.run, B.run + 0.9)); pos = vlerp(TBL.clone().add(V(0.3, 0, 0.6)), WINP.clone().add(V(0, 0, 0.75)), k); rotY = Math.PI; pose = k < 1 ? P.run(t * 15) : { ...P.idle(t), rsx: -1.6, re: -0.3 }; eye.h = 1.0; glow = 0.75; if (t > vo('M1').t0 - 0.2) { pose = { ...P.shock(t), lean: -0.3 }; eye.h = 1.45; glow = 0.9; } }
  else { pos = V(0.9, 0, 0.6); rotY = -0.4; pose = { ...P.idle(t), lean: -0.03 }; look = 'mom'; eye.h = 1.2;
    if (t > vo('M2').t0 + 1.6) eye.h = 0.9; if (t > vo('M2').t1 - 0.4) { eye.h = 0.5; }
    if (speaking('F9', t) || (t > vo('F9').t0 - 0.3 && t < vo('M3').t0)) { look = 'camera'; eye.h = 0.42; glow = 1.0; pose = { ...P.idle(t), lsx: 0.25, rsx: 0.25, lsz: 0.75, rsz: -0.75, le: -2.0, re: -2.0, lean: -0.1, sq: 1.02 }; } // hands on hips, proud
    if (t > vo('M3').t0) { look = 'mom'; eye.h = 1.3; glow = 0.5; pose = { ...P.idle(t), sq: 0.97 }; } }
  return { pos, rotY, pose, look, glow, eye };
}
function dogState(t) {
  let pos = V(3.0, 0.08, -2.6), rotY = -0.6, wag = Math.sin(t * 20) * 0.5, headX = 0, walk = 0;
  if (t > B.dog && t < B.door) { const k = ease(seg(t, B.dog + 0.2, B.dog + 0.7)); pos = vlerp(V(3.0, 0.08, -2.6), DOGP.clone().add(V(0.2, 0, 0)), k); rotY = lerp(-0.6, -2.6, k); walk = k < 1 ? 1 : 0; headX = t > B.dog + 0.9 && t < B.dog + 1.5 ? 0.5 : 0; wag = Math.sin(t * 30) * 0.8; }
  if (t >= B.door && t < B.zero) { pos = V(2.4, 0.08, -1.0); rotY = -2.0; }
  if (t >= B.zero) { pos = V(-0.4, 0, 1.4); rotY = 0.6; }
  return { pos, rotY, wag, headX, walk };
}

// ---------- SHOTS ----------
function setCam(pos, target, fov = 50, roll = 0) { cam.position.copy(pos); cam.up.set(0, 1, 0); cam.lookAt(target); if (roll) cam.rotateZ(roll); cam.fov = fov; cam.updateProjectionMatrix(); }
const shake = (a, t, s = 0) => V(noise1(t * 37, s) * a, noise1(t * 41, s + 3) * a, noise1(t * 29, s + 7) * a * 0.5);
const punch = (t, at, amt = 0.18, dur = 0.25) => t < at ? 0 : amt * Math.exp(-(t - at) / dur * 3) * (t - at < dur * 2 ? 1 : 0);
const fH = () => headWorld(foma), mH = () => headWorld(mom);
const DIARY_ON_TABLE = V(0, 0.82, 0.05);
const SHOTS = [
  { id: 'S0', t0: 0, t1: B.erase, f(t, u) { setCam(DIARY_ON_TABLE.clone().add(V(0.02, lerp(0.75, 0.6, u), 0.42)).add(shake(0.006, t)), DIARY_ON_TABLE.clone().add(V(0.08, 0, -0.02)), 44); } },
  { id: 'S1', t0: B.erase, t1: B.erase + 2.0, f(t, u) { setCam(V(0.0, 1.6, -1.4), fH().add(V(0, -0.55, 0)), 48); } },
  { id: 'S1b', t0: B.erase + 2.0, t1: B.write, f(t, u) { const h = fH(); setCam(h.clone().add(V(0.15, -0.05, -1.15)), h.clone().add(V(0, -0.1, 0)), 36 * (1 - punch(t, B.erase + 2.0, 0.15))); } },
  { id: 'S2', t0: B.write, t1: vo('F2').t0, f(t, u) { setCam(DIARY_ON_TABLE.clone().add(V(0.1, 0.62, 0.35)), DIARY_ON_TABLE.clone().add(V(0.1, 0, -0.03)), 40); } },
  { id: 'S2b', t0: vo('F2').t0, t1: B.fridge, f(t, u) { const h = fH(); setCam(h.clone().add(V(-0.2 + 0.15 * u, -0.05, lerp(-1.45, -1.0, ease(u)))), h.clone().add(V(0, -0.15, 0)), lerp(40, 34, u)); } },
  { id: 'S3', t0: B.fridge, t1: B.dog, f(t, u) { setCam(V(-4.55, 1.7, -0.6).add(shake(0.02 * Math.max(0, Math.sin((t - B.fridge) * 7)), t, 2)), V(-3.6, 1.3, -2.9), 54); } },
  { id: 'S4', t0: B.dog, t1: B.door, f(t, u) { setCam(V(3.0, 1.15, 0.6), V(2.0, 0.75, -1.3), 52); } },
  { id: 'S5', t0: B.door, t1: B.fire, f(t, u) { const open = t > vo('F5').t1 + 0.1; setCam(open ? V(2.4, 1.6, 1.2) : fH().add(V(0.85, -0.1, -0.35)), open ? V(4.6, 1.45, 1.8) : fH().add(V(0, -0.15, 0)), open ? 50 : 38 * (1 - punch(t, vo('F5').t0, 0.2))); } },
  { id: 'S6', t0: B.fire, t1: B.call, f(t, u) { setCam(V(0.6, 1.75, -1.35).add(shake(0.015 * seg(t, B.fire + 1.0, B.fire + 1.1), t, 3)), fH().add(V(0, -0.45, 0)), 56); } },
  { id: 'S7', t0: B.call, t1: B.bite, f(t, u) { const h = fH(), r = foma.root.rotation.y, fw = V(Math.sin(r), 0, Math.cos(r)), rt = V(-fw.z, 0, fw.x); setCam(h.clone().addScaledVector(fw, 1.7).addScaledVector(rt, -0.95).add(V(0, 0.05, 0)), h.clone().add(V(0, -0.3, 0)), 46 * (1 - punch(t, vo('D1').t1 + 0.1, 0.15))); } },
  { id: 'S8', t0: B.bite, t1: B.run, f(t, u) { const h = fH(), r = foma.root.rotation.y, fw = V(Math.sin(r), 0, Math.cos(r)), rt = V(-fw.z, 0, fw.x); setCam(h.clone().addScaledVector(fw, 1.7).addScaledVector(rt, 1.0).add(V(0, 0.05, 0)), h.clone().add(V(0, -0.3, 0)), 46); } },
  { id: 'S9', t0: B.run, t1: vo('M1').t0 - 0.05, f(t, u) { setCam(V(1.4, 1.6, -0.2), V(2.5, 1.3, -4.1), 56); } },
  { id: 'S9b', t0: vo('M1').t0 - 0.05, t1: B.zero, f(t, u) { setCam(V(2.2, 1.65, -2.2).add(shake(0.02 * (1 - u), t, 4)), V(2.5, 1.5, -4.6), 44 * (1 - punch(t, vo('M1').t0, 0.2))); } },
  { id: 'S10', t0: B.zero, t1: vo('F9').t0 - 0.35, f(t, u) { setCam(V(2.7, 1.75, 1.6), V(0.35, 1.35, -0.2), lerp(50, 44, u)); } },
  { id: 'S11', t0: vo('F9').t0 - 0.35, t1: vo('M3').t0, f(t, u) { const h = fH(); const fw = V(Math.sin(foma.root.rotation.y), 0, Math.cos(foma.root.rotation.y)); setCam(h.clone().addScaledVector(fw, lerp(1.6, 1.05, ease(u))).add(V(0, -0.1 + 0.08 * u, 0)), h.clone().add(V(0, -0.2, 0)), lerp(42, 36, u)); } },
  { id: 'S12', t0: vo('M3').t0, t1: B.end + 0.01, f(t, u) { const h = mH(); setCam(h.clone().add(V(0.35, -0.1, 1.55)), h.clone().add(V(0, -0.25, 0)), 40 * (1 - punch(t, vo('M3').t0 + 0.6, 0.12))); } },
];
const shotAt = t => SHOTS.find(s => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1];

// ---------- OVERLAYS ----------
function overlay(t) {
  // countdown timer (always on screen until 0)
  if (t < B.zero + 0.7) {
    const v = timerVal(t), last = v <= 5, k = 1 + (last ? 0.12 * Math.max(0, Math.sin(t * Math.PI * 2)) : 0);
    ctx.save(); ctx.translate(W / 2, 175); ctx.scale(k, k); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = last ? 'rgba(200,0,0,0.85)' : 'rgba(0,0,0,0.7)'; rr(ctx, -175, -78, 350, 156, 34); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '900 118px Inter'; ctx.fillText('0:' + String(v).padStart(2, '0'), 0, 6); ctx.restore();
  }
  if (t < 2.4) { const k = easeOut(seg(t, 0.0, 0.15)) * (1 - seg(t, 2.1, 2.4)); ctx.save(); ctx.globalAlpha = k; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.font = '900 76px Inter';
    for (const [s, y, c] of [['МАМА ПРИДЁТ', 380, '#fff'], ['ЧЕРЕЗ 30 СЕКУНД', 470, '#ffd21a']]) { ctx.lineWidth = 18; ctx.strokeStyle = '#000'; ctx.strokeText(s, W / 2, y); ctx.fillStyle = c; ctx.fillText(s, W / 2, y); } ctx.restore(); }
  // phone call card
  if (t > B.call && t < B.bite) { const k = easeOut(seg(t, B.call, B.call + 0.15)); ctx.save(); ctx.globalAlpha = k; ctx.translate(0, (1 - k) * -60); ctx.fillStyle = 'rgba(20,22,30,0.9)'; rr(ctx, 90, 300, W - 180, 150, 75); ctx.fill();
    ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(170, 375, 46, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '900 46px Inter'; ctx.textAlign = 'center'; ctx.fillText('Д', 170, 392);
    ctx.textAlign = 'left'; ctx.font = '800 48px Inter'; ctx.fillText('Дима', 240, 368); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '500 32px Inter'; ctx.fillText('звонок · 00:0' + Math.floor(t - B.call), 240, 415); ctx.restore(); }
  for (const s of SUBS) if (t >= s.t0 && t <= s.t1) drawSub(s, t);
}

// ---------- FRAME ----------
function placeOnHand(obj, rig, i, off = V(0, -0.08, 0.06)) { rig.hand[i].updateWorldMatrix(true, false); obj.position.copy(off.clone().applyMatrix4(rig.hand[i].matrixWorld)); obj.quaternion.copy(rig.hand[i].getWorldQuaternion(new THREE.Quaternion())); }
function update(t) {
  const fs = fomaState(t); applyPose(foma, fs.pos, fs.rotY, fs.pose); drawFomaMask({ h: fs.eye.h, px: 0, glow: fs.glow });
  // mom: outside the window at the end of the countdown, then inside
  mom.root.visible = t > B.run + 0.8;
  if (t < B.zero) { applyPose(mom, V(2.5, 0, -4.75), 0, { ...P.crossed(t), rhx: 0, rk: 0 }); drawNPCFace(mom.face.c.getContext('2d'), 'angry', speaking('M1', t) ? Math.abs(Math.sin(t * 15)) : 0); }
  else { const tk = speaking('M2', t) || speaking('M3', t) ? Math.abs(Math.sin(t * 14)) : 0; applyPose(mom, V(-0.15, 0, -0.9), Math.PI * 0.82 - Math.PI, { ...P.idle(t), lsx: -1.3, le: -0.6, rsx: 0.2, rsz: -0.6, re: -1.8 }); mom.root.rotation.y = 0.85; drawNPCFace(mom.face.c.getContext('2d'), t > vo('M3').t0 ? 'deadpan' : 'deadpan', tk); }
  mom.face.t.needsUpdate = true; lookAtWorld(mom, fH(), 0.9);
  if (fs.look === 'mom') lookAtWorld(foma, mH(), 0.9); else if (fs.look && fs.look !== 'camera') lookAtWorld(foma, fs.look, 0.85);
  // courier at the door
  const cv = t > vo('F5').t1 + 0.1 && t < B.fire; courier.root.visible = cv; if (cv) { applyPose(courier, V(5.45, 0, 1.8), -Math.PI / 2, { ...P.idle(t), lsx: -1.4, rsx: -1.4, le: -0.2, re: -0.2 }); drawNPCFace(courier.face.c.getContext('2d'), 'smile', 0); courier.face.t.needsUpdate = true; placeOnHand(pizza, courier, 0, V(-0.2, -0.05, 0.12)); pizza.rotation.set(0, Math.PI / 2, 0); } pizza.visible = cv;
  frontDoor.rotation.y = cv ? -1.4 * easeOut(seg(t, vo('F5').t1 + 0.1, vo('F5').t1 + 0.3)) : 0;
  winSash.rotation.y = t > B.run + 0.8 && t < B.zero + 0.3 ? 1.5 * easeOut(seg(t, B.run + 0.8, B.run + 1.05)) : 0;
  // dog
  const ds = dogState(t); dog.root.position.copy(ds.pos); dog.root.rotation.y = ds.rotY; dog.tail.rotation.y = ds.wag; dog.head.rotation.x = ds.headX; dog.legs.forEach((l, i) => l.rotation.x = ds.walk * 0.6 * Math.sin(t * 16 + (i % 2) * Math.PI));
  // freezer door bounces open
  const fr = t - (B.fridge + 0.7); freezerDoor.rotation.y = fr > 0 && t < B.dog ? -1.2 * Math.abs(Math.cos(fr * 6)) * Math.exp(-fr * 0.6) - 0.2 : 0;
  // candle flame + alarm + sprinkler
  flame.visible = t < B.fire + 1.0 || t > B.zero; flame.scale.x = 1 + 0.15 * Math.sin(t * 30); flameLight.intensity = flame.visible ? 0.8 : 0;
  const alarm = t > B.fire + 0.9 && t < B.call; alarmLight.intensity = alarm ? 6 * (Math.sin(t * 20) > 0 ? 1 : 0) : 0; ledMat.color.setHex(alarm && Math.sin(t * 20) > 0 ? 0xff0000 : 0x330000);
  drops.forEach((d, i) => { const on = t > B.fire + 1.0 && t < B.call; d.visible = on; if (on) { const y = RH - ((t * 5 + d.userData.o * 3) % 3); d.position.set(d.userData.x, y, d.userData.z); } });
  puffs.forEach((p, i) => { let base, t0; if (i < 5) { base = V(0.3, 1.1, 0.25); t0 = B.fire + 0.3 + i * 0.12; } else { base = V(-3.75, 1.7, -2.9); t0 = B.fridge + 0.75 + (i - 5) * 0.1; } const d = t - t0; if (d < 0 || d > 1.6 || (i >= 5 && t > B.dog)) { p.visible = false; return; } p.visible = true; p.position.copy(base).add(V((i % 2 ? 0.2 : -0.2) * d, d * (i < 5 ? 1.2 : 0.4), 0.3 * d)); p.scale.setScalar(0.3 + d * 0.8); p.material.opacity = 0.8 * (1 - d / 1.6); });
  // the diary and its page state
  const st = { grade: '2', rub: 0, hole: false, frost: 0, wet: false, bite: false };
  if (t > B.erase + 0.3) st.rub = Math.min(1, (t - B.erase - 0.3) / 1.2); if (t > B.erase + 1.5) st.hole = true;
  if (t > B.write + 0.5) { st.rub = 0; st.hole = true; st.grade = t > B.write + 1.4 ? '22' : '2'; }
  if (t > B.fridge + 0.7) st.frost = Math.max(0, 1 - (t - B.fridge - 0.7) / 3);
  if (t > B.fire + 1.0) st.wet = true; if (t > B.bite + 0.6) st.bite = true;
  drawDiary(st);
  if (t < B.fridge) { diary.position.copy(DIARY_ON_TABLE); diary.rotation.set(0, 0, 0); }
  else if (t < B.dog) { const k = seg(t, B.fridge, B.fridge + 0.7); const inF = V(-3.85, 1.5, -3.15); if (k < 1) { placeOnHand(diary, foma, 1, V(0, -0.12, 0.1)); diary.position.lerp(inF, k); } else { const d = t - B.fridge - 0.7; diary.position.set(-3.6 + d * 0.5, Math.max(0.03, 1.5 - 4.9 * d * d), -2.9 + d * 0.3); diary.rotation.set(d * 4, 0, d * 2); } }
  else if (t < B.door) { if (t < B.dog + 0.9) { placeOnHand(diary, foma, 1, V(0, -0.12, 0.1)); } else if (t < B.dog + 2.0) { dog.head.updateWorldMatrix(true, false); diary.position.copy(V(0, -0.02, 0.42).applyMatrix4(dog.head.matrixWorld)); diary.rotation.set(0, dog.root.rotation.y, 0.2); } else { placeOnHand(diary, foma, 0, V(0, -0.12, 0.1)); } }
  else if (t < B.zero) { placeOnHand(diary, foma, t > B.bite && t < B.run ? 0 : 0, V(0, -0.12, 0.1)); if (t > B.door && t < B.fire) diary.position.add(V(0, 0, 0)); }
  else { placeOnHand(diary, mom, 0, V(0, -0.1, 0.12)); }
  // props in hands
  eraser.visible = t > B.erase && t < B.write; if (eraser.visible) placeOnHand(eraser, foma, 1);
  pencil.visible = t > B.write && t < B.fridge; if (pencil.visible) { placeOnHand(pencil, foma, 1); pencil.rotateX(1.2); }
  phone.visible = t > B.call && t < B.bite; if (phone.visible) { phone.position.copy(fH().add(V(0.3, -0.05, 0.0))); phone.lookAt(fH()); }
  if (t > B.call && t < B.bite) aimArm(foma, 1, fH().add(V(0.32, -0.08, 0.05)), 0.95);
  if (t > B.bite && t < B.run) { aimArm(foma, 0, fH().add(V(0, -0.15, -0.3)), 0.6 + 0.4 * Math.abs(Math.sin(t * 9))); }
  if (t > B.dog && t < B.dog + 0.9) aimArm(foma, 1, dog.head.getWorldPosition(new THREE.Vector3()), 0.85);
  return fs;
}
function renderFrame(f) {
  const t = f / FPS, shot = shotAt(t);
  const fs = update(t); shot.f(t, (t - shot.t0) / (shot.t1 - shot.t0));
  if (fs.look === 'camera') lookAtWorld(foma, cam.position, 1);
  renderer.render(scene, cam); ctx.drawImage(renderer.domElement, 0, 0, W, H); overlay(t);
  return shot.id;
}
window.renderFrame = renderFrame;
window.grab = (q = 0.93) => out.toDataURL('image/jpeg', q);
window.TOTAL = TOTAL;
window.ready = document.fonts.load('900 60px Inter').then(() => true);
window.__dbg = () => ({ B, foma: foma.root.position.toArray() });
window.renderCover = () => {
  const t = 1.2; update(t); foma.root.position.z = TBL.z + 0.32;
  diary.rotation.y = Math.PI; setCam(V(0.3, 1.95, -1.85), V(0.0, 1.55, 0.35), 58); lookAtWorld(foma, cam.position, 1);
  renderer.render(scene, cam); ctx.drawImage(renderer.domElement, 0, 0, W, H);
  const gr = ctx.createLinearGradient(0, 0, 0, 760); gr.addColorStop(0, 'rgba(0,0,0,0.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, 760);
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  const big = (txt, y, size, col) => { ctx.font = `900 ${size}px Inter`; ctx.lineWidth = 22; ctx.strokeStyle = '#000'; ctx.strokeText(txt, W / 2, y); ctx.fillStyle = col; ctx.fillText(txt, W / 2, y); };
  big('МАМА ПРИДЁТ', 250, 118, '#fff'); big('ЧЕРЕЗ 30 СЕК', 400, 118, '#ffd21a');
  ctx.save(); ctx.translate(250, 1650); ctx.rotate(-0.08); ctx.fillStyle = 'rgba(200,0,0,0.9)'; rr(ctx, -190, -85, 380, 170, 36); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '900 128px Inter'; ctx.textBaseline = 'middle'; ctx.fillText('0:30', 0, 8); ctx.restore();
  return out.toDataURL('image/png');
};
