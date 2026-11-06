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
