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

// ======================= NOCT · FOMA — «Я ПРОСТО ХОТЕЛ СПОКОЙНО СХОДИТЬ В ШКОЛУ» =======================
// Layout: corridor x -16..8, z 0..3.6 ; classroom x -5..6, z -9..0 ; door in wall z=0 at x 0..1.4 ; board on west wall x=-5
const RH = 3.2, DOOR = { x0: 0, x1: 1.4, h: 2.4 };
const tileT = canvasTex(256, 256, (g, w, h) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#dfe3ea' : '#c9ced8'; g.fillRect(x * 64, y * 64, 64, 64); } }, [12, 2]);
const woodFloor = canvasTex(256, 256, (g, w, h) => { const r = rng(5); for (let y = 0; y < 8; y++) { g.fillStyle = `hsl(32,45%,${48 + r() * 8}%)`; g.fillRect(0, y * 32, w, 32); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y * 32, w, 2); g.fillRect((y * 97) % w, y * 32, 2, 32); } }, [6, 5]);
const wallT = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#e9f1e4'; g.fillRect(0, 0, w, h); g.fillStyle = '#4f8fd6'; g.fillRect(0, 170, w, 86); g.fillStyle = '#3b74b5'; g.fillRect(0, 166, w, 6); }, [6, 1]);
const classWallT = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#fff4d6'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2a64a'; g.fillRect(0, 180, w, 76); }, [4, 1]);
const world = new THREE.Group(); scene.add(world);
const wb = (x0, x1, y0, y1, z0, z1, mat) => add(world, box(x1 - x0, y1 - y0, z1 - z0, mat, 0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
const mWall = M(0xffffff, 0.9, { map: wallT }), mCls = M(0xffffff, 0.9, { map: classWallT }), mWhite = M(0xf4f4f4, 0.8);
const doorPiv = new THREE.Group();
{
  const base = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), M(0xffffff, 0.8, { map: studTex })); base.rotation.x = -Math.PI / 2; base.position.y = -0.02; world.add(base);
  const cf = add(world, box(24, 0.06, 3.6, M(0xffffff, 0.35, { map: tileT }), 0), -4, -0.03, 1.8); cf.receiveShadow = true;
  const kf = add(world, box(11, 0.06, 9, M(0xffffff, 0.6, { map: woodFloor }), 0), 0.5, -0.03, -4.5); kf.receiveShadow = true;
  add(world, box(24, 0.1, 3.6, mWhite, 0), -4, RH + 0.05, 1.8); add(world, box(11, 0.1, 9, mWhite, 0), 0.5, RH + 0.05, -4.5);
  // corridor walls: south (lockers) z=3.6, north z=0 (shared with classroom) with door x 0..1.4
  wb(-16, 8, 0, RH, 3.6, 3.8, mWall); wb(-16, DOOR.x0, 0, RH, -0.1, 0.1, mWall); wb(DOOR.x1, 8, 0, RH, -0.1, 0.1, mWall); wb(DOOR.x0, DOOR.x1, DOOR.h, RH, -0.1, 0.1, mWall);
  wb(8, 8.2, 0, RH, 0, 3.6, mWall);
  // corridor end window (bright)
  const win = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.4), new THREE.MeshBasicMaterial({ color: 0xbfe6ff })); win.position.set(-15.95, 1.6, 1.8); win.rotation.y = Math.PI / 2; world.add(win);
  wb(-16.2, -16, 0, RH, 0, 3.6, mWall);
  // lockers
  const lockCols = [0x2f80ed, 0x2f80ed, 0xe0302a, 0x2f80ed, 0x27ae60];
  for (let i = 0; i < 26; i++) { const x = -14.5 + i * 0.85; if (x > 7.5) break; const c = lockCols[i % 5]; const lk = add(world, box(0.8, 2.0, 0.5, M(c, 0.4, { metalness: 0.3 }), 0.02), x, 1.0, 3.33); add(world, box(0.5, 0.05, 0.02, M(0x1b1b1b, 0.5), 0), x, 1.75, 3.07); add(world, box(0.05, 0.18, 0.04, M(0xdddddd, 0.3, { metalness: 0.8 }), 0), x + 0.28, 1.1, 3.07); }
  // bulletin board + posters on north corridor wall
  const posterT = (txt, bg, fg) => canvasTex(256, 320, (g, w, h) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = '900 52px Inter'; g.textAlign = 'center'; txt.split('\n').forEach((l, i) => g.fillText(l, w / 2, 110 + i * 70)); });
  [[-6, 'ДЕНЬ\nЗНАНИЙ', '#ffcf3a', '#c0392b'], [-3.8, 'НЕ\nБЕГАТЬ!', '#ffffff', '#e0302a'], [-9, 'КРУЖОК\nROBLOX', '#7c4dff', '#ffffff'], [3, 'СТОЛОВАЯ\n→', '#27ae60', '#ffffff']].forEach(([x, t, b, f]) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.15), M(0xffffff, 0.8, { map: posterT(t, b, f) })); p.position.set(x, 1.75, 0.111); world.add(p); });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.35), new THREE.MeshBasicMaterial({ map: canvasTex(384, 112, (g, w, h) => { g.fillStyle = '#1e3a5f'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '800 64px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('КАБИНЕТ 7Б', w / 2, h / 2 + 4); }) })); sign.position.set(0.7, 2.75, 0.112); world.add(sign);
  for (let x = -14; x <= 6; x += 3) add(world, box(1.4, 0.05, 0.5, M(0xffffff, 0.3, { emissive: 0xffffff, emissiveIntensity: 1.0 }), 0.01), x, RH - 0.02, 1.8);
  // door (opens into classroom, hinge at x 0)
  doorPiv.position.set(DOOR.x0, 0, -0.02); world.add(doorPiv);
  const slab = add(doorPiv, box(1.4, DOOR.h, 0.07, M(0x8a5a2b, 0.6), 0.02), 0.7, DOOR.h / 2, 0);
  add(doorPiv, box(0.5, 0.6, 0.075, new THREE.MeshPhysicalMaterial({ color: 0xcfefff, transparent: true, opacity: 0.5 }), 0), 0.7, 1.75, 0);
  add(doorPiv, box(0.18, 0.04, 0.12, M(0xcccccc, 0.2, { metalness: 0.9 }), 0.01), 1.2, 1.05, 0.06);
  // classroom walls (inner faces cream/orange)
  wb(-5.2, -5, 0, RH, -9, 0, mCls); wb(6, 6.2, 0, RH, -9, 0, mCls);
  wb(-5, 6, 0, 0.9, -9.2, -9, mCls); wb(-5, 6, 2.6, RH, -9.2, -9, mCls);
  for (const x of [-4.95, -1.3, 2.4, 5.95]) wb(x - 0.06, x + 0.06, 0.9, 2.6, -9.2, -9, mWhite);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(11, 1.7), new THREE.MeshBasicMaterial({ color: 0xa9dcff })); sky.position.set(0.5, 1.75, -9.25); world.add(sky);
  // chalkboard
  const boardT = canvasTex(1024, 384, (g, w, h) => { g.fillStyle = '#20493a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8a5a2b'; g.lineWidth = 24; g.strokeRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.88)'; g.font = '700 64px Inter'; g.fillText('Тема урока:', 60, 110); g.font = '900 84px Inter'; g.fillText('ДИСЦИПЛИНА', 60, 220); g.font = '700 48px Inter'; g.fillText('2 + 2 = 4', 650, 330); });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.9), M(0xffffff, 0.9, { map: boardT })); board.position.set(-4.97, 1.75, -4.5); board.rotation.y = Math.PI / 2; world.add(board);
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.28, 28), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 6; g.stroke(); g.lineWidth = 5; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 22); g.moveTo(64, 64); g.lineTo(96, 70); g.stroke(); }) })); clock.position.set(-4.95, 2.85, -1.6); clock.rotation.y = Math.PI / 2; world.add(clock);
  // teacher desk + shelf
  add(world, box(1.0, 0.8, 2.0, M(0x6b4426, 0.6), 0.03), -3.7, 0.4, -6.4); add(world, cyl(0.22, 0.22, 0.05, M(0x333333), 16), -3.7, 0.83, -6.9); add(world, new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), M(0x3fa9f5, 0.4)), -3.7, 1.1, -6.9);
  add(world, box(0.5, 1.8, 2.2, M(0x8a5a2b, 0.6), 0.03), 5.7, 0.9, -6.2);
  for (const z of [-7.0, -6.4, -5.8, -5.3]) add(world, box(0.35, 0.3, 0.12, M([0xe0302a, 0x2f80ed, 0x27ae60, 0xffc928][Math.round(-z * 3) % 4], 0.6), 0.01), 5.55, 1.95, z);
  for (let x = -3; x <= 5; x += 2.5) for (const z of [-2.5, -6.5]) add(world, box(1.4, 0.05, 0.5, M(0xffffff, 0.3, { emissive: 0xffffff, emissiveIntensity: 1.0 }), 0.01), x, RH - 0.02, z);
}
// student desks & chairs (students face -x, toward the board)
const DESKS = [[-1.2, -2.6], [-1.2, -4.6], [-1.2, -6.6], [1.5, -2.6], [1.5, -4.6], [1.5, -6.6]];
const deskObjs = DESKS.map(([x, z], i) => { const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g); add(g, box(0.75, 0.06, 1.3, M([0xffc928, 0x3fa9f5, 0x27ae60][i % 3], 0.5), 0.02), 0, 0.76, 0); for (const [a, b] of [[-0.3, -0.55], [0.3, -0.55], [-0.3, 0.55], [0.3, 0.55]]) add(g, box(0.05, 0.74, 0.05, M(0x555555, 0.4), 0.01), a, 0.37, b); add(g, box(0.22, 0.03, 0.3, M(0x2f80ed, 0.5), 0.01), 0, 0.8, 0.2); return { g, x, z }; });
function mkChair(col) { const g = new THREE.Group(); add(g, box(0.48, 0.06, 0.48, M(col, 0.5), 0.02), 0, 0.46, 0); add(g, box(0.06, 0.5, 0.48, M(col, 0.5), 0.02), 0.22, 0.74, 0); for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) add(g, box(0.04, 0.46, 0.04, M(0x444444, 0.4), 0.01), x, 0.23, z); world.add(g); return g; }
const props = []; // generic ballistic props {obj, p0, r0, t, v, w, bounce}
function prop(obj, p0, r0, ev) { obj.position.copy(p0); obj.rotation.copy(r0); const o = { obj, p0: p0.clone(), r0: r0.clone(), ev }; props.push(o); return o; }
function propAt(o, t) {
  const ev = o.ev.filter(e => t >= e.t); if (!ev.length || (o.hide && o.hide(t))) { o.obj.position.copy(o.p0); o.obj.rotation.copy(o.r0); o.obj.visible = !(o.hide && o.hide(t)); return; }
  o.obj.visible = true;
  const e = ev[ev.length - 1]; let p = (e.from ? e.from.clone() : o.p0.clone()), v = e.v ? e.v.clone() : V(0, 0, 0), a = V(o.r0.x, o.r0.y, o.r0.z), w = (e.w || V(0, 0, 0)).clone(); const dt = 1 / 240, fl = e.floor ?? 0;
  if (e.to) { const k = clamp((t - e.t) / e.dur); p = vlerp(p, e.to, k); p.y += Math.sin(k * Math.PI) * (e.arc || 0); a.addScaledVector(w, (t - e.t)); o.obj.position.copy(p); o.obj.rotation.set(a.x, a.y, a.z); return; }
  for (let s = e.t; s < t; s += dt) { v.y -= 20 * dt; p.addScaledVector(v, dt); a.addScaledVector(w, dt); if (p.y < fl) { p.y = fl; v.y = -v.y * 0.3; v.x *= 0.6; v.z *= 0.6; w.multiplyScalar(0.5); } }
  o.obj.position.copy(p); o.obj.rotation.set(a.x, a.y, a.z);
}
const chairs = DESKS.map(([x, z], i) => prop(mkChair([0xe0302a, 0x7c4dff, 0xff7a1a][i % 3]), V(x + 0.55, 0, z), new THREE.Euler(0, 0, 0), []));
chairs[4].ev.push({ t: 22.85, v: V(1.2, 2.2, 0.8), w: V(0, 0, -7) });       // knocked over by student C
// hook-only flying furniture (flash-forward): out of the door into the corridor
const hookChairA = prop(mkChair(0xe0302a), V(0.4, 0, -1.0), new THREE.Euler(0, 0, 0), [{ t: 0.12, v: V(-2.5, 6.2, 5.6), w: V(6, 3, 2) }]);
const hookChairB = prop(mkChair(0x7c4dff), V(1.0, 0, -1.4), new THREE.Euler(0, 1, 0), [{ t: 0.45, v: V(-3.5, 6.6, 6.0), w: V(-4, 5, 6) }]);
const hookDesk = new THREE.Group(); add(hookDesk, box(0.75, 0.06, 1.3, M(0x3fa9f5, 0.5), 0.02), 0, 0.76, 0); for (const [a, b] of [[-0.3, -0.55], [0.3, -0.55], [-0.3, 0.55], [0.3, 0.55]]) add(hookDesk, box(0.05, 0.74, 0.05, M(0x555555, 0.4), 0.01), a, 0.37, b); world.add(hookDesk);
const hookDeskP = prop(hookDesk, V(0.7, 0, -1.8), new THREE.Euler(0, 1.57, 0), [{ t: 0.8, v: V(-3.2, 5.6, 5.8), w: V(5, -2, 4) }]);
for (const h of [hookChairA, hookChairB, hookDeskP]) h.hide = t => t > 2.55;
// paper notebooks thrown up by student C, pillow, books, the giant pointer, the register, the ЗАВУЧ sign
const nbMat = [M(0xffffff, 0.7), M(0xff7a9a, 0.7), M(0x8fd3ff, 0.7)];
const notebooks = [...Array(6)].map((_, i) => { const n = box(0.22, 0.02, 0.3, nbMat[i % 3], 0.005); world.add(n); return prop(n, V(1.2, 1.2, -6.6), new THREE.Euler(0, 0, 0), [{ t: 15.3 + i * 0.35, v: V(-0.5 + (i % 3) * 0.5, 6.5, (i % 2 ? 1 : -1) * 0.9), w: V(7, 3, 5) }, { t: 15.3 + i * 0.35 + 1.4, v: V(-0.5 + (i % 3) * 0.4, 6.0, (i % 2 ? -1 : 1) * 0.8), w: V(7, 3, 5), from: V(1.2, 1.2, -6.6) }]); });
notebooks.forEach(n => n.hide = t => t < 15.3 || t > 26.0);
const pillow = prop(box(0.55, 0.18, 0.4, M(0xffffff, 0.9), 0.08), V(-1.2, 1.9, -2.6), new THREE.Euler(0, 0, 0), [{ t: 20.55, to: V(-2.35, 2.05, -2.2), dur: 0.5, arc: 0.6, w: V(0, 9, 4) }, { t: 21.05, v: V(1.2, 3.2, 1.6), w: V(6, 6, 2), from: V(-2.35, 2.05, -2.2) }]);
pillow.hide = t => t < 19.6 || t > 26.0;
const books = [...Array(4)].map((_, i) => { const b = box(0.3, 0.08, 0.22, M([0xe0302a, 0x2f80ed, 0x27ae60, 0xffc928][i], 0.6), 0.01); world.add(b); return prop(b, V(-2.35, 2.9 + i * 0.1, -2.2), new THREE.Euler(0, 0, 0), [{ t: 23.25 + i * 0.12, v: V((i - 1.5) * 0.6, 1.5, (i % 2 ? 0.5 : -0.5)), w: V(8, 2, 6) }]); });
books.forEach(b => b.hide = t => t < 23.2 || t > 26.0);
const pointer = new THREE.Group(); add(pointer, cyl(0.03, 0.05, 2.4, M(0xb07a3e, 0.6), 10), 0, 0, 0).rotation.z = Math.PI / 2; add(pointer, cyl(0.055, 0.055, 0.12, M(0xe0302a, 0.5), 10), 1.2, 0, 0).rotation.z = Math.PI / 2; world.add(pointer);
const register = box(0.32, 0.06, 0.44, M(0x1f4fa8, 0.6), 0.02); world.add(register);
add(register, box(0.3, 0.01, 0.4, M(0xffffff, 0.8), 0), 0, 0.035, 0);
const zavuch = new THREE.Group(); world.add(zavuch);
{ const t = canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c0392b'; g.lineWidth = 22; g.strokeRect(11, 11, w - 22, h - 22); g.fillStyle = '#c0392b'; g.font = '900 132px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ЗАВУЧ', w / 2, h / 2 + 8); });
  add(zavuch, box(0.9, 0.45, 0.03, [M(0xdddddd), M(0xdddddd), M(0xdddddd), M(0xdddddd), M(0xffffff, 0.5, { map: t }), M(0xdddddd)], 0.01), 0, 0, 0); }

// ---------- LIGHTS ----------
scene.add(new THREE.HemisphereLight(0xf1f6ff, 0xb8ab92, 1.25));
const sun = new THREE.DirectionalLight(0xfff3dd, 1.6); sun.position.set(6, 14, -20); sun.target.position.set(0, 0, -2); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
for (const [x, z] of [[-12, 1.8], [-6, 1.8], [0, 1.8], [5, 1.8], [-2.5, -3], [2.5, -3], [-2.5, -6.5], [2.5, -6.5]]) { const l = new THREE.PointLight(0xfff6e8, 7, 9, 1.6); l.position.set(x, RH - 0.25, z); scene.add(l); }
const rimL = new THREE.DirectionalLight(0xcfe0ff, 0.9); rimL.position.set(-8, 6, 10); scene.add(rimL);

// ---------- CAST ----------
const teacher = npc({ skin: 0xf2c94c, shirt: 0x8ec9ff, pants: 0x2b2f3a, shoe: 0x3b2a1e, extra(r) {
  add(r.neck, box(0.47, 0.12, 0.47, M(0x6b4426, 0.7), 0.04), 0, 0.47, -0.01); add(r.neck, box(0.47, 0.22, 0.1, M(0x6b4426, 0.7), 0.03), 0, 0.37, -0.2);
  const gl = M(0x111111, 0.3); for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 16), gl); f.position.set(s * 0.09, 0.27, 0.235); r.neck.add(f); } add(r.neck, box(0.06, 0.012, 0.012, gl, 0), 0, 0.28, 0.235);
  add(r.chest, box(0.08, 0.3, 0.02, M(0x2b4f8a, 0.6), 0.01), 0, 0.42, 0.175); } });
const principal = npc({ skin: 0xe3b58f, shirt: 0x23252d, pants: 0x1b1c22, shoe: 0x111111, extra(r) {
  add(r.neck, box(0.47, 0.1, 0.47, M(0x111114, 0.6), 0.04), 0, 0.47, -0.01); add(r.neck, box(0.47, 0.2, 0.1, M(0x111114, 0.6), 0.03), 0, 0.38, -0.2);
  add(r.chest, box(0.18, 0.2, 0.02, M(0xffffff, 0.6), 0.01), 0, 0.5, 0.175); add(r.chest, box(0.06, 0.32, 0.025, M(0xd21f2b, 0.5), 0.01), 0, 0.4, 0.18);
  const clip = new THREE.Group(); clip.position.set(0, -0.1, 0.12); r.hand[0].add(clip); add(clip, box(0.28, 0.4, 0.02, M(0x8a5a2b, 0.6), 0.01), 0, -0.1, 0).rotation.x = -0.4; add(clip, box(0.24, 0.32, 0.005, M(0xffffff, 0.8), 0), 0, -0.1, 0.012).rotation.x = -0.4; } });
const STU = [
  { shirt: 0xff7a1a, pants: 0x2e7d32, skin: 0xf2c94c, hair: 0x111111, cap: 0xe0302a },
  { shirt: 0x7c4dff, pants: 0x3a3a46, skin: 0xffd9a8, hair: 0xf5f5f5 },
  { shirt: 0xe0302a, pants: 0x2b4f8a, skin: 0xc68a5a, hair: 0x3b2a1e, phones: true },
  { shirt: 0xffd23a, pants: 0x2f80ed, skin: 0x8d5a3b, hair: 0x111111, bag: true },
];
const students = STU.map(o => npc({ scale: 0.72, skin: o.skin, shirt: o.shirt, pants: o.pants, extra(r) {
  add(r.neck, box(0.47, 0.13, 0.47, M(o.hair, 0.7), 0.04), 0, 0.48, -0.01);
  if (o.cap) { add(r.neck, box(0.5, 0.1, 0.5, M(o.cap, 0.5), 0.03), 0, 0.53, 0); add(r.neck, box(0.42, 0.04, 0.26, M(o.cap, 0.5), 0.02), 0, 0.49, 0.3); }
  if (!o.cap) for (let k = 0; k < 5; k++) add(r.neck, box(0.12, 0.14, 0.12, M(o.hair, 0.7), 0.03), -0.18 + k * 0.09, 0.57, 0.05 * (k % 2)).rotation.z = (k - 2) * 0.2;
  if (o.phones) { add(r.neck, box(0.5, 0.05, 0.08, M(0x222222, 0.4), 0.02), 0, 0.55, 0); for (const s of [-1, 1]) add(r.neck, box(0.06, 0.16, 0.16, M(0x222222, 0.4), 0.03), s * 0.25, 0.27, 0); }
  if (o.bag) add(r.chest, box(0.5, 0.5, 0.2, M(0x27ae60, 0.6), 0.06), 0, 0.3, -0.27);
} }));
const extras = [0, 1].map(i => npc({ scale: 0.72, skin: [0xf2c94c, 0xe3b58f][i], shirt: [0x27ae60, 0xff8fc8][i], pants: 0x3a3a46 }));

// ---------- TIMELINE ----------
const DOOR_OUT = V(0.7, 0, 1.0), DOOR_IN = V(0.7, 0, -0.8), FOMA_STOP = V(-0.6, 0, 1.9), FRONT = V(-2.35, 0, -2.4), PRINC_IN = V(0.3, 0, -1.4);
const T = {
  hookEnd: 2.0, rwEnd: 2.5, walkEnd: 5.25, teachOut: 4.9, bookA: 6.3, bookB: 6.75, pat: vo('T3').t0 + 0.55, push: [vo('T3').t1 + 0.05, vo('T3').t1 + 1.1],
  inClass: vo('T3').t1 + 1.15, cmd: vo('F5').t0, freeze: [vo('F5').t1 + 0.05, 19.75], chaos: 19.75, pointerLand: 24.6, princ: 26.0, sign: [vo('F6').t1 + 0.35, vo('F6').t1 + 0.85], end: 35.0,
};
pointer.userData.ev = 1;
function srcTime(t) { return t >= T.hookEnd && t < T.rwEnd ? T.hookEnd - (t - T.hookEnd) / (T.rwEnd - T.hookEnd) * T.hookEnd : t; } // rewind
function fomaState(t) {
  let pos, rotY, pose, look = null, glow = 0.45, eye = { h: 0.85, px: 0 };
  if (t < T.hookEnd) { // flash-forward: runs out of the classroom, along the corridor towards camera
    pos = path(t, [[0, V(0.7, 0, 0.1)], [0.35, V(0.6, 0, 1.6)], [T.hookEnd, V(-4.6, 0, 1.8)]]); rotY = t < 0.35 ? 0 : -Math.PI / 2 + 0.15; pose = mix(P.run(t * 16), P.shock(t), 0.25); glow = 0.9; eye.h = 1.4;
    if (t < 0.4) rotY = lerp(-0.3, -Math.PI / 2, seg(t, 0.15, 0.4));
  } else if (t < T.walkEnd) { pos = path(t, [[T.rwEnd, V(-6.4, 0, 1.9)], [T.walkEnd, FOMA_STOP]]); rotY = Math.PI / 2; pose = P.walk(t * 8.5); eye.h = 0.7; look = t > 4.6 ? V(0.9, 1.7, 0.9) : V(4, 1.5 + 0.2 * Math.sin(t * 2), 1.9 + Math.sin(t * 1.3)); }
  else if (t < T.push[0]) {
    pos = FOMA_STOP.clone(); rotY = Math.PI / 2; pose = P.idle(t); look = 'teacher'; eye.h = 0.8;
    if (t > T.bookA) { pose = { ...P.idle(t), lsx: -1.0, le: -1.3, lsz: 0.1 }; }
    if (speaking('F3', t)) { pose = { ...P.confused(t), lsx: -1.0, le: -1.3, lsz: 0.1 }; eye.h = 1.2; look = 'camera'; }
    if (t > vo('T1').t1 && t < vo('F3').t0) eye.h = 1.3;
    if (speaking('F4', t)) { pose = { ...P.idle(t), lean: -0.05, lsx: -1.0, le: -1.3, rsx: -0.75, rsz: 0.35, re: -1.75 }; eye.h = 1.1; } // taps his chest
    if (t > vo('F4').t1) eye.h = 0.6;
    if (t > T.pat && t < T.pat + 0.5) { pose = { ...pose, sq: 0.95, tilt: 0.1 }; }
  } else if (t < T.inClass) { const k = ease(seg(t, T.push[0], T.push[1])); pos = path(t, [[T.push[0], FOMA_STOP], [T.push[0] + 0.45, DOOR_OUT], [T.push[1], DOOR_IN], [T.inClass, V(-0.6, 0, -1.6)]]); rotY = t < T.push[0] + 0.4 ? lerp(Math.PI / 2, Math.PI, seg(t, T.push[0], T.push[0] + 0.4)) : Math.PI; pose = mix(P.walk(t * 11), { ...P.walk(t * 11), lean: 0.4, lsx: -0.8, rsx: -0.8 }, 0.7); eye.h = 1.2; }
  else if (t < T.chaos) {
    pos = path(t, [[T.inClass, V(-0.6, 0, -1.6)], [T.inClass + 0.9, FRONT]]); rotY = t < T.inClass + 0.9 ? -Math.PI * 0.75 : lerp(-Math.PI * 0.75, Math.PI / 2, seg(t, T.inClass + 0.9, T.inClass + 1.2)); pose = t < T.inClass + 0.9 ? P.walk(t * 9) : P.idle(t); look = V(0.5, 1.4, -4.5); eye.h = 1.25;
    if (t > T.cmd - 0.2) { pose = { ...P.idle(t), rsx: -2.9, rsz: -0.15, re: -0.1, lsz: 0.5, le: -1.5, lsx: 0.1 }; eye.h = 0.65; glow = 0.75; }
    if (t > T.freeze[0]) { pose = { ...P.idle(0), rsx: -2.9, rsz: -0.15, re: -0.1, lsz: 0.5, le: -1.5, lsx: 0.1, sq: 1 }; eye.h = 0.45; glow = 0.4; look = t > T.freeze[0] + 0.7 ? 'camera' : V(0.5, 1.4, -4.5); }
  } else if (t < T.princ) { // tries to catch everything
    pos = FRONT.clone().add(V(0, 0, 0.35 * Math.sin((t - T.chaos) * 3.2))); rotY = Math.PI / 2 + 0.25 * Math.sin((t - T.chaos) * 2.4); eye.h = 1.3; glow = 0.7;
    pose = { ...P.idle(t), lean: 0.1, lsx: -1.9 + 0.6 * Math.sin(t * 9), rsx: -1.9 - 0.6 * Math.sin(t * 9), lsz: 0.5, rsz: -0.5, le: -0.5, re: -0.5, lhx: 0.2 * Math.sin(t * 7), rhx: -0.2 * Math.sin(t * 7) };
    if (t > 20.95 && t < 21.4) { pose = { ...pose, hx: 0.4, lean: -0.25, sq: 0.9 }; eye.h = 0.3; } // pillow bonk
    if (t > T.pointerLand - 0.1) { pos = FRONT.clone(); rotY = Math.PI / 2 + 0.3; pose = { ...P.idle(t), lsx: -1.2, rsx: -1.2, lsz: -0.25, rsz: 0.25, le: -0.6, re: -0.6, hx: 0.45 }; eye.h = 1.0; look = null; }
    if (t > T.pointerLand + 0.6) { pose = { ...pose, hz: 0.25 * Math.sin((t - T.pointerLand) * 2) }; eye.h = 1.15; }
  } else {
    pos = FRONT.clone(); rotY = lerp(Math.PI / 2 + 0.3, 0.55, ease(seg(t, T.princ, T.princ + 0.4))); pose = { ...P.idle(t), lsx: -1.2, rsx: -1.2, lsz: -0.25, rsz: 0.25, le: -0.6, re: -0.6 }; look = 'principal'; eye.h = 1.3;
    if (speaking('F6', t)) { pose = { ...P.skeptic(t), lsx: -0.6, lsz: 0.7, le: -0.6, rsx: -0.9, rsz: -0.7, re: -0.4 }; eye.h = 1.1; glow = 0.75; }
    if (t > vo('F6').t1) { pose = P.idle(t); eye.h = 0.9; }
    if (t > T.sign[0]) { pose = { ...P.idle(t), lsx: -1.25, rsx: -1.25, lsz: -0.32, rsz: 0.32, le: -0.75, re: -0.75 }; }
    if (t > T.sign[1]) { look = null; eye.h = 0.8; pose = { ...pose, hx: 0.35 }; }
    if (t > vo('F7').t0 - 0.5) { rotY = lerp(0.55, 0.55, 1); pose = { ...pose, hx: 0 }; look = 'camera'; eye.h = 0.5; glow = 0.55; }
    if (speaking('F7', t)) { look = 'camera'; eye.h = 0.45; glow = 0.6; }
    if (t > vo('F7').t1) { glow = 1.0; eye.h = 0.42; }
  }
  return { pos, rotY, pose, look, glow, eye };
}
function teacherState(t) {
  let pos = V(0.7, 0, -1.6), rotY = 0, pose = P.idle(t), mood = 'smile', talk = 0, vis = t >= T.teachOut && t < T.inClass + 0.3;
  if (t < T.teachOut + 0.6) { pos = vlerp(V(0.7, 0, -0.9), V(1.0, 0, 1.7), ease(seg(t, T.teachOut, T.teachOut + 0.6))); pose = P.walk(t * 9); }
  else if (t < T.push[0]) { pos = V(1.0, 0, 1.7); rotY = -Math.PI / 2; }
  else { pos = path(t, [[T.push[0], V(1.0, 0, 1.7)], [T.push[0] + 0.45, V(0.9, 0, 1.6)], [T.push[1], V(0.75, 0, 0.6)]]); rotY = Math.PI; pose = { ...P.walk(t * 10), lsx: -1.6, rsx: -1.6, le: -0.2, re: -0.2 }; }
  if (t > T.bookA - 0.4 && t < T.bookB) pose = { ...P.idle(t), lsx: -1.4, le: -0.3 }; // hands the register
  if (speaking('T1', t)) { talk = Math.abs(Math.sin(t * 16)); pose = t < T.bookA - 0.4 ? P.wave(t) : pose; }
  if (t > vo('F3').t1 && t < vo('T2').t1) { pose = { ...P.point(), py: 0.05 * Math.abs(Math.sin(t * 8)) }; mood = 'smile'; }
  if (speaking('T2', t)) talk = Math.abs(Math.sin(t * 15));
  if (speaking('T3', t)) { talk = Math.abs(Math.sin(t * 15)); mood = 'smug'; }
  if (t > T.pat - 0.2 && t < T.pat + 0.45) pose = { ...P.idle(t), lsx: -1.9, lsz: -0.5, le: -0.4 };
  return { pos, rotY, pose, mood, talk, vis };
}
function principalState(t) {
  let pos = PRINC_IN.clone(), rotY = Math.PI * 0.85, pose = { ...P.crossed(t), rhx: 0, rk: 0 }, mood = 'angry', talk = 0, vis = t > T.princ;
  if (t < T.princ + 0.5) { pos = vlerp(V(0.7, 0, 0.9), PRINC_IN, ease(seg(t, T.princ, T.princ + 0.5))); pose = P.walk(t * 9); }
  if (speaking('P1', t)) { talk = 0.5 + 0.5 * Math.abs(Math.sin(t * 15)); mood = 'scream'; pose = { ...P.scream(t), lsx: -0.35, le: -1.1 }; }
  if (t > vo('P1').t1) { mood = 'deadpan'; pose = { ...P.idle(t), lsx: -0.35, le: -1.1 }; }
  if (t > T.sign[0] - 0.3 && t < T.sign[1] + 0.2) { pose = { ...P.idle(t), lsx: -0.35, le: -1.1, rsx: -1.5, re: -0.2 }; }
  if (t > T.sign[1] + 0.2) { pose = { ...P.idle(t), lsx: -0.35, le: -1.1 }; mood = 'smug'; }
  return { pos, rotY, pose, mood, talk, vis };
}
// students: S0 dances on desk, S1 jumps on a chair, S2 throws notebooks, S3 runs laps
const RUN_LOOP = (t, i, r = 1.2, c = V(0.15, 0, -4.6)) => { const a = t * 2.6 + i * 2.1; return { pos: c.clone().add(V(Math.cos(a) * r * 1.4, 0, Math.sin(a) * r * 1.6)), rotY: -a }; };
function studentState(i, t) {
  let pos, rotY = -Math.PI / 2, pose = P.idle(t + i), mood = 'smile', vis = true;
  const seatPos = (k) => V(DESKS[k][0] + 0.55, 0, DESKS[k][1]);
  if (t < T.rwEnd) { // doorway chaos in the flash-forward
    const door = [V(0.35, 0, -0.9), V(1.15, 0, -1.1), V(0.6, 0, -1.8), V(1.4, 0, -2.0)][i]; pos = door.clone().add(V(0, 0.15 * Math.abs(Math.sin(t * 10 + i)), 0)); rotY = 0; pose = { ...P.scream(t + i), lsx: -2.7 + 0.6 * Math.sin(t * 14 + i), rsx: -2.5 - 0.6 * Math.sin(t * 13 + i) }; mood = i % 2 ? 'scream' : 'smug';
    vis = t < T.hookEnd + 0.5;
    return { pos, rotY, pose, mood, vis };
  }
  if (t < T.inClass - 0.3) { vis = false; return { pos: seatPos(i), rotY, pose, mood, vis }; }
  if (t < T.freeze[0] || (t >= T.chaos && t < T.princ)) {
    const ch = t >= T.chaos;
    if (i === 0) { pos = V(DESKS[0][0], 0.82, DESKS[0][1]); rotY = -Math.PI / 2 + 0.4 * Math.sin(t * 3); pose = { ...Z(), py: 0.05 * Math.abs(Math.sin(t * 8)), twist: 0.4 * Math.sin(t * 8), lsx: -2.8, rsx: -1.2 + Math.sin(t * 8), lsz: 0.6 + 0.3 * Math.sin(t * 8), rsz: -0.4, lhx: -0.4 * Math.max(0, Math.sin(t * 8)), rhx: -0.4 * Math.max(0, -Math.sin(t * 8)), lk: 0.5 * Math.max(0, Math.sin(t * 8)), rk: 0.5 * Math.max(0, -Math.sin(t * 8)) }; mood = 'smug';
      if (ch && t > 20.2 && t < 20.7) pose = { ...P.slam(seg(t, 20.2, 20.55)), rsx: lerp(-2.9, -1.2, seg(t, 20.3, 20.55)) }; // pillow throw
    }
    if (i === 1) { const c = seatPos(1); const hop = Math.abs(Math.sin(t * 6)); pos = c.clone().add(V(0, 0.5 + hop * 0.6, 0)); pose = hop > 0.5 ? P.air() : P.crouch(); rotY = -Math.PI / 2 + t * 2; mood = 'surprised';
      if (ch && t > 21.6 && t < 22.5) { const k = seg(t, 21.65, 22.45); pos = vlerp(V(2.4, 0, -4.6), V(0.4, 0, -4.6), k); pos.y += Math.sin(k * Math.PI) * 1.35; rotY = -Math.PI / 2; pose = P.air(); }
      if (ch && t >= 22.5) { const r = RUN_LOOP(t, 1, 0.9, V(0.2, 0, -5.2)); pos = r.pos; rotY = r.rotY; pose = P.run(t * 14); }
    }
    if (i === 2) { pos = V(1.2, 0, -6.6).add(V(0.0, 0, 0.4)); rotY = -Math.PI / 2; pose = { ...P.idle(t), lsx: -2.6 - 0.4 * Math.sin(t * 10), rsx: -2.6 + 0.4 * Math.sin(t * 10), lsz: 0.3, rsz: -0.3, le: -0.6, re: -0.6, py: 0.06 * Math.abs(Math.sin(t * 10)) }; mood = 'smug';
      if (ch && t > 22.5) { pos = V(2.3, 0, -4.1); rotY = Math.PI; pose = t < 23.0 ? { ...P.run(t * 14), lean: 0.4 } : P.run(t * 14); if (t > 23.0) { const r = RUN_LOOP(t, 2, 1.0); pos = r.pos; rotY = r.rotY; } }
    }
    if (i === 3) { const r = RUN_LOOP(t, 3); pos = r.pos; rotY = r.rotY; pose = P.run(t * 14); mood = 'scream';
      if (ch && t > 23.7 && t < 24.15) { pos = V(1.0, 0, -3.0); rotY = Math.PI / 2 + 0.3; pose = { ...P.slam(seg(t, 23.75, 24.05)), rsx: lerp(-2.9, -1.0, seg(t, 23.8, 24.05)) }; } // throws the pointer
    }
    if (!ch && i === 3) { pos = V(-0.2, 0, -5.4).add(V(Math.sin(t * 3) * 0.8, 0, Math.cos(t * 3) * 0.8)); rotY = -t * 3; pose = P.run(t * 14); }
  } else if (t < T.chaos) { // everyone freezes and stares at Foma
    const frozen = studentState(i, T.freeze[0] - 0.01); pos = frozen.pos; rotY = frozen.rotY; pose = frozen.pose; mood = 'deadpan';
    return { pos, rotY, pose, mood, vis, look: true };
  } else { // principal enters: all sit like angels
    pos = seatPos([0, 1, 4, 5][i]).add(V(0, 0.02, 0)); rotY = -Math.PI / 2; pose = { ...P.sit(), lsx: -1.2, rsx: -1.2, le: -0.3, re: -0.3 }; mood = 'smile';
    pos.y = 0.46 - 0.86 * 0.72 + 0.06;
  }
  return { pos, rotY, pose, mood, vis };
}

// ---------- SHOTS ----------
function setCam(pos, target, fov = 50, roll = 0) { cam.position.copy(pos); cam.up.set(0, 1, 0); cam.lookAt(target); if (roll) cam.rotateZ(roll); cam.fov = fov; cam.updateProjectionMatrix(); }
const shake = (a, t, s = 0) => V(noise1(t * 37, s) * a, noise1(t * 41, s + 3) * a, noise1(t * 29, s + 7) * a * 0.5);
const punch = (t, at, amt = 0.18, dur = 0.25) => t < at ? 0 : amt * Math.exp(-(t - at) / dur * 3) * (t - at < dur * 2 ? 1 : 0);
const fH = () => headWorld(foma), tH = () => headWorld(teacher), pH = () => headWorld(principal);
const SHOTS = [
  { id: 'H1', t0: 0, t1: T.hookEnd, f(t, u) { const fx = foma.root.position.x; const x = Math.min(-2.0, fx - 2.6); setCam(V(x, 1.4, 2.7).add(shake(0.025 + 0.04 * Math.max(0, Math.sin(t * 7)), t)), fH().add(V(0.6 * (1 - seg(t, 0, 0.8)), -0.45, -0.3 * (1 - seg(t, 0, 0.8)))), 64); } },
  { id: 'W1', t0: T.rwEnd, t1: T.walkEnd - 0.35, f(t, u) { const p = foma.root.position; setCam(V(p.x + 2.4, 1.55, 2.95), fH().add(V(0, -0.35, 0)), 46); } },
  { id: 'T1', t0: T.walkEnd - 0.35, t1: vo('T1').t1 + 0.05, f(t, u) { setCam(V(-1.35, 1.75, 2.9 - 0.1 * u), tH().add(V(-0.1, -0.35, 0)), lerp(50, 44, u)); } },
  { id: 'T1b', t0: vo('T1').t1 + 0.05, t1: vo('F3').t1 + 0.05, f(t, u) { const h = fH(); setCam(h.clone().add(V(0.85, -0.05, 0.95)), h.clone().add(V(0, -0.12, 0)), 34 * (1 - punch(t, vo('F3').t0, 0.22))); } },
  { id: 'T2', t0: vo('F3').t1 + 0.05, t1: vo('T2').t1 + 0.05, f(t, u) { const h = tH(); setCam(h.clone().add(V(-0.85, 0.0, 0.85)), h.clone().add(V(0, -0.15, 0)), 38); } },
  { id: 'F4', t0: vo('T2').t1 + 0.05, t1: vo('F4').t1 + 0.05, f(t, u) { const h = fH(); setCam(h.clone().add(V(1.2, -0.1, -0.35)), h.clone().add(V(0, -0.3, 0)), 40 * (1 - punch(t, vo('F4').t0 + 0.2, 0.2))); } },
  { id: 'T4', t0: vo('F4').t1 + 0.05, t1: T.push[0], f(t, u) { setCam(V(-1.35, 1.75, 2.9), tH().add(V(-0.2, -0.4, 0)), 52); } },
  { id: 'T5', t0: T.push[0], t1: T.inClass, f(t, u) { setCam(vlerp(V(0.7, 1.7, 3.2), V(0.7, 1.75, 0.55), ease(u)), foma.root.position.clone().add(V(0, 1.0, -0.6)), 58); } },
  { id: 'C1', t0: T.inClass, t1: T.cmd - 0.15, f(t, u) { setCam(V(-4.0, 2.4, -0.9), V(0.6, 0.95, -4.6), 62); } },
  { id: 'C2', t0: T.cmd - 0.15, t1: T.freeze[0], f(t, u) { const h = fH(); setCam(h.clone().add(V(2.1, 0.05, 1.25)), h.clone().add(V(0, -0.15, 0)), 54 * (1 - punch(t, T.cmd + 0.75, 0.14))); } },
  { id: 'C3', t0: T.freeze[0], t1: T.freeze[0] + 0.75, f(t, u) { setCam(V(-3.4, 2.1, -1.5), V(0.6, 1.0, -4.6), 56); } },
  { id: 'C4', t0: T.freeze[0] + 0.75, t1: T.chaos, f(t, u) { const h = fH(); setCam(h.clone().add(V(lerp(1.7, 1.2, u), -0.05, -0.4)), h.clone().add(V(0, -0.2, 0)), 38); } },
  { id: 'D1', t0: T.chaos, t1: 20.75, f(t, u) { setCam(V(4.6, 2.5, -2.4).add(shake(0.04, t, 2)), V(-1.2, 0.9, -4.0), 62); } },
  { id: 'D2', t0: 20.75, t1: 21.55, f(t, u) { const h = fH(); setCam(h.clone().add(V(1.5, 0.0, 0.5)).add(shake(0.03 * seg(t, 21.0, 21.05), t, 9)), h.clone().add(V(0, -0.1, 0)), 40 * (1 - punch(t, 21.02, 0.25))); } },
  { id: 'D3', t0: 21.55, t1: 22.55, f(t, u) { setCam(V(3.5, 0.95, -2.5), V(1.4, 1.45, -4.6), 64); } },
  { id: 'D4', t0: 22.55, t1: 23.2, f(t, u) { setCam(V(3.7, 0.75, -5.7).add(shake(0.03 * seg(t, 22.9, 22.95), t, 4)), V(2.0, 0.45, -4.5), 54); } },
  { id: 'D5', t0: 23.2, t1: 24.35, f(t, u) { const h = fH(); setCam(h.clone().add(V(1.5, 0.1, 1.35)).add(shake(0.02, t, 5)), h.clone().add(V(0, -0.35, 0)), 54); } },
  { id: 'D6', t0: 24.35, t1: T.princ, f(t, u) { const h = fH(); const k = ease(seg(t, T.pointerLand + 0.2, T.princ)); setCam(h.clone().add(V(lerp(2.6, 1.4, k), lerp(-0.1, 0.2, k), lerp(0.9, 0.5, k))), h.clone().add(V(0, -0.35, 0)), 50); } },
  { id: 'P1', t0: T.princ, t1: vo('P1').t0 + 0.15, f(t, u) { setCam(V(-3.4, 1.6, -4.9).add(shake(0.03 * (1 - seg(t, T.princ, T.princ + 0.25)), t, 6)), V(0.6, 1.3, -0.4), 50); } },
  { id: 'P2', t0: vo('P1').t0 + 0.15, t1: vo('P1').t1 + 0.05, f(t, u) { const h = pH(); setCam(h.clone().add(V(-0.75, -0.2, -1.2)), h.clone().add(V(0, -0.12, 0)), 46 * (1 - punch(t, vo('P1').t0 + 0.3, 0.15))); } },
  { id: 'P3', t0: vo('P1').t1 + 0.05, t1: vo('F6').t1 + 0.05, f(t, u) { const h = fH(); setCam(h.clone().add(V(1.0, -0.05, 1.05)), h.clone().add(V(0, -0.25, 0)), 40); } },
  { id: 'P4', t0: vo('F6').t1 + 0.05, t1: vo('F6').t1 + 0.95, f(t, u) { const f = foma.root.position; setCam(V(f.x - 0.45, 1.85, f.z - 1.0), pH().add(V(0, -0.35, 0)), 56); } },
  { id: 'E1', t0: vo('F6').t1 + 0.95, t1: vo('F7').t1, f(t, u) { const h = fH(); const fw = V(Math.sin(foma.root.rotation.y), 0, Math.cos(foma.root.rotation.y)); setCam(h.clone().addScaledVector(fw, lerp(2.5, 2.3, u)).add(V(0, -0.3, 0)), h.clone().add(V(0, -0.5, 0)), 46); } },
  { id: 'E2', t0: vo('F7').t1, t1: T.end + 0.01, f(t, u) { const h = fH(); const k = easeOut(seg(t, vo('F7').t1, vo('F7').t1 + 0.3)); const fw = V(Math.sin(foma.root.rotation.y), 0, Math.cos(foma.root.rotation.y)); setCam(h.clone().addScaledVector(fw, lerp(2.3, 0.75, k)).add(V(0, lerp(-0.3, 0.0, k), 0)), h.clone().add(V(0, lerp(-0.45, 0.02, k), 0)), lerp(46, 30, k)); } },
];
const shotAt = t => SHOTS.find(s => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1];

// ---------- OVERLAYS ----------
function title(txt, y, size, col, k, rot = 0, bg = null) { ctx.save(); ctx.translate(W / 2, y); ctx.rotate(rot); ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k); ctx.globalAlpha = k; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.font = `900 ${size}px Inter`;
  if (bg) { const w = ctx.measureText(txt).width + 80; ctx.fillStyle = bg; rr(ctx, -w / 2, -size * 0.75, w, size * 1.5, 26); ctx.fill(); }
  ctx.lineWidth = 18; ctx.strokeStyle = '#000'; ctx.strokeText(txt, 0, 0); ctx.fillStyle = col; ctx.fillText(txt, 0, 0); ctx.restore(); }
function overlay(t) {
  if (t < T.hookEnd) title('Я ПРОСТО ХОТЕЛ УЧИТЬСЯ', 300, 66, '#ffd21a', easeOut(seg(t, 0.05, 0.2)), -0.04);
  if (t >= T.hookEnd && t < T.rwEnd) { // rewind FX: scanline bands, ◀◀, grey tint
    const img = ctx.getImageData(0, 0, W, H); ctx.putImageData(img, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'hsl(0,0%,50%)'; ctx.globalAlpha = 0.6; ctx.fillRect(0, 0, W, H); ctx.restore();
    const r = rng(Math.floor(t * 60)); for (let i = 0; i < 7; i++) { const y = r() * H, h = 10 + r() * 40, dx = (r() - 0.5) * 120; ctx.drawImage(out, 0, y, W, h, dx, y, W, h); }
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
    ctx.fillStyle = '#fff'; ctx.font = '900 120px Inter'; ctx.textAlign = 'left'; ctx.fillText('◀◀', 80, 200); ctx.font = '800 52px monospace'; ctx.fillText('REW', 300, 190);
  }
  if (t >= T.rwEnd && t < 3.9) title('20 СЕКУНД НАЗАД…', 330, 82, '#ffffff', easeOut(seg(t, T.rwEnd, T.rwEnd + 0.15)) * (1 - seg(t, 3.7, 3.9)), -0.03, 'rgba(0,0,0,0.75)');
  if (t > vo('F7').t1 + 0.12) title('ПОВЫШЕНИЕ ЗА ОДИН УРОК', 1520, 64, '#ffd21a', easeOut(seg(t, vo('F7').t1 + 0.12, vo('F7').t1 + 0.3)), -0.03, 'rgba(0,0,0,0.8)');
  for (const s of SUBS) if (t >= s.t0 && t <= s.t1) drawSub(s, t);
}

// ---------- FRAME ----------
function update(t) {
  doorPiv.rotation.y = (t < T.rwEnd ? -1.6 * ease(seg(t, 0, 0.15)) : 0) + (t >= T.teachOut - 0.1 && t < T.inClass + 0.4 ? -1.5 * ease(seg(t, T.teachOut - 0.1, T.teachOut + 0.15)) * (1 - ease(seg(t, T.inClass, T.inClass + 0.4))) : 0) + (t >= T.princ - 0.05 && t < T.end ? -1.75 * easeOut(seg(t, T.princ - 0.05, T.princ + 0.08)) : 0);
  for (const p of props) propAt(p, t);
  const fs = fomaState(t); applyPose(foma, fs.pos, fs.rotY, fs.pose); foma.state = fs; drawFomaMask({ h: fs.eye.h, px: 0, glow: fs.glow });
  const ts = teacherState(t); teacher.root.visible = ts.vis; applyPose(teacher, ts.pos, ts.rotY, ts.pose); drawNPCFace(teacher.face.c.getContext('2d'), ts.mood, ts.talk); teacher.face.t.needsUpdate = true; if (ts.vis) lookAtWorld(teacher, fH(), 0.85);
  if (t > T.pat - 0.2 && t < T.pat + 0.45) aimArm(teacher, 0, foma.sh[0].getWorldPosition(new THREE.Vector3()).add(V(0, 0.12, 0)), 0.95);
  const pr = principalState(t); principal.root.visible = pr.vis; applyPose(principal, pr.pos, pr.rotY, pr.pose); drawNPCFace(principal.face.c.getContext('2d'), pr.mood, pr.talk); principal.face.t.needsUpdate = true; if (pr.vis) lookAtWorld(principal, fH(), 0.9);
  if (fs.look === 'teacher') lookAtWorld(foma, tH(), 0.9); else if (fs.look === 'principal') lookAtWorld(foma, pH(), 0.9); else if (fs.look && fs.look !== 'camera') lookAtWorld(foma, fs.look, 0.85);
  students.forEach((s, i) => { const st = studentState(i, t); s.root.visible = st.vis; applyPose(s, st.pos, st.rotY, st.pose); drawNPCFace(s.face.c.getContext('2d'), st.mood, st.mood === 'scream' ? Math.abs(Math.sin(t * 16 + i)) : 0); s.face.t.needsUpdate = true; if (st.look) lookAtWorld(s, fH(), 1); });
  extras.forEach((e, i) => { const vis = t >= T.rwEnd && t < T.walkEnd; e.root.visible = vis; applyPose(e, V(-9.5 + i * 4.5, 0, 2.95), Math.PI + (i ? 0.4 : -0.4), i ? P.talk(t) : P.idle(t)); drawNPCFace(e.face.c.getContext('2d'), 'smile', i ? Math.abs(Math.sin(t * 12)) : 0); e.face.t.needsUpdate = true; });
  // register: teacher's hand -> Foma's left hand
  const handT = teacher.hand[0].getWorldPosition(new THREE.Vector3()), handF = foma.hand[0].getWorldPosition(new THREE.Vector3());
  register.visible = t >= T.teachOut && t < T.inClass + 4;
  const rk = ease(seg(t, T.bookA, T.bookB)); register.position.copy(vlerp(handT, handF, rk)).add(V(0, -0.05, 0)); register.rotation.set(0.3, t > T.bookB ? Math.PI / 2 : 0, 0);
  if (t > T.inClass) register.visible = false;
  // giant pointer: lies on the teacher desk, thrown by S3, lands in Foma's hands
  const hm = handF.clone().lerp(foma.hand[1].getWorldPosition(new THREE.Vector3()), 0.5);
  if (t < 24.05) { pointer.position.set(-3.7, 0.86, -5.9); pointer.rotation.set(0, Math.PI / 2, 0); pointer.visible = true; if (t > 23.8) { const s3 = students[3].hand[1].getWorldPosition(new THREE.Vector3()); pointer.position.copy(s3); pointer.rotation.set(0, 0.4, 0.3); } }
  else if (t < T.pointerLand) { const k = seg(t, 24.05, T.pointerLand); const s3 = V(1.0, 1.5, -3.0); pointer.position.copy(vlerp(s3, hm, k)); pointer.position.y += Math.sin(k * Math.PI) * 1.2; pointer.rotation.set(k * 6, 0.4 + k * 2, 0.3 + k * 4); }
  else if (t < vo('F6').t0 + 0.4) { pointer.position.copy(hm).add(V(0, 0.05, 0)); pointer.rotation.set(0, fs.rotY + Math.PI / 2, 0.08); }
  else { const k = seg(t, vo('F6').t0 + 0.4, vo('F6').t0 + 0.9); pointer.position.copy(vlerp(hm, V(FRONT.x + 0.6, 0.05, FRONT.z + 0.3), easeIn(k))); pointer.rotation.set(0, fs.rotY + Math.PI / 2, 0.08 + k * 0.1); }
  // the sign
  const hp = principal.hand[1].getWorldPosition(new THREE.Vector3());
  zavuch.visible = t > T.sign[0] - 0.3;
  const sk = ease(seg(t, T.sign[0], T.sign[1])); const fwd = V(Math.sin(fs.rotY), 0, Math.cos(fs.rotY)); const chestF = fH().add(V(0, -0.72, 0)).addScaledVector(fwd, 0.42);
  zavuch.position.copy(vlerp(hp.clone().add(V(0, 0.05, 0)), chestF, sk)); zavuch.rotation.set(0, lerp(pr.rotY, fs.rotY, sk), 0);
  return fs;
}
function renderFrame(f) {
  const t = f / FPS, ts = srcTime(t); const shot = shotAt(ts >= T.hookEnd ? t : ts);
  const fs = update(ts);
  shot.f(ts, (ts - shot.t0) / (shot.t1 - shot.t0));
  if (fs.look === 'camera') lookAtWorld(foma, cam.position, 1);
  renderer.render(scene, cam); ctx.drawImage(renderer.domElement, 0, 0, W, H);
  overlay(t);
  return shot.id + (t >= T.hookEnd && t < T.rwEnd ? '_RW' : '');
}
window.renderFrame = renderFrame;
window.grab = (q = 0.93) => out.toDataURL('image/jpeg', q);
window.TOTAL = TOTAL;
window.ready = document.fonts.load('900 60px Inter').then(() => true);
window.__dbg = () => { const f = v => v.toArray().map(x => +x.toFixed(2)); return { cam: f(cam.position), foma: f(foma.root.position) }; };
window.renderCover = (t = 17.4) => {
  update(t);
  setCam(fH().add(V(2.5, 0.15, 1.5)), fH().add(V(0, -0.3, 0)), 58); lookAtWorld(foma, cam.position, 1);
  lookAtWorld(foma, cam.position, 1);
  renderer.render(scene, cam); ctx.drawImage(renderer.domElement, 0, 0, W, H);
  const gr = ctx.createLinearGradient(0, 0, 0, 720); gr.addColorStop(0, 'rgba(0,0,0,0.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, 720);
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  const big = (txt, y, size, col) => { ctx.font = `900 ${size}px Inter`; ctx.lineWidth = 22; ctx.strokeStyle = '#000'; ctx.strokeText(txt, W / 2, y); ctx.fillStyle = col; ctx.fillText(txt, W / 2, y); };
  big('МЕНЯ ПРИНЯЛИ', 240, 112, '#fff'); big('ЗА УЧИТЕЛЯ?!', 400, 140, '#ffd21a');
  ctx.save(); ctx.translate(800, 1600); ctx.rotate(-0.1); ctx.fillStyle = '#2f80ed'; rr(ctx, -210, -78, 420, 156, 30); ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = '#fff'; rr(ctx, -210, -78, 420, 156, 30); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = '900 62px Inter'; ctx.fillText('Я УЧЕНИК!', 0, 22); ctx.restore();
  return out.toDataURL('image/png');
};
