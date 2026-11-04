// FOMA — 3D-превиз теста T-01 «Дверь».
// Детерминированная сцена: renderAt(t) полностью определяет кадр по времени t (сек). Никакого накопленного состояния.
// Фома — 3D-манекен по паспорту bible/foma.yaml. Поля TBD (сторона чёрного, форма глаз, трещины, кисти) — плейсхолдеры.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const W = 1280, H = 720;
const PAL = { black: 0x07080a, graphite: 0x1c1f24, dark: 0x2e333a, cold: 0x3b5a7a, moon: 0x9db4cf, glow: 0xf4f8ff, red: 0x9e1b1b };

// ---------- утилиты времени ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;
// key(t, [[t0,v0],[t1,v1],...]) — сглаженная интерполяция по ключам
function key(t, ks) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) {
      const [t0, v0] = ks[i - 1], [t1, v1] = ks[i];
      return lerp(v0, v1, smooth((t - t0) / (t1 - t0)));
    }
  }
  return ks[ks.length - 1][1];
}
const noise = (t, s = 1) => (Math.sin(t * 13.1 * s) * 0.5 + Math.sin(t * 7.3 * s + 1.3) * 0.3 + Math.sin(t * 23.7 * s + 2.1) * 0.2);

// ---------- процедурные текстуры ----------
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const wallpaperTex = (rx) => canvasTex(512, 512, (g, w, h) => {
  const r = rng(7);
  g.fillStyle = '#4a5058'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(30,34,40,0.55)'; g.lineWidth = 3;
  for (let y = 0; y < h + 64; y += 64) for (let x = 0; x < w + 64; x += 64) {
    const ox = (y / 64) % 2 ? 32 : 0;
    g.beginPath(); g.ellipse(x + ox, y, 14, 24, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(x + ox, y - 30); g.lineTo(x + ox, y + 30); g.stroke();
  }
  for (let i = 0; i < 14; i++) { // пятна сырости
    const x = r() * w, y = r() * h, rad = 30 + r() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(40,32,22,0.45)'); gr.addColorStop(1, 'rgba(40,32,22,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  for (let i = 0; i < 6; i++) { // отслоения
    const x = r() * w, y = r() * h;
    g.fillStyle = '#2a2a28'; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 7; k++) g.lineTo(x + (r() - 0.3) * 70, y + (r() - 0.2) * 90);
    g.closePath(); g.fill();
  }
}, [rx, 1]);
const parquetTex = canvasTex(512, 512, (g, w, h) => {
  const r = rng(3);
  for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 128) {
    const ox = (y / 32) % 2 ? 64 : 0, v = 40 + r() * 22;
    g.fillStyle = `rgb(${v + 18},${v + 8},${v - 4})`; g.fillRect(x + ox - 128, y, 126, 30); g.fillRect(x + ox, y, 126, 30);
  }
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 40; i++) g.fillRect(r() * w, r() * h, 2 + r() * 10, 1 + r() * 3);
}, [2, 10]);
const plasterTex = canvasTex(256, 256, (g, w, h) => {
  const r = rng(11); g.fillStyle = '#5c6066'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(20,20,20,0.5)'; g.lineWidth = 1;
  for (let i = 0; i < 5; i++) { let x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
}, [2, 6]);
const calendarTex = canvasTex(256, 360, (g, w, h) => {
  g.fillStyle = '#c9c4b6'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#2b2b2b'; g.font = 'bold 30px sans-serif'; g.fillText('ОКТЯБРЬ', 52, 50);
  g.font = '20px sans-serif';
  for (let d = 1; d <= 31; d++) { const c = (d - 1) % 7, rr = Math.floor((d - 1) / 7); g.fillText(String(d), 22 + c * 32, 100 + rr * 46); }
  g.strokeStyle = '#9e1b1b'; g.lineWidth = 4; g.beginPath(); g.ellipse(22 + 3 * 32 + 10, 100 + 2 * 46 - 7, 20, 17, 0.2, 0, Math.PI * 2); g.stroke();
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(80,60,30,0.0)'); gr.addColorStop(1, 'rgba(80,60,30,0.45)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const doorTex = canvasTex(256, 512, (g, w, h) => {
  const r = rng(5); g.fillStyle = '#b9b8b0'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(60,60,60,0.6)'; g.lineWidth = 6; g.strokeRect(30, 30, w - 60, h * 0.42); g.strokeRect(30, h * 0.52, w - 60, h * 0.42);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(70,55,40,${0.3 + r() * 0.5})`; g.beginPath(); g.ellipse(r() * w, r() * h, 2 + r() * 12, 1 + r() * 6, r() * 3, 0, 7); g.fill(); }
});
// Маска по утверждённому листу (bible/reference/foma_mask_closeup.png):
// пепельно-серая, чёрный сужающийся клин сверху вниз чуть правее центра (для зрителя), трещины, тёмная окантовка прорезей.
// UV — планарная проекция маски: u=0 — левый край для зрителя, v=1 — лоб.
const maskTex = canvasTex(512, 512, (g, w, h) => {
  const r = rng(9);
  g.fillStyle = '#b8b6b1'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '60,58,55' : '220,218,212'},${0.04 + r() * 0.08})`; g.beginPath(); g.ellipse(r() * w, r() * h, 2 + r() * 14, 1 + r() * 8, r() * 3, 0, 7); g.fill(); }
  // клин
  g.fillStyle = '#0a0a0b'; g.beginPath();
  g.moveTo(0.53 * w, 0); g.lineTo(0.69 * w, 0); g.lineTo(0.64 * w, 0.22 * h); g.lineTo(0.6 * w, 0.42 * h); g.lineTo(0.565 * w, 0.62 * h); g.lineTo(0.535 * w, 0.86 * h);
  g.lineTo(0.52 * w, 0.62 * h); g.lineTo(0.515 * w, 0.4 * h); g.lineTo(0.52 * w, 0.2 * h); g.closePath(); g.fill();
  // окантовка прорезей глаз (миндаль, внешние уголки вверх)
  const almond = (cx, cy, s) => { g.beginPath(); g.moveTo(cx - s * 58, cy + 16); g.quadraticCurveTo(cx - s * 2, cy - 44, cx + s * 60, cy - 22); g.quadraticCurveTo(cx + s * 4, cy + 40, cx - s * 58, cy + 16); g.closePath(); };
  g.fillStyle = '#1b1b1c'; almond(0.31 * w, 0.385 * h, -1); g.fill(); almond(0.69 * w, 0.385 * h, 1); g.fill();
  const crack = (pts, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(pts[0][0] * w, pts[0][1] * h); for (const q of pts.slice(1)) g.lineTo(q[0] * w, q[1] * h); g.stroke(); };
  crack([[0.27, 0.55], [0.3, 0.63], [0.26, 0.7], [0.31, 0.79], [0.29, 0.86]], '#2a2a2a', 3);
  crack([[0.3, 0.63], [0.37, 0.66]], '#2a2a2a', 2);
  crack([[0.18, 0.62], [0.22, 0.68]], '#2a2a2a', 2);
  crack([[0.62, 0.8], [0.66, 0.88], [0.63, 0.95]], '#2a2a2a', 2.5);
  crack([[0.7, 0.04], [0.74, 0.12], [0.72, 0.17]], '#3a3a3a', 2);
  crack([[0.42, 0.06], [0.4, 0.14]], '#3a3a3a', 1.5);
});

// ---------- материалы ----------
const std = (color, rough = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
const M = {
  hoodie: std(0x2b2e34, 0.95), pants: std(0x33373e, 0.92), shoe: std(0xb3b0a8, 0.75), sole: std(0xd2cfc6, 0.8), shoeAccent: std(0x2a2b2e, 0.7), hair: std(0x0d0d0f, 0.8), pack: std(0x18191c, 0.85), patch: std(0x5a5d63, 0.9),
  glove: std(0x9a8172, 0.6), mask: std(0xffffff, 0.75, { map: maskTex }), maskBack: std(0x0c0c0d, 0.6),
  eye: new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.glow).multiplyScalar(1.8), toneMapped: false }),
  socket: new THREE.MeshBasicMaterial({ color: 0x050506 }),
  metal: std(0x2c2f34, 0.4, { metalness: 0.7 }), lens: new THREE.MeshBasicMaterial({ color: 0x7d8796 }),
};

// ---------- сцена ----------
export function build(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false); renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.black);
  scene.fog = new THREE.FogExp2(0x0b0e13, 0.085);
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 60);

  // --- коридор: x ∈ [-0.8, 0.8], z ∈ [-7, 0], высота 2.6
  const CW = 1.6, CL = 7, CH = 2.6;
  const room = new THREE.Group(); scene.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(CW, CL + 3), std(0xffffff, 0.8, { map: parquetTex }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -CL / 2 + 1.5); floor.receiveShadow = true; room.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(CW, CL + 3), std(0xffffff, 1, { map: plasterTex }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, CH, -CL / 2 + 1.5); room.add(ceil);
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(CL, CH), std(0xffffff, 0.95, { map: wallpaperTex(5) }));
    wall.rotation.y = -s * Math.PI / 2; wall.position.set(s * CW / 2, CH / 2, -CL / 2); wall.receiveShadow = true; room.add(wall);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, CL), std(0x2b2723)); base.position.set(s * (CW / 2 - 0.01), 0.04, -CL / 2); room.add(base);
  }
  // торцевые стены с проёмами
  const endWall = (z, holeX0, holeX1, holeH, facing) => {
    const g = new THREE.Group();
    const mk = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std(0xffffff, 0.95, { map: wallpaperTex(1) })); m.position.set(x, y, z); m.rotation.y = facing; m.receiveShadow = true; g.add(m); };
    mk(holeX0 + CW / 2, CH, (-CW / 2 + holeX0) / 2, CH / 2);
    mk(CW / 2 - holeX1, CH, (CW / 2 + holeX1) / 2, CH / 2);
    mk(holeX1 - holeX0, CH - holeH, (holeX0 + holeX1) / 2, (CH + holeH) / 2);
    const frame = std(0x8f8d86, 0.8);
    for (const x of [holeX0, holeX1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, holeH, 0.12), frame); f.position.set(x, holeH / 2, z); g.add(f); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(holeX1 - holeX0 + 0.06, 0.06, 0.12), frame); top.position.set((holeX0 + holeX1) / 2, holeH, z); g.add(top);
    room.add(g);
  };
  endWall(-CL, -0.4, 0.4, 2.0, 0);
  endWall(0, -0.45, 0.4, 2.05, Math.PI);
  // дальняя комната — чернота
  const dark = new THREE.Mesh(new THREE.BoxGeometry(3, 2.6, 3), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide }));
  dark.position.set(0, 1.3, -CL - 1.5); scene.add(dark);
  // лестничная клетка за входной дверью
  const stair = new THREE.Mesh(new THREE.BoxGeometry(3, 2.6, 3), std(0x3d4440, 1, { side: THREE.BackSide }));
  stair.position.set(0, 1.3, 1.5); scene.add(stair);
  const stairLight = new THREE.PointLight(0x9fb3a6, 7.0, 6, 2); stairLight.position.set(0.3, 2.3, 1.6); scene.add(stairLight);

  // дальняя дверь (петля слева)
  const farDoor = new THREE.Group(); farDoor.position.set(-0.4, 0, -CL); scene.add(farDoor);
  const fdPanel = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.0, 0.04), std(0xffffff, 0.8, { map: doorTex }));
  fdPanel.position.set(0.4, 1.0, -0.02); fdPanel.castShadow = fdPanel.receiveShadow = true; farDoor.add(fdPanel);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), M.metal); knob.position.set(0.72, 1.0, 0.02); farDoor.add(knob);
  // входная дверь — открыта внутрь, прижата к стене
  const frontDoor = new THREE.Group(); frontDoor.position.set(0.4, 0, 0); scene.add(frontDoor);
  const fr = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.05, 0.06), std(0x3a2e26, 0.7)); fr.position.set(-0.425, 1.025, -0.03); frontDoor.add(fr);
  frontDoor.rotation.y = -1.45;
  // окно (лунный свет) на левой стене
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.moon).multiplyScalar(0.9) }));
  win.position.set(-CW / 2 + 0.01, 1.45, -5.6); win.rotation.y = Math.PI / 2; scene.add(win);
  const moon = new THREE.SpotLight(PAL.moon, 30, 12, 0.6, 0.6, 1.4);
  moon.position.set(-1.6, 2.2, -5.6); moon.target.position.set(0.3, 0, -5.4); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024);
  scene.add(moon, moon.target);
  scene.add(new THREE.HemisphereLight(0x34465f, 0x111318, 0.9));
  const kick = new THREE.SpotLight(0x8aa2c4, 14, 9, 0.5, 0.8, 1.2); kick.position.set(0.55, 2.3, 0.4); kick.target.position.set(0, 0.9, -2.2); scene.add(kick, kick.target);
  const kick2 = new THREE.SpotLight(0x6f87a8, 8, 9, 0.5, 0.8, 1.2); kick2.position.set(-0.6, 0.5, 0.2); kick2.target.position.set(0, 0.6, -2.2); scene.add(kick2, kick2.target);
  const rimL = new THREE.DirectionalLight(0x7189ab, 0.9); rimL.position.set(-0.4, 2.2, -6.5); rimL.target.position.set(0, 1, -1); scene.add(rimL, rimL.target);
  // календарь (правая стена)
  const cal = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.42), std(0xffffff, 0.9, { map: calendarTex }));
  cal.position.set(CW / 2 - 0.005, 1.5, -2.9); cal.rotation.y = -Math.PI / 2; scene.add(cal);
  // вешалка с пальто (левая стена у входа)
  const coat = new THREE.Mesh(new RoundedBoxGeometry(0.16, 1.0, 0.45, 3, 0.06), std(0x2c2a27, 1)); coat.position.set(-CW / 2 + 0.1, 1.35, -0.9); coat.castShadow = true; scene.add(coat);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.8), M.metal); hook.position.set(-CW / 2 + 0.03, 1.88, -0.9); scene.add(hook);
  // мусор
  const r = rng(21);
  for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.05 + r() * 0.15, 0.01 + r() * 0.04, 0.05 + r() * 0.2), std(0x2a2826, 1)); b.position.set((r() - 0.5) * 1.3, 0.02, -0.5 - r() * 6); b.rotation.y = r() * 3; b.castShadow = true; scene.add(b); }
  const chair = new THREE.Group(); chair.position.set(0.55, 0, -4.6); chair.rotation.y = 2.2; scene.add(chair);
  { const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.4), std(0x3a2a20, 0.8)); seat.position.y = 0.45; chair.add(seat); const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.03), std(0x3a2a20, 0.8)); back.position.set(0, 0.7, -0.19); chair.add(back); for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.45, 0.03), std(0x3a2a20, 0.8)); l.position.set(x, 0.225, z); chair.add(l); } chair.traverse(o => o.castShadow = true); }

  // ---------- ФОМА ----------
  const F = buildFoma(); scene.add(F.root);
  // фонарик — в мировых координатах, позиционируется в руку каждый кадр
  const torch = new THREE.Group(); scene.add(torch);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 12), M.metal); body.rotation.x = Math.PI / 2; body.position.z = 0.02; torch.add(body);
  const headT = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.05, 14), M.metal); headT.rotation.x = Math.PI / 2; headT.position.z = 0.13; torch.add(headT);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.026, 16), M.lens); lens.position.z = 0.156; torch.add(lens);
  const spot = new THREE.SpotLight(0xe6eeff, 0, 14, 0.36, 0.5, 1.5); spot.position.set(0, 0, 0.16); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005;
  const spotT = new THREE.Object3D(); spotT.position.set(0, 0, 3); torch.add(spot, spotT); spot.target = spotT;
  // видимый луч в тумане
  const beamGeo = new THREE.ConeGeometry(0.85, 4, 32, 1, true); beamGeo.translate(0, -2, 0); beamGeo.rotateX(-Math.PI / 2);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uI: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying float vZ; varying vec3 vN; varying vec3 vV; void main(){ vZ = position.z; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform float uI; varying float vZ; varying vec3 vN; varying vec3 vV; void main(){ float along = clamp(vZ/4.,0.,1.); float edge = pow(abs(dot(vN,vV)),1.5); float a = uI*0.07*(1.-along)*(1.-along)*edge; gl_FragColor = vec4(vec3(0.85,0.9,1.0)*a, 1.); }',
  });
  const beam = new THREE.Mesh(beamGeo, beamMat); beam.position.z = 0.16; torch.add(beam);
  const bounce = new THREE.PointLight(0xd8e2ff, 0, 1.6, 2); scene.add(bounce);

  // фантомные глаза в темноте (финальный кадр) — опционально
  const ghost = new THREE.Group(); ghost.position.set(0.05, 1.55, -CL - 1.2); scene.add(ghost);
  const gMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.glow).multiplyScalar(2), toneMapped: false, transparent: true, opacity: 0 });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CircleGeometry(0.02, 16), gMat); e.scale.set(1, 0.6, 1); e.position.x = s * 0.06; ghost.add(e); }

  // ---------- пост-обработка ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.35, 0.92); composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 1 }, uBars: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uFade; uniform float uBars; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime*37.0)*43758.5453); }
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float l = dot(c, vec3(0.299,0.587,0.114));
        c = mix(c, vec3(l), 0.35);                                  // приглушить насыщенность
        c = mix(c*vec3(0.86,0.96,1.12), c, smoothstep(0.0,0.6,l));   // холодные тени
        c += vec3(0.008,0.011,0.016);                               // приподнять чёрный в синеву
        vec2 d = vUv-0.5; c *= 1.0 - dot(d,d)*1.25;                 // виньетка
        c += (h(vUv*vec2(1280.,720.))-0.5)*0.02;                    // зерно
        float bar = 0.128; if (uBars > 0.5 && (vUv.y < bar || vUv.y > 1.0-bar)) c = vec3(0.0); // 2.39:1 (отключается для направляющих кадров)
        gl_FragColor = vec4(c*uFade, 1.0);
      }`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  return { renderer, scene, camera, composer, grade, F, torch, spot, spotT, beam, beamMat, bounce, farDoor, moon, win, ghost, gMat };
}

// ---------- манекен Фомы ----------
function buildFoma() {
  const G = () => new THREE.Group();
  const add = (p, geo, mat, pos = [0, 0, 0]) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.castShadow = true; m.receiveShadow = true; p.add(m); return m; };
  const root = G(); const hips = G(); hips.position.y = 0.93; root.add(hips);
  // торс — оверсайз-худи (Lathe-профиль), смещён вниз: подол ниже таза
  const torso = G(); hips.add(torso);
  const prof = [[0.0, -0.17], [0.27, -0.17], [0.3, -0.12], [0.31, 0.1], [0.32, 0.3], [0.31, 0.42], [0.25, 0.5], [0.12, 0.55], [0.0, 0.56]].map(([x, y]) => new THREE.Vector2(x, y));
  const hood = add(torso, new THREE.LatheGeometry(prof, 32), M.hoodie); hood.scale.set(1.12, 1, 0.74);
  add(torso, new RoundedBoxGeometry(0.34, 0.16, 0.04, 2, 0.02), M.hoodie, [0, 0.0, 0.225]); // карман-кенгуру
  for (const s of [-1, 1]) { const st = add(torso, new THREE.CylinderGeometry(0.006, 0.006, 0.22, 6), M.sole, [s * 0.06, 0.38, 0.2]); st.rotation.x = 0.12; }
  // рюкзак + лямки + нагрудная стропа, крест на груди
  add(torso, new RoundedBoxGeometry(0.36, 0.44, 0.17, 3, 0.05), M.pack, [0, 0.24, -0.31]);
  add(torso, new RoundedBoxGeometry(0.3, 0.16, 0.06, 2, 0.02), M.pack, [0, 0.1, -0.41]);
  for (const s2 of [-1, 1]) { const st = add(torso, new THREE.BoxGeometry(0.045, 0.42, 0.02), M.pack, [s2 * 0.14, 0.32, 0.225]); st.rotation.x = -0.12; }
  add(torso, new THREE.BoxGeometry(0.28, 0.03, 0.02), M.pack, [0, 0.33, 0.245]);
  add(torso, new THREE.BoxGeometry(0.04, 0.035, 0.025), M.patch, [0, 0.33, 0.255]);
  add(torso, new THREE.BoxGeometry(0.012, 0.09, 0.006), M.patch, [-0.07, 0.24, 0.236]);
  add(torso, new THREE.BoxGeometry(0.05, 0.012, 0.006), M.patch, [-0.07, 0.26, 0.236]);
  // голова
  const neck = G(); neck.position.y = 0.52; torso.add(neck);
  const head = G(); head.position.y = 0.17; neck.add(head);
  // маска: передняя полусфера с планарной UV-проекцией
  const mg = new THREE.SphereGeometry(1, 48, 32, 0, Math.PI, 0.08 * Math.PI, 0.86 * Math.PI);
  const uv = mg.attributes.uv, p = mg.attributes.position;
  for (let i = 0; i < p.count; i++) { // щит: книзу сужается и вытягивается в остриё
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < 0) { x *= 1 + y * 0.62; y *= 1.22; z *= 1 + y * 0.25; }
    p.setXYZ(i, x, y, z);
  }
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + 1) / 2, (p.getY(i) + 1.22) / 2.22);
  mg.computeVertexNormals();
  const mask = add(head, mg, M.mask); mask.scale.set(0.135, 0.175, 0.13); mask.position.y = 0.0;
  const back = add(head, new THREE.SphereGeometry(1, 32, 16, Math.PI, Math.PI), M.maskBack); back.scale.set(0.14, 0.185, 0.12);
  // капюшон
  const hoodHead = add(head, new THREE.SphereGeometry(1, 40, 24, Math.PI * 0.82, Math.PI * 1.36), M.hoodie, [0, 0.02, -0.02]); hoodHead.scale.set(0.205, 0.245, 0.2);
  const rim = add(head, new THREE.TorusGeometry(1, 0.17, 10, 40), M.hoodie, [0, 0.01, 0.085]); rim.scale.set(0.175, 0.225, 0.2);
  // пряди волос из-под капюшона
  const hr = rng(4);
  for (let i = 0; i < 9; i++) {
    const x = -0.11 + i * 0.0275 + (hr() - 0.5) * 0.01, len = 0.035 + hr() * 0.04;
    const c = add(head, new THREE.ConeGeometry(0.011 + hr() * 0.005, len, 4), M.hair, [x, 0.165 - Math.abs(x) * 0.3, 0.07 + (0.11 - Math.abs(x)) * 0.15]);
    c.rotation.set(Math.PI - 0.5 - hr() * 0.3, 0, (x * 3) + (hr() - 0.5) * 0.5);
  }
  // глаза: светящиеся (ПЛЕЙСХОЛДЕР формы — миндаль), на поверхности маски
  const eyes = [];
  for (const s of [-1, 1]) {
    const eg = G(); eg.position.set(s * 0.051, 0.027, 0.12); eg.rotation.y = s * 0.4; head.add(eg);
    const sh = new THREE.Shape(); // x>0 — наружу
    sh.moveTo(-1, -0.35); sh.quadraticCurveTo(-0.1, 0.55, 1, 0.42); sh.quadraticCurveTo(0.1, -0.55, -1, -0.35);
    const e = add(eg, new THREE.ShapeGeometry(sh, 16), M.eye, [0, 0, 0.003]); e.castShadow = false; e.scale.set(s * 0.025, 0.025, 1);
    eyes.push(e);
  }
  const eyeLight = new THREE.PointLight(0xeaf2ff, 0.06, 0.5, 2); eyeLight.position.set(0, 0.03, 0.2); head.add(eyeLight);
  // руки
  const arm = (s) => {
    const sh = G(); sh.position.set(s * 0.33, 0.44, 0); torso.add(sh);
    const up = add(sh, new THREE.CapsuleGeometry(0.078, 0.22, 6, 12), M.hoodie, [0, -0.15, 0]);
    const el = G(); el.position.y = -0.31; sh.add(el);
    add(el, new THREE.CapsuleGeometry(0.072, 0.2, 6, 12), M.hoodie, [0, -0.13, 0]);
    add(el, new THREE.TorusGeometry(0.06, 0.018, 8, 16), M.hoodie, [0, -0.27, 0]).rotation.x = Math.PI / 2;
    const hand = G(); hand.position.y = -0.3; el.add(hand);
    add(hand, new THREE.SphereGeometry(1, 16, 12), M.glove, [0, -0.05, 0.005]).scale.set(0.045, 0.065, 0.032);
    const th = add(hand, new THREE.CapsuleGeometry(0.014, 0.04, 4, 8), M.glove, [s * -0.035, -0.035, 0.02]); th.rotation.z = s * 0.6;
    return { sh, el, hand, up };
  };
  const R = arm(-1), L = arm(1); // Фома смотрит в +z: его правая — -x
  // ноги
  const leg = (s) => {
    const hip = G(); hip.position.set(s * 0.13, 0, 0); hips.add(hip);
    add(hip, new THREE.CylinderGeometry(0.14, 0.155, 0.46, 16), M.pants, [0, -0.23, 0]);
    add(hip, new RoundedBoxGeometry(0.05, 0.15, 0.13, 2, 0.015), M.pants, [s * 0.16, -0.3, 0]); // карго-карман
    add(hip, new THREE.BoxGeometry(0.012, 0.22, 0.03), M.pack, [s * 0.18, -0.42, 0.03]);
    const knee = G(); knee.position.y = -0.46; hip.add(knee);
    add(knee, new THREE.CylinderGeometry(0.155, 0.18, 0.42, 16), M.pants, [0, -0.2, 0]);
    const ankle = G(); ankle.position.y = -0.41; knee.add(ankle);
    add(ankle, new RoundedBoxGeometry(0.15, 0.09, 0.31, 3, 0.035), M.shoe, [0, -0.0, 0.05]);
    add(ankle, new RoundedBoxGeometry(0.16, 0.05, 0.33, 2, 0.015), M.sole, [0, -0.05, 0.05]);
    add(ankle, new THREE.BoxGeometry(0.152, 0.025, 0.12), M.shoeAccent, [0, 0.0, 0.0]);
    return { hip, knee, ankle };
  };
  const LL = leg(1), RL = leg(-1);
  root.traverse(o => { if (o.isMesh && o.material !== M.eye) o.castShadow = true; });
  return { root, hips, torso, neck, head, eyes, eyeLight, R, L, LL, RL, headParts: [mask, back, hoodHead, rim] };
}

// ---------- ПЕРФОРМАНС (глобальное время) ----------
const Z_DOOR_FAR = -7;
function fomaZ(t) { return key(t, [[0.8, 0.55], [2.6, -0.95], [3.2, -0.95], [5.8, -2.0], [39.15, -2.0], [39.75, -1.62]]); }
function walking(t) { return (t > 0.8 && t < 2.6) || (t > 3.2 && t < 5.8); }

export function renderAt(S, t) {
  const { F, camera } = S;
  // --- позиция и шаг
  const z = fomaZ(t);
  F.root.position.set(0, 0, z); F.root.rotation.y = Math.PI; // лицом к дальней двери (-z)
  const stride = 0.62, ph = (0.55 - z) / stride * Math.PI;
  const w = walking(t) ? 1 : (t > 39.1 && t < 39.8 ? -0.7 : 0);
  const sw = Math.sin(ph) * 0.38 * Math.abs(w) * Math.sign(w || 1);
  F.LL.hip.rotation.x = sw; F.RL.hip.rotation.x = -sw;
  F.LL.knee.rotation.x = Math.max(0, Math.sin(ph + 1.2)) * 0.5 * Math.abs(w);
  F.RL.knee.rotation.x = Math.max(0, Math.sin(ph + 1.2 + Math.PI)) * 0.5 * Math.abs(w);
  F.LL.ankle.rotation.x = -F.LL.hip.rotation.x * 0.3; F.RL.ankle.rotation.x = -F.RL.hip.rotation.x * 0.3;
  F.hips.position.y = 0.93 - Math.abs(Math.sin(ph)) * 0.025 * Math.abs(w);

  // --- дыхание, напряжение, торс
  const fear = key(t, [[22, 0], [23.6, 1], [42, 1]]);
  const breath = Math.sin(t * (2.2 + fear * 2.5)) * (0.008 + fear * 0.01);
  const backLean = key(t, [[39.1, 0], [39.6, -0.16], [41, -0.08]]);
  F.torso.rotation.x = 0.05 + breath + backLean + fear * 0.06;
  F.torso.rotation.y = key(t, [[6, 0], [7.5, 0.22], [9.5, -0.22], [11, -0.3], [13.5, -0.3], [14.5, 0], [22, 0]]);
  // пожатие плечами в SH04 (17.0–18.2)
  const shrug = key(t, [[16.8, 0], [17.3, 1], [18.2, 0]]);
  F.R.sh.position.y = F.L.sh.position.y = 0.44 + shrug * 0.045 + fear * 0.02;
  F.neck.position.y = 0.52 - fear * 0.02;

  // --- голова: обзор, наклон-ирония, рывок к двери
  F.head.rotation.y = key(t, [[0, 0], [4, 0], [6.4, 0], [7.6, 0.5], [9.6, -0.45], [11, -0.75], [13.6, -0.75], [14.6, -0.1], [22.2, -0.1], [23.4, 0], [42, 0]]) + noise(t, 0.4) * 0.02 * fear;
  F.head.rotation.z = key(t, [[15.0, 0], [15.8, 0.28], [20.5, 0.28], [21.5, 0]]);
  F.head.rotation.x = key(t, [[14, 0], [15, 0.12], [20.5, 0.12], [21.5, 0], [23.0, 0], [23.35, -0.1], [24.5, -0.05], [39.2, -0.05], [39.5, -0.18], [41, -0.08]]);

  // --- глаза: сужение и тускнение в SH06
  const squint = key(t, [[27.3, 1], [28.1, 0.5], [33, 0.55], [39.2, 0.55], [39.4, 1.2], [40.5, 0.9]]);
  const blink = (tt) => (Math.abs(t - tt) < 0.09 ? 0.1 : 1);
  const ey = squint * Math.min(blink(9.0), blink(19.4), blink(25.0));
  const dim = key(t, [[29, 1], [31, 0.55], [38.5, 0.55], [39.3, 1.1], [41, 0.9]]);
  F.eyes.forEach(e => e.scale.y = 0.025 * ey);
  M.eye.color.copy(new THREE.Color(PAL.glow).multiplyScalar(1.8 * dim));
  F.eyeLight.intensity = 0.06 * dim;

  // --- цель фонарика
  const aim = new THREE.Vector3(
    key(t, [[3, 0], [6.4, 0], [7.6, -0.75], [9.6, 0.75], [11, 0.8], [11.6, 0.8], [13.6, 0.8], [14.6, 0.2], [22, 0.2], [23.6, 0], [42, 0]]),
    key(t, [[2.6, 0.2], [3.1, 1.0], [6, 1.0], [7.6, 1.3], [9.6, 1.25], [11, 1.5], [13.6, 1.5], [14.8, 0.05], [22, 0.05], [23.7, 1.0], [42, 1.0]]),
    key(t, [[2.6, z - 1.2], [3.1, -5], [6, -5], [7.6, -4.4], [9.6, -4.4], [11, -2.9], [13.6, -2.9], [14.8, -2.9], [22, -2.9], [23.7, Z_DOOR_FAR], [42, Z_DOOR_FAR]])
  );
  const tremble = fear * (0.03 + key(t, [[33.5, 0], [34, 0.05], [38.5, 0.05], [39.6, 0.25], [40.4, 0.03]]));
  aim.x += noise(t, 1.0) * tremble; aim.y += noise(t + 3, 1.2) * tremble;

  // --- правая рука держит фонарик: плечо направляем на цель
  F.root.updateMatrixWorld(true);
  const shW = new THREE.Vector3(); F.R.sh.getWorldPosition(shW);
  const torchUp = key(t, [[2.4, 0], [2.9, 1], [14.4, 1], [15.2, 0.35], [21.8, 0.35], [23.4, 1]]);
  const restDir = new THREE.Vector3(0, -1, 0);
  const aimDir = aim.clone().sub(shW).normalize();
  const dirW = restDir.clone().lerp(aimDir, torchUp).normalize();
  const shParentQ = new THREE.Quaternion(); F.R.sh.parent.getWorldQuaternion(shParentQ);
  const dirL = dirW.clone().applyQuaternion(shParentQ.clone().invert());
  F.R.sh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dirL);
  F.R.el.rotation.set(-0.35 * torchUp, 0, 0);
  // проскальзывание фонарика в SH08
  const slip = key(t, [[39.55, 0], [39.8, 1], [40.15, 0.25], [40.6, 0]]);
  // --- левая рука: покой / жест «нормальный вечер» / подхват фонарика
  const gest = key(t, [[18.4, 0], [18.9, 1], [20.4, 1], [21, 0]]);
  const catchK = key(t, [[39.7, 0], [40.0, 1], [42.5, 1]]);
  const swingL = walking(t) ? -Math.sin(ph) * 0.25 : 0;
  F.L.sh.rotation.set(swingL - gest * 0.5 - catchK * 1.1, 0, 0.12 + gest * 0.15 - catchK * 0.35);
  F.L.el.rotation.set(-gest * 1.2 - catchK * 0.6 - 0.15, 0, 0);
  F.L.hand.rotation.set(0, gest * 1.2, 0);
  F.R.hand.rotation.set(0, 0, 0);

  // --- фонарик в руке
  F.root.updateMatrixWorld(true);
  const hW = new THREE.Vector3(); F.R.hand.localToWorld(hW.set(0, -0.06, 0.02));
  S.torch.position.copy(hW).add(new THREE.Vector3(0, -slip * 0.12, 0));
  S.torch.lookAt(aim.clone().add(new THREE.Vector3(slip * 0.8, -slip * 1.5, 0)));
  const on = t < 3.0 ? 0 : (t < 3.18 ? (Math.sin(t * 90) > 0 ? 1 : 0.2) : 1);
  const flick = (t > 39.6 && t < 39.9) ? 0.35 : 1;
  S.spot.intensity = 10 * on * flick; S.beamMat.uniforms.uI.value = on * flick;
  S.bounce.position.copy(hW).add(new THREE.Vector3(0, 0.15, -0.25)); S.bounce.intensity = 0.05 * on * key(t, [[14.4, 0], [15.2, 1], [21.8, 1], [23.4, 0.2]]);

  // --- дальняя дверь и луна
  S.farDoor.rotation.y = key(t, [[22.8, 0], [23.4, 0.06], [24.0, 0.05], [26.5, 1.25]]);
  const moonK = key(t, [[24, 1], [26.6, 0.12]]);
  S.moon.intensity = 30 * moonK; S.win.material.color.copy(new THREE.Color(PAL.moon).multiplyScalar(0.9 * moonK + 0.05));
  S.gMat.opacity = key(t, [[44.2, 0], [44.6, 0.85], [45.6, 0.85], [45.75, 0]]);
  S.scene.fog.density = 0.085 + Math.sin(t * 0.7) * 0.008;

  // --- КАМЕРА ПО КАДРАМ (тайминг shotlist.csv T-01)
  const head = new THREE.Vector3(); F.head.getWorldPosition(head);
  let fov = 40, pos, look, exp = 1.7; const hideHead = (t >= 33.5 && t < 38.5);
  F.headParts.forEach(m => m.visible = !hideHead); F.eyes.forEach(e => e.parent.visible = !hideHead);
  if (t < 6) { // SH01 общий, наезд
    const k = smooth(t / 6); fov = 46; pos = new THREE.Vector3(0.18, 1.42, lerp(-4.4, -3.9, k)); look = new THREE.Vector3(0, 1.15, lerp(0.2, -1.4, k));
  } else if (t < 11) { // SH02 средний 3/4, панорама за лучом
    fov = 38; pos = new THREE.Vector3(0.55, 1.42, -3.95); look = new THREE.Vector3(lerp(-0.2, 0.12, smooth((t - 6.5) / 4)), 1.38, -2.0);
  } else if (t < 14) { // SH03 деталь календаря
    fov = 30; exp = 0.13; pos = new THREE.Vector3(0.08, 1.52, -2.55); look = new THREE.Vector3(0.8, 1.5, -2.95 + (t - 11) * 0.02);
  } else if (t < 22) { // SH04 крупный маски
    fov = 26; exp = 0.7; pos = new THREE.Vector3(0.12, 1.6, -2.85); look = head.clone().add(new THREE.Vector3(0, -0.04, 0));
  } else if (t < 27) { // SH05 через плечо, симметрия
    fov = 42; pos = new THREE.Vector3(0.3, 1.66, -1.15); look = new THREE.Vector3(-0.02, 1.2, -7);
  } else if (t < 33.5) { // SH06 сверхкрупный, очень медленный наезд
    fov = 22; exp = 0.75; pos = new THREE.Vector3(0.02, 1.62, lerp(-2.7, -2.5, smooth((t - 27) / 6.5))); look = head.clone();
  } else if (t < 38.5) { // SH07 POV
    fov = 50; pos = head.clone().add(new THREE.Vector3(noise(t, 0.3) * 0.006, 0.0, -0.05)); look = new THREE.Vector3(0, 1.1, lerp(-6.0, -7.2, smooth((t - 33.5) / 5)));
  } else if (t < 42.5) { // SH08 средний
    fov = 27; pos = new THREE.Vector3(0.12, 1.22, -5.2); look = new THREE.Vector3(0, 1.22, -1.8); // из темноты проёма
  } else { // SH09 проём, статика
    fov = 34; pos = new THREE.Vector3(0.05, 1.3, -4.5); look = new THREE.Vector3(0, 1.1, -7.5);
  }
  S.renderer.toneMappingExposure = exp;
  camera.fov = fov; camera.updateProjectionMatrix(); camera.position.copy(pos); camera.lookAt(look);
  S.grade.uniforms.uTime.value = t;
  S.grade.uniforms.uFade.value = t >= 46.5 ? 0 : key(t, [[0, 0], [0.8, 1]]) * (t > 45.9 ? key(t, [[45.9, 1], [46.5, 0]]) : 1);
  S.composer.render();
}
