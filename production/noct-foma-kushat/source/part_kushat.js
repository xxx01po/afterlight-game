
// ======================= NOCT · FOMA — «Я ЗАБАНИЛ СОБСТВЕННУЮ МАМУ» =======================
// Real room: x -3..3, z -3..3, h 2.8. Desk + monitor at z≈-2.4 (screen faces +z). Foma sits at (0,-0.9) facing -z. Door behind him in wall z=+3 (x 0.2..1.2).
// Game arena far away at GX (renders to the monitor and to full-screen game shots).
const RH = 2.8, GX = 120;
scene.background = new THREE.Color(0x0b0c14); scene.fog = null;
const world = new THREE.Group(); scene.add(world);
const wb = (x0, x1, y0, y1, z0, z1, mat) => add(world, box(x1 - x0, y1 - y0, z1 - z0, mat, 0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
const wallT = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#2b2f45'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.04)'; for (let x = 0; x < w; x += 24) g.fillRect(x, 0, 10, h); }, [4, 1]);
const mW = M(0xffffff, 0.9, { map: wallT });
const doorPiv = new THREE.Group();
{
  add(world, box(6, 0.06, 6, M(0x3a2f2a, 0.8), 0), 0, -0.03, 0); add(world, box(6, 0.06, 6, M(0x1d1f2a, 0.9), 0), 0, RH + 0.03, 0);
  wb(-3.2, -3, 0, RH, -3, 3, mW); wb(3, 3.2, 0, RH, -3, 3, mW); wb(-3, 3, 0, RH, -3.2, -3, mW);
  wb(-3, 0.2, 0, RH, 3, 3.2, mW); wb(1.2, 3, 0, RH, 3, 3.2, mW); wb(0.2, 1.2, 2.2, RH, 3, 3.2, mW);
  const hall = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.4), new THREE.MeshBasicMaterial({ color: 0xffd9a0 })); hall.position.set(0.7, 1.1, 3.6); hall.rotation.y = Math.PI; world.add(hall);
  doorPiv.position.set(0.2, 0, 3.0); world.add(doorPiv); add(doorPiv, box(1.0, 2.2, 0.06, M(0x5a3a22, 0.6), 0.02), 0.5, 1.1, 0); add(doorPiv, box(0.14, 0.04, 0.1, M(0xcccccc, 0.3, { metalness: 0.8 }), 0.01), 0.85, 1.0, -0.06);
  // desk, PC tower, keyboard, mouse, poster, bed, RGB strip
  add(world, box(2.2, 0.06, 0.9, M(0x15161c, 0.4), 0.02), 0, 0.76, -2.35); for (const x of [-1.0, 1.0]) add(world, box(0.06, 0.74, 0.8, M(0x15161c, 0.4), 0.01), x, 0.37, -2.35);
  add(world, box(0.45, 0.9, 0.6, M(0x111218, 0.3), 0.03), 1.45, 0.45, -2.3); add(world, box(0.02, 0.6, 0.4, M(0x7c4dff, 0.3, { emissive: 0x7c4dff, emissiveIntensity: 1.4 }), 0), 1.22, 0.5, -2.3);
  add(world, box(0.9, 0.03, 0.28, M(0x1b1c22, 0.4), 0.01), 0, 0.81, -2.05); add(world, box(0.12, 0.03, 0.18, M(0x1b1c22, 0.4), 0.02), 0.6, 0.81, -2.05);
  add(world, box(2.0, 0.9, 1.2, M(0x2d3a6a, 0.9), 0.06), -2.0, 0.3, 1.6); add(world, box(0.7, 0.15, 0.5, M(0xe8e8f0, 0.9), 0.06), -2.0, 0.82, 2.0);
  const pT = canvasTex(256, 320, (g, w, h) => { g.fillStyle = '#7c4dff'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '900 52px Inter'; g.textAlign = 'center'; g.fillText('PRO', w / 2, 130); g.fillText('GAMER', w / 2, 200); });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), M(0xffffff, 0.8, { map: pT })); p.position.set(-1.6, 1.8, -2.97); world.add(p);
  add(world, box(5.8, 0.03, 0.03, M(0xff3cf0, 0.2, { emissive: 0xff3cf0, emissiveIntensity: 2 }), 0), 0, RH - 0.05, -2.95);
  // power socket + cable (the cable that mom pulls)
  add(world, box(0.12, 0.12, 0.02, M(0xffffff, 0.4), 0.01), 2.2, 0.35, -2.98);
}
const chair = new THREE.Group(); chair.position.set(0, 0, -0.9); world.add(chair);
add(chair, box(0.62, 0.12, 0.6, M(0x1b1c22, 0.6), 0.04), 0, 0.5, 0); add(chair, box(0.62, 1.0, 0.14, M(0xe0302a, 0.6), 0.05), 0, 1.0, 0.32); add(chair, box(0.08, 0.5, 0.08, M(0x333333, 0.4), 0.01), 0, 0.25, 0);
// monitor with a live game feed
const rtGame = new THREE.WebGLRenderTarget(960, 540, { colorSpace: THREE.SRGBColorSpace });
const monitor = new THREE.Group(); monitor.position.set(0, 1.25, -2.55); world.add(monitor);
add(monitor, box(1.3, 0.78, 0.06, M(0x0d0e12, 0.3), 0.02), 0, 0, 0); add(monitor, box(0.08, 0.4, 0.08, M(0x0d0e12, 0.3), 0.01), 0, -0.55, -0.05);
const screenMat = new THREE.MeshBasicMaterial({ map: rtGame.texture, toneMapped: false });
const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 0.69), screenMat); screen.position.z = 0.035; monitor.add(screen);
const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), M(0x111111, 0.5)); world.add(cable);
const plug = add(world, box(0.06, 0.04, 0.09, M(0x222222, 0.5), 0.01), 0, 0, 0);

// ---------- GAME ARENA (lava island) ----------
const arena = new THREE.Group(); arena.position.set(GX, 0, 0); scene.add(arena);
{
  const lavaT = canvasTex(256, 256, (g, w, h) => { const r = rng(3); g.fillStyle = '#ff5a00'; g.fillRect(0, 0, w, h); for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,${180 + r() * 70},0,${0.4 + r() * 0.5})`; g.beginPath(); g.arc(r() * w, r() * h, 6 + r() * 18, 0, 7); g.fill(); } }, [10, 10]);
  const lava = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ map: lavaT, color: 0xffffff })); lava.rotation.x = -Math.PI / 2; lava.position.y = -2.5; arena.add(lava);
  add(arena, box(9, 1.2, 7, M(0x57b85a, 0.8, { map: studTex }), 0.1), 0, -0.6, 0); add(arena, box(9.2, 1.4, 7.2, M(0x7a5230, 0.9), 0.1), 0, -1.4, 0);
  for (const [x, z] of [[-3.8, -2.8], [3.8, -2.8]]) { add(arena, box(0.6, 2.6, 0.6, M(0x9aa3ad, 0.6), 0.05), x, 1.3, z); add(arena, box(0.9, 0.3, 0.9, M(0x9aa3ad, 0.6), 0.05), x, 2.7, z); }
  const ban = canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#7c4dff'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd21a'; g.font = '900 84px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ФИНАЛ', w / 2, h / 2 + 4); });
  const b = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.2), new THREE.MeshBasicMaterial({ map: ban })); b.position.set(0, 3.2, -2.8); arena.add(b);
  add(arena, cyl(0.35, 0.45, 0.6, M(0xffd21a, 0.3, { metalness: 0.7 }), 16), 0, 0.3, -2.4);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 12), new THREE.MeshBasicMaterial({ color: 0x2a1240, side: THREE.BackSide })); arena.add(sky);
  const al = new THREE.PointLight(0xff7a20, 40, 30, 1.2); al.position.set(0, -1.5, 3); arena.add(al);
  const top = new THREE.DirectionalLight(0xffffff, 2.2); top.position.set(GX + 4, 10, 6); top.target.position.set(GX, 0, 0); scene.add(top, top.target);
}
function tagSprite(txt, col) { const t = canvasTex(512, 128, (g, w, h) => { g.fillStyle = 'rgba(0,0,0,0.55)'; rr(g, 40, 20, 432, 88, 30); g.fill(); g.fillStyle = col; g.font = '800 64px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, 66); }); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(1.8, 0.45, 1); return s; }
const knight = npc({ scale: 0.8, skin: 0xf2c94c, shirt: 0x2f80ed, pants: 0x30303a, extra(r) { add(r.neck, box(0.5, 0.36, 0.5, M(0xbfc5cc, 0.3, { metalness: 0.7 }), 0.06), 0, 0.3, 0); add(r.neck, box(0.36, 0.06, 0.04, M(0x111111, 0.5), 0), 0, 0.28, 0.255); const sw = new THREE.Group(); sw.position.y = -0.06; r.hand[1].add(sw); add(sw, box(0.06, 0.06, 1.0, M(0xdfe6ee, 0.2, { metalness: 0.9 }), 0.01), 0, -0.05, 0.55); add(sw, box(0.3, 0.06, 0.06, M(0xffc928, 0.3), 0.01), 0, -0.05, 0.05); } });
const enemy = npc({ scale: 0.8, skin: 0x222222, shirt: 0xc0262d, pants: 0x1b1b1b, extra(r) { add(r.neck, box(0.47, 0.18, 0.47, M(0xc0262d, 0.6), 0.04), 0, 0.3, 0); const sw = new THREE.Group(); sw.position.y = -0.06; r.hand[1].add(sw); add(sw, box(0.05, 0.05, 0.8, M(0x8a8f98, 0.3, { metalness: 0.8 }), 0.01), 0, -0.05, 0.45); } });
const momAv = npc({ scale: 0.8, skin: 0xf2c94c, shirt: 0xd23f7a, pants: 0x3a3f5a, extra(r) { add(r.neck, box(0.48, 0.14, 0.48, M(0x7a4a26, 0.7), 0.05), 0, 0.47, -0.01); add(r.neck, new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), M(0x7a4a26, 0.7)), 0, 0.6, -0.16); add(r.chest, box(0.5, 0.52, 0.02, M(0xffffff, 0.7), 0.01), 0, 0.24, 0.18);
  const ld = new THREE.Group(); ld.position.y = -0.06; r.hand[1].add(ld); add(ld, cyl(0.02, 0.02, 0.6, M(0xbfc5cc, 0.3, { metalness: 0.8 }), 8), 0, -0.22, 0.12).rotation.x = Math.PI / 2; add(ld, new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M(0xbfc5cc, 0.3, { metalness: 0.8 })), 0, -0.2, 0.44); } });
const tagK = tagSprite('Foma_NOCT', '#7fd3ff'), tagE = tagSprite('xX_Killer_Xx', '#ff6a6a'), tagM = tagSprite('МАМА', '#ffd21a');
scene.add(tagK, tagE, tagM);
const poofT = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(200,200,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
const poofs = [...Array(8)].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: poofT, transparent: true, depthWrite: false })); scene.add(s); return s; });

// ---------- REAL CAST ----------
const mom = npc({ skin: 0xf2c94c, shirt: 0xd23f7a, pants: 0x3a3f5a, shoe: 0x5a2a1e, extra(r) {
  add(r.neck, box(0.48, 0.14, 0.48, M(0x7a4a26, 0.7), 0.05), 0, 0.47, -0.01); add(r.neck, box(0.48, 0.32, 0.12, M(0x7a4a26, 0.7), 0.04), 0, 0.33, -0.2);
  add(r.neck, new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), M(0x7a4a26, 0.7)), 0, 0.6, -0.16);
  add(r.chest, box(0.5, 0.52, 0.02, M(0xffffff, 0.7), 0.01), 0, 0.24, 0.18); add(r.chest, box(0.3, 0.12, 0.02, M(0xffffff, 0.7), 0.01), 0, 0.58, 0.18); } });

// ---------- LIGHTS ----------
scene.add(new THREE.HemisphereLight(0x8090c0, 0x201820, 0.75));
const rgbL = new THREE.PointLight(0xff3cf0, 5, 7, 1.5); rgbL.position.set(0, RH - 0.3, -2.4); scene.add(rgbL);
const monL = new THREE.PointLight(0x7fd3ff, 3.2, 4, 1.6); monL.position.set(0, 1.3, -2.2); scene.add(monL);
const hallL = new THREE.SpotLight(0xffc98a, 0, 9, 0.75, 0.5, 1.2); hallL.position.set(0.7, 2.1, 3.8); hallL.target.position.set(0, 0.8, -1.0); scene.add(hallL, hallL.target);
const gapStrip = add(world, box(0.92, 0.025, 0.02, new THREE.MeshBasicMaterial({ color: 0xffd090 }), 0), 0.7, 0.015, 2.97);
const doorL = new THREE.PointLight(0xffc98a, 2.2, 3.5, 1.6); doorL.position.set(0.7, 0.15, 2.7); scene.add(doorL);
const momL = new THREE.PointLight(0xffc98a, 0, 3, 1.5); momL.position.set(0.3, 1.9, 0.4); scene.add(momL);
const fill = new THREE.PointLight(0x5a6aa0, 2.6, 8, 1.4); fill.position.set(-1.5, 2.4, 1.2); scene.add(fill);

// ---------- TIMELINE ----------
const T = {}; function beats() {
  T.ffA = 0.95; T.ffB = 1.6; T.rw0 = 2.62; T.hook = 2.95; T.call1 = vo('M1').t0; T.call2 = vo('M2').t0; T.silence = vo('F2').t1 + 0.15; T.join = 13.75; T.block = vo('F4').t1 + 0.08;
  T.chat = [T.block + 0.3, T.block + 1.0, T.block + 1.7]; T.killer = T.block + 2.45; T.logout = T.block + 3.35;
  T.type = vo('F5').t1 + 0.15; T.banned = T.type + 1.2; T.doorOpen = vo('F6').t1 + 0.35; T.pull = T.doorOpen + 1.5; T.end = 35.0;
} beats();
const SEAT = V(0, 0, -0.9);
function fomaState(t) {
  let pos = SEAT.clone(), rotY = Math.PI, pose, look = monitor.position.clone().add(V(0, 0, 0)), glow = 0.6, eye = { h: 0.85, px: 0 };
  const typing = (k = 1) => ({ ...P.sit(), lean: 0.12, lsx: -1.25 + 0.06 * k * Math.sin(t * 31), rsx: -1.2 + 0.08 * k * Math.sin(t * 27 + 1), le: -0.55, re: -0.5, lsz: 0.05, rsz: -0.05 });
  pose = typing(1);
  if (t < T.hook) { pose = typing(0.3); eye.h = 0.42; glow = 1.0; look = 'camera'; }
  if (speaking('F1', t)) { pose = { ...typing(1), hz: 0.15 }; look = V(0.7, 1.4, 3.0); eye.h = 0.7; }
  if (t > T.call2 && t < T.silence) { pose = typing(1.6); eye.h = 1.1; glow = 0.8; }
  if (t > T.silence && t < T.join) { pose = { ...P.sit(), lean: 0.05, lsx: -1.2, rsx: -1.2, le: -0.5, re: -0.5 }; look = V(0.7, 1.4, 3.0); eye.h = 1.3; glow = 0.5; }
  if (t > T.join && t < T.type) { pose = typing(1.3); eye.h = 1.35; glow = 0.85; }
  if (t > T.type && t < T.banned + 0.3) { pose = typing(2.4); eye.h = 0.5; glow = 1.0; }
  if (speaking('F6', t)) { pose = { ...P.sit(), lean: -0.1, lsx: -0.6, rsx: -0.6, le: -1.4, re: -1.4, lsz: 0.4, rsz: -0.4 }; eye.h = 0.6; look = 'camera'; }
  if (t > vo('F6').t1 && t < T.pull) { pose = typing(1); eye.h = 0.8; look = monitor.position.clone(); }
  if (t >= T.pull) { pose = { ...P.sit(), lsx: -1.2, rsx: -1.2, le: -0.5, re: -0.5, sq: 0.97 }; eye.h = 1.4; glow = 0.4; look = monitor.position.clone(); }
  if (t > T.pull + 0.5) { look = mom.root.visible ? headWorld(mom) : null; eye.h = 1.3; }
  if (t > vo('M3').t1 + 0.1) { look = 'camera'; eye.h = 0.45; glow = 0.55; pose = { ...pose, sq: 0.95, lean: 0.06 }; }
  return { pos, rotY, pose, look, glow, eye };
}
// game choreography (arena-local)
function gameState(t) {
  const g = { e0: 0, k: { p: V(-1.2, 0, 0.6), r: Math.PI / 2, pose: P.idle(t) }, e: { p: V(1.4, 0, 0.4), r: -Math.PI / 2, pose: P.idle(t) }, m: { vis: false, p: V(0, 0, 0), r: 0, pose: P.idle(t) } };
  const swing = (ph) => ({ ...P.idle(t), rsx: -2.6 + 2.0 * Math.max(0, Math.sin(ph)), rsz: -0.2, re: -0.3, lean: 0.15 * Math.sin(ph) });
  g.k.p.x += 0.35 * Math.sin(t * 2.2); g.e.p.x += 0.3 * Math.sin(t * 2.0 + 1); g.k.pose = swing(t * 7); g.e.pose = swing(t * 6 + 2);
  if (t > T.join - 0.3) { const k = easeOut(seg(t, T.join, T.join + 0.6)); g.m.vis = true; g.m.p = vlerp(V(0.2, 6, -1.5), V(0.2, 0, -0.8), k); g.m.r = 0.4; g.m.pose = k < 1 ? P.air() : P.land(); }
  if (t > T.block) { const ph = (t - T.block) * 1.4; g.m.p = V(-0.4 + 0.35 * Math.sin(ph * 3), 0, 0.6 + 0.25 * Math.cos(ph * 3)); g.m.r = Math.PI / 2 + 0.3 * Math.sin(ph); g.m.pose = { ...P.crossed(t), rhx: 0, rk: 0 }; g.k.pose = { ...P.idle(t), rsx: -1.2, lsx: -0.6, le: -1.0 }; g.k.p = V(-1.4, 0, 0.6); }
  g.e.vis = t < T.logout; if (t > T.block) { g.e.pose = { ...P.idle(t), hz: 0.3 * Math.sin(t * 3) }; g.e.p = V(1.6, 0, 0.3); }
  if (t > T.banned) g.m.vis = false;
  if (t > T.banned + 0.6) { g.k.pose = swing(t * 9); g.k.p = V(-0.6 + 0.4 * Math.sin(t * 3), 0, 0.6); }
  return g;
}
// ---------- CAMERAS ----------
const gameCam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 200);
function setGameCam(t, aspect, wide = 1, mode = 'wide', u = 0) {
  gameCam.aspect = aspect; gameCam.fov = aspect < 1 ? 62 : 46;
  if (mode === 'wide' || aspect > 1) { gameCam.position.set(GX - 0.2, 1.6 * wide + 0.7, 4.2 * wide); gameCam.lookAt(GX - 0.2, 0.9, 0); }
  else { const r = { k: knight, m: momAv, e: enemy }[mode]; const h = headWorld(r); const off = { k: V(1.7, 0.3, 1.3), m: V(0.35, 0.15, 1.9), e: V(1.7, 0.25, 1.2) }[mode]; gameCam.position.copy(h).add(off.multiplyScalar(lerp(1.15, 0.9, u))); gameCam.lookAt(h.clone().add(V(0, -0.35, 0))); gameCam.fov = 50; }
  gameCam.updateProjectionMatrix();
}
function setCam(pos, target, fov = 50, roll = 0) { cam.position.copy(pos); cam.up.set(0, 1, 0); cam.lookAt(target); if (roll) cam.rotateZ(roll); cam.fov = fov; cam.updateProjectionMatrix(); }
const shake = (a, t, s = 0) => V(noise1(t * 37, s) * a, noise1(t * 41, s + 3) * a, noise1(t * 29, s + 7) * a * 0.5);
const punch = (t, at, amt = 0.18, dur = 0.25) => t < at ? 0 : amt * Math.exp(-(t - at) / dur * 3) * (t - at < dur * 2 ? 1 : 0);
const fH = () => headWorld(foma), mH = () => headWorld(mom);
const DOORPOV = (u, a = V(0.25, 1.75, -0.3), b = V(0.4, 1.6, 0.6)) => setCam(vlerp(a, b, ease(u)), V(0.7, 1.15, 3.0), 50);
const SHOTS = [
  { id: 'HOOK', t0: 0, t1: T.ffA, f(t, u) { const h = fH(); setCam(h.clone().add(V(0.05, -0.05, -lerp(1.6, 1.35, ease(u)))), h.clone().add(V(0, -0.12, 0)), 38); } },
  { id: 'FF', t0: T.ffA, t1: T.ffB, game: true, gm: 'm', vt: t => T.banned - 0.25 + (t - T.ffA) * 0.6, shk: 0.06 },
  { id: 'HOOK2', t0: T.ffB, t1: T.rw0, f(t, u) { const h = fH(); setCam(h.clone().add(V(0.05, -0.05, -lerp(1.2, 0.95, ease(u)))).add(shake(0.004, t)), h.clone().add(V(0, -0.12, 0)), 38 * (1 - punch(t, T.ffB, 0.12))); } },
  { id: 'RW', t0: T.rw0, t1: T.hook, game: true, vt: t => lerp(T.banned, T.hook + 0.4, seg(t, T.rw0, T.hook)), shk: 0.05 },
  { id: 'G1', t0: T.hook, t1: T.call1 + 0.35, game: true, gm: 'k', shk: 0.03 },
  { id: 'D1', t0: T.call1 + 0.35, t1: vo('M1').t1 + 0.1, f(t, u) { setCam(V(-1.5, 1.55, -2.1), V(0.6, 1.15, 3.0), 46 * (1 - 0.06 * u)); } },
  { id: 'R1', t0: vo('M1').t1 + 0.1, t1: vo('F1').t1 + 0.05, f(t, u) { setCam(V(0.75, 1.45, -2.05), fH().add(V(0, -0.3, 0)), lerp(50, 44, u)); } },
  { id: 'G2', t0: vo('F1').t1 + 0.05, t1: T.call2 - 0.02, game: true, gm: 'e', shk: 0.04 },
  { id: 'R2', t0: T.call2 - 0.02, t1: vo('M2').t1 + 0.05, f(t, u) { setCam(V(0.55, 1.75, 0.35).add(shake(0.035 * (1 - seg(t, T.call2, T.call2 + 0.8)) + 0.005, t)), V(0, 1.2, -2.5), 46 * (1 - punch(t, T.call2 + 0.05, 0.2))); } },
  { id: 'R2b', t0: vo('M2').t1 + 0.05, t1: T.silence, f(t, u) { const h = fH(); setCam(h.clone().add(V(-0.2, -0.06, -lerp(1.15, 1.0, u))), h.clone().add(V(0, -0.1, 0)), 40 * (1 - punch(t, vo('F2').t0 + 0.1, 0.15))); } },
  { id: 'D2', t0: T.silence, t1: vo('F3').t0, f(t, u) { DOORPOV(u); } },
  { id: 'R3', t0: vo('F3').t0, t1: T.join - 0.05, f(t, u) { const h = fH(); setCam(h.clone().add(V(lerp(1.2, 0.95, u), 0.0, 0.55)), h.clone().add(V(0, -0.08, 0)), 38); } },
  { id: 'GJ', t0: T.join - 0.05, t1: vo('F4').t0, game: true, gm: 'wide', shk: 0.02, bump: [T.join + 0.6] },
  { id: 'R4', t0: vo('F4').t0, t1: T.block, f(t, u) { const h = fH(); setCam(h.clone().add(V(-0.15, -0.08, -lerp(1.25, 1.0, u))).add(shake(0.012, t, 3)), h.clone().add(V(0, -0.1, 0)), 38 * (1 - punch(t, vo('F4').t0 + 0.15, 0.2) - punch(t, vo('F4').t0 + 0.9, 0.12))); } },
  { id: 'G3', t0: T.block, t1: T.chat[2] - 0.1, game: true, gm: 'wide', shk: 0.015 },
  { id: 'G3m', t0: T.chat[2] - 0.1, t1: T.killer - 0.05, game: true, gm: 'm', bump: [T.chat[2]] },
  { id: 'G3e', t0: T.killer - 0.05, t1: vo('F5').t0, game: true, gm: 'e', bump: [T.logout] },
  { id: 'R5a', t0: vo('F5').t0, t1: T.type, f(t, u) { const h = fH(); setCam(h.clone().add(V(0.2, -0.08, -lerp(1.3, 1.0, u))).add(shake(0.01, t, 7)), h.clone().add(V(0, -0.1, 0)), 40 * (1 - punch(t, vo('F5').t0 + 0.8, 0.18))); } },
  { id: 'R5', t0: T.type, t1: T.banned - 0.05, f(t, u) { setCam(V(lerp(0.7, 0.55, ease(u)), 1.42, lerp(-2.05, -1.85, ease(u))), fH().add(V(-0.1, -0.2, 0)), lerp(44, 36, u)); } },
  { id: 'G4', t0: T.banned - 0.05, t1: T.banned + 0.8, game: true, gm: 'm', shk: 0.07 },
  { id: 'G4w', t0: T.banned + 0.8, t1: vo('F6').t0, game: true, gm: 'k', shk: 0.02 },
  { id: 'R6', t0: vo('F6').t0, t1: vo('F6').t1 + 0.1, f(t, u) { setCam(V(0.75, 1.45, -2.05), fH().add(V(0, -0.25, 0)), lerp(48, 40, u)); } },
  { id: 'R7', t0: vo('F6').t1 + 0.1, t1: T.pull - 0.45, f(t, u) { setCam(vlerp(V(-1.3, 1.75, 2.5), V(-0.85, 1.6, 1.75), ease(u)), V(0.25, 1.05, -1.3), lerp(50, 44, ease(u))); } },
  { id: 'R7s', t0: T.pull - 0.45, t1: T.pull + 0.1, f(t, u) { setCam(V(1.75, 0.72, -2.3).add(shake(0.02 * seg(t, T.pull, T.pull + 0.05), t, 4)), V(2.2, 0.35, -2.98), 40); } },
  { id: 'R7m', t0: T.pull + 0.1, t1: vo('M3').t0, f(t, u) { setCam(V(0.75, 1.95, -0.25), V(0, 1.15, -2.55), 42); } },
  { id: 'R8', t0: vo('M3').t0, t1: vo('M3').t1 + 0.1, f(t, u) { const h = mH(); setCam(h.clone().add(V(-0.35, -0.1, -lerp(1.4, 1.2, u))), h.clone().add(V(0, -0.25, 0)), 44 * (1 - punch(t, vo('M3').t0 + 0.05, 0.12))); } },
  { id: 'R9', t0: vo('M3').t1 + 0.1, t1: T.end + 0.01, f(t, u) { const h = fH(); setCam(h.clone().add(V(0.15, -0.05, -lerp(1.2, 0.85, ease(u)))), h.clone().add(V(0, -0.05, 0)), 36 * (1 - punch(t, vo('F7').t0 + 0.1, 0.08))); } },
];
const shotAt = t => SHOTS.find(s => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1];

// ---------- OVERLAYS ----------
const CHAT = () => [[T.join, 'Система', 'МАМА присоединилась к игре', '#ffd21a'], [T.chat[0], 'МАМА', 'КУШАТЬ.', '#ffffff'], [T.chat[1], 'МАМА', 'КУШАТЬ.', '#ffffff'], [T.chat[2], 'МАМА', 'Я ВИЖУ, ЧТО ТЫ ОНЛАЙН.', '#ffffff'], [T.killer, 'xX_Killer_Xx', 'ой… мне тоже пора кушать', '#ffffff'], [T.logout, 'Система', 'xX_Killer_Xx вышел из игры', '#ffd21a']];
function gameHUD(t) {
  ctx.save(); ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; rr(ctx, W / 2 - 260, 120, 520, 96, 24); ctx.fill(); ctx.fillStyle = '#ffd21a'; ctx.font = '900 54px Inter'; ctx.textAlign = 'center'; ctx.fillText('ФИНАЛ ТУРНИРА', W / 2, 170);
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(0,0,0,0.55)'; rr(ctx, 60, 1590, 420, 70, 20); ctx.fill(); ctx.fillStyle = '#3a0d0d'; rr(ctx, 80, 1605, 300, 40, 12); ctx.fill(); ctx.fillStyle = '#ff3b3b'; rr(ctx, 80, 1605, 18 + 6 * Math.abs(Math.sin(t * 6)), 40, 12); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '900 38px Inter'; ctx.fillText('1 HP', 395, 1626);
  const msgs = CHAT().filter(m => t > m[0]).slice(-4); if (msgs.length || t > T.type) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; rr(ctx, 50, 1150, 900, 60 + msgs.length * 58 + (t > T.type ? 66 : 0), 18); ctx.fill(); }
  msgs.forEach((m, i) => { ctx.font = '800 36px Inter'; ctx.fillStyle = m[1] === 'Система' ? '#ffd21a' : m[1] === 'МАМА' ? '#ff8fc8' : '#ff6a6a'; ctx.fillText(m[1] + ':', 75, 1190 + i * 58); const w = ctx.measureText(m[1] + ': ').width; ctx.fillStyle = m[3]; ctx.fillText(m[2], 75 + w, 1190 + i * 58); });
  if (t > T.type) { const cmd = '/ban МАМА'; const n = Math.min(cmd.length, Math.floor((t - T.type) * 12)); ctx.fillStyle = '#7fd3ff'; ctx.font = '900 40px monospace'; ctx.fillText('> ' + cmd.slice(0, n) + (Math.floor(t * 4) % 2 ? '|' : ''), 75, 1190 + msgs.length * 58 + 6); }
  if (t > T.banned && t < T.banned + 2.2) { const k = easeOut(seg(t, T.banned, T.banned + 0.15)); ctx.globalAlpha = k; ctx.fillStyle = 'rgba(200,0,0,0.92)'; rr(ctx, 90, 700, W - 180, 190, 30); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '900 66px Inter'; ctx.fillText('МАМА ЗАБАНЕНА', W / 2, 770); ctx.font = '700 38px Inter'; ctx.fillText('игрок удалён с сервера', W / 2, 840); }
  ctx.restore();
}
function overlay(t, shot, vt = t) {
  if (shot.game) gameHUD(vt);
  if (shot.id === 'RW') { ctx.save(); ctx.fillStyle = 'rgba(20,0,40,0.35)'; ctx.fillRect(0, 0, W, H); for (let y = (t * 2400) % 40; y < H; y += 40) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, y, W, 6); } ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 96px Inter'; ctx.lineWidth = 18; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000'; ctx.strokeText('◀◀ 10 МИНУТ', W / 2, 820); ctx.fillStyle = '#fff'; ctx.fillText('◀◀ 10 МИНУТ', W / 2, 820); ctx.strokeText('НАЗАД', W / 2, 930); ctx.fillStyle = '#ffd21a'; ctx.fillText('НАЗАД', W / 2, 930); ctx.restore(); }
  if (t < T.rw0) { // the hook line on screen
    const txt = 'СЕГОДНЯ Я ЗАБАНИЛ', txt2 = 'СОБСТВЕННУЮ МАМУ.'; const k = 1;
    ctx.save(); ctx.globalAlpha = k; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.font = '900 78px Inter';
    for (const [s, y, c] of [[txt, 360, '#fff'], [txt2, 455, '#ff4040']]) { ctx.lineWidth = 18; ctx.strokeStyle = '#000'; ctx.strokeText(s, W / 2, y); ctx.fillStyle = c; ctx.fillText(s, W / 2, y); }
    ctx.restore();
  }
  if (shot.id === 'R5') { const cmd = '/ban МАМА'; const n = Math.min(cmd.length, Math.floor((t - T.type) * 12)); ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(0,0,0,0.7)'; rr(ctx, 120, 1250, W - 240, 150, 26); ctx.fill(); ctx.font = '900 92px monospace'; ctx.fillStyle = '#7fd3ff'; ctx.fillText('> ' + cmd.slice(0, n) + (Math.floor(t * 4) % 2 ? '_' : ' '), W / 2, 1325); if (n >= cmd.length) { const e = easeOut(seg(t, T.type + 0.85, T.type + 1.0)); ctx.globalAlpha = e; ctx.fillStyle = '#ff3b3b'; rr(ctx, W / 2 - 170, 1440, 340, 100, 20); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '900 56px Inter'; ctx.fillText('ENTER ⏎', W / 2, 1490); } ctx.restore(); }
  for (const s of SUBS) if (t >= s.t0 && t <= s.t1) drawSub(shot.game && t > T.join ? { ...s, y: 960 } : s, t);
  for (const [at, a] of [[T.ffA, 0.8], [T.ffB, 0.5], [T.join, 0.7], [T.banned, 0.9], [T.pull + 0.3, 0.6], [T.rw0, 0.5]]) { const k = t - at; if (k >= 0 && k < 0.2) { ctx.fillStyle = `rgba(255,255,255,${a * (1 - k / 0.2)})`; ctx.fillRect(0, 0, W, H); } }
}

// ---------- FRAME ----------
function update(t) {
  const fs = fomaState(t); applyPose(foma, fs.pos, fs.rotY, fs.pose); foma.root.position.y = 0.52 - FOMA_L.hip * 0.8 + 0.02; drawFomaMask({ h: fs.eye.h, px: 0, glow: fs.glow });
  if (fs.look && fs.look !== 'camera') lookAtWorld(foma, fs.look, 0.9);
  // real mom: appears in the doorway with the cable
  const mv = t > T.doorOpen + 0.3; mom.root.visible = mv;
  if (mv) { const k = ease(seg(t, T.doorOpen + 0.3, T.doorOpen + 1.3)); applyPose(mom, vlerp(V(0.7, 0, 3.3), V(0.55, 0, 1.4), k), Math.PI, { ...P.idle(t), rsx: -0.9, re: -0.4, lsx: 0.1, lsz: 0.5, le: -1.8 }); drawNPCFace(mom.face.c.getContext('2d'), 'deadpan', speaking('M3', t) ? Math.abs(Math.sin(t * 13)) : 0); mom.face.t.needsUpdate = true; lookAtWorld(mom, fH(), 0.9); }
  doorPiv.rotation.y = t > T.doorOpen ? 1.3 * ease(seg(t, T.doorOpen, T.doorOpen + 1.0)) : 0;
  hallL.intensity = t > T.doorOpen ? 30 * ease(seg(t, T.doorOpen, T.doorOpen + 0.8)) : 0;
  // power: monitor + RGB die when mom pulls the cable
  const power = t < T.pull + 0.3;
  rgbL.intensity = power ? 5 : 0; monL.intensity = power ? 3.2 : 0; momL.intensity = mv ? 4 * ease(seg(t, T.doorOpen + 0.3, T.doorOpen + 1.0)) : 0; screen.visible = power; scene.background.setHex(0x0b0c14);
  // cable from PC tower to the socket, or to mom's hand
  const a = V(1.45, 0.35, -2.55), b = !mv || t < T.pull ? V(2.2, 0.35, -2.95) : mom.hand[0].getWorldPosition(new THREE.Vector3());
  if (mv && t > T.pull - 1.2) { const hb = mom.hand[0].getWorldPosition(new THREE.Vector3()); if (t < T.pull) b.copy(V(2.2, 0.35, -2.95)); else b.copy(vlerp(V(2.2, 0.35, -2.95), hb, easeOut(seg(t, T.pull, T.pull + 0.2)))); }
  const mid = a.clone().lerp(b, 0.5); cable.position.copy(mid); cable.scale.y = a.distanceTo(b); cable.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); plug.position.copy(b);
  if (mv && t < T.pull) { aimArm(mom, 0, V(2.2, 0.4, -2.95), 0); }
  // game arena
  const g = gameState(t);
  applyPose(knight, g.k.p.clone().add(V(GX, 0, 0)), g.k.r, g.k.pose); applyPose(enemy, g.e.p.clone().add(V(GX, 0, 0)), g.e.r, g.e.pose); enemy.root.visible = g.e.vis; tagE.visible = g.e.vis; momAv.root.visible = g.m.vis; applyPose(momAv, g.m.p.clone().add(V(GX, 0, 0)), g.m.r, g.m.pose);
  for (const [r, mood] of [[knight, 'angry'], [enemy, 'angry'], [momAv, 'deadpan']]) { drawNPCFace(r.face.c.getContext('2d'), mood, 0); r.face.t.needsUpdate = true; }
  tagK.position.copy(headWorld(knight)).add(V(0, 0.75, 0)); tagE.position.copy(headWorld(enemy)).add(V(0, 0.75, 0)); tagM.position.copy(headWorld(momAv)).add(V(0, 0.75, 0)); tagM.visible = g.m.vis;
  const pc = t > T.logout && t < T.logout + 1 && t < T.banned ? V(GX + 1.6, 0.9, 0.3) : V(GX - 0.4, 0.9, 0.6), pt = t < T.banned ? T.logout : T.banned;
  poofs.forEach((p, i) => { const d = t - pt - i * 0.02; if (d < 0 || d > 0.9) { p.visible = false; return; } p.visible = true; const a2 = i / 8 * Math.PI * 2; p.position.set(pc.x + Math.cos(a2) * d * 1.5, pc.y + d * 0.8, pc.z + Math.sin(a2) * d * 1.5); p.scale.setScalar(0.5 + d); p.material.opacity = 1 - d / 0.9; });
  return fs;
}
function renderFrame(f) {
  const t = f / FPS, shot = shotAt(t), vt = shot.vt ? shot.vt(t) : t;
  const fs = update(vt);
  if (shot.game) { const u = (t - shot.t0) / (shot.t1 - shot.t0); setGameCam(vt, W / H, 0.95, shot.gm || 'wide', u); let a = shot.shk || 0.02; if (vt > T.banned && vt < T.banned + 0.35) a = 0.1; for (const b of shot.bump || []) a += 0.08 * Math.max(0, 1 - Math.abs(t - b) / 0.2); gameCam.position.add(shake(a, t, 5)); gameCam.fov *= 1 - punch(t, shot.t0, 0.1, 0.2) - (shot.bump || []).reduce((s2, b) => s2 + punch(t, b, 0.15), 0) - (vt > T.banned ? punch(vt, T.banned, 0.2) : 0); gameCam.updateProjectionMatrix(); renderer.setRenderTarget(null); renderer.render(scene, gameCam); }
  else {
    if (t < T.pull + 0.3) { setGameCam(t, 16 / 9, 1.0); renderer.setRenderTarget(rtGame); renderer.render(scene, gameCam); renderer.setRenderTarget(null); }
    shot.f(t, (t - shot.t0) / (shot.t1 - shot.t0)); if (fs.look === 'camera') lookAtWorld(foma, cam.position, 1);
    renderer.render(scene, cam);
  }
  ctx.drawImage(renderer.domElement, 0, 0, W, H); overlay(t, shot, vt);
  return shot.id;
}
window.renderFrame = renderFrame;
window.grab = (q = 0.93) => out.toDataURL('image/jpeg', q);
window.TOTAL = TOTAL;
window.ready = document.fonts.load('900 60px Inter').then(() => true);
