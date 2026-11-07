
// ======================= NOCT · FOMA — LONG-FORM «УЧИТЕЛЬ НА ДЕНЬ» · TEST PART (hook + morning + lesson 1) =======================
// World: school (corridor x -16..8 z 0..3.6, classroom x -5..6 z -9..0) at origin; GYM at x=+40; ROOM at x=-40.
const B = id => vo('b_' + id);           // named beat
const END = vo('END').t1;
const GX = 40, RX = -40;

// ---------- extra school props ----------
const boardC = document.createElement('canvas'); boardC.width = 1024; boardC.height = 384;
const boardTex = new THREE.CanvasTexture(boardC); boardTex.colorSpace = THREE.SRGBColorSpace;
const myBoard = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.9), M(0xffffff, 0.9, { map: boardTex })); myBoard.position.set(-4.955, 1.75, -4.5); myBoard.rotation.y = Math.PI / 2; world.add(myBoard);
let boardKey = '';
function drawBoard(t) {
  let key = 'q', timer = '';
  if (t > B('teach').t0 + 0.6) key = 'a';
  if (t > vo('D3').t0 + 0.6) { const left = Math.max(0, 300 - Math.floor((t - (vo('D3').t0 + 0.6)) * 1)); timer = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; key = 'k' + timer; }
  if (key === boardKey) return; boardKey = key;
  const g = boardC.getContext('2d'); g.fillStyle = '#20493a'; g.fillRect(0, 0, 1024, 384); g.strokeStyle = '#8a5a2b'; g.lineWidth = 24; g.strokeRect(0, 0, 1024, 384);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  if (key[0] === 'k') { g.font = '900 96px Inter'; g.fillText('КОНТРОЛЬНАЯ', 70, 150); g.fillStyle = '#ffd21a'; g.font = '900 150px Inter'; g.fillText(timer, 360, 320); boardTex.needsUpdate = true; return; }
  g.font = '700 58px Inter'; g.fillText('Тема: МАТЕМАТИКА', 60, 100); g.font = '900 120px Inter'; g.fillText('7 × 8 =', 80, 260);
  if (key === 'a') { g.fillStyle = '#ffd21a'; g.fillText('56', 560, 260); g.font = '700 46px Inter'; g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillText('(объясняет Лиза)', 80, 340); } else { g.fillText('?', 560, 260); }
  boardTex.needsUpdate = true;
}
// alarm button on the corridor wall
const alarmBtn = new THREE.Group(); alarmBtn.position.set(-2.3, 1.35, 0.12); world.add(alarmBtn);
add(alarmBtn, box(0.34, 0.34, 0.04, M(0xf2f2f2, 0.5), 0.02), 0, 0, 0); const alarmCap = add(alarmBtn, cyl(0.1, 0.11, 0.07, M(0xe0302a, 0.35), 20), 0, 0, 0.05); alarmCap.rotation.x = Math.PI / 2;
{ const t = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#e0302a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '900 40px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ТРЕВОГА', w / 2, h / 2 + 2); }); const p = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshBasicMaterial({ map: t })); p.position.set(0, 0.25, 0.03); alarmBtn.add(p); }
// school bell above the class door
const bellG = new THREE.Group(); bellG.position.set(1.9, 2.75, 0.14); world.add(bellG); add(bellG, cyl(0.16, 0.16, 0.08, M(0xd8b13a, 0.3, { metalness: 0.7 }), 20), 0, 0, 0).rotation.x = Math.PI / 2;
// journal (register) + pirozhok + paper plane
const journal = new THREE.Group(); world.add(journal); add(journal, box(0.34, 0.05, 0.46, M(0x1f4fa8, 0.6), 0.02), 0, 0, 0); add(journal, box(0.32, 0.01, 0.42, M(0xffffff, 0.8), 0), 0, 0.03, 0);
const pirozhok = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), M(0xc98a3c, 0.6)); pirozhok.scale.set(1.5, 0.75, 1); world.add(pirozhok);
const plane = new THREE.Group(); world.add(plane);
{ const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.28, -0.16, 0.02, -0.1, 0, -0.02, -0.1, 0, 0, 0.28, 0, -0.02, -0.1, 0.16, 0.02, -0.1], 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide })); m.castShadow = true; plane.add(m); }

// ---------- GYM (hook) ----------
const gym = new THREE.Group(); gym.position.set(GX, 0, 0); scene.add(gym);
const gymBalls = [];
{
  const gf = canvasTex(512, 512, (g, w, h) => { const r = rng(9); for (let y = 0; y < 16; y++) { g.fillStyle = `hsl(35,55%,${58 + r() * 6}%)`; g.fillRect(0, y * 32, w, 32); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y * 32, w, 2); } g.strokeStyle = '#e0302a'; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h / 2, 80, 0, 7); g.stroke(); g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke(); }, [1, 1]);
  add(gym, box(18, 0.06, 13, M(0xffffff, 0.45, { map: gf }), 0), 0, -0.03, 0);
  const gw = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#dfe8f2'; g.fillRect(0, 0, w, h); g.fillStyle = '#2f80ed'; g.fillRect(0, 150, w, 106); g.fillStyle = '#ffffff'; g.fillRect(0, 146, w, 6); }, [6, 1]);
  const mg = M(0xffffff, 0.9, { map: gw });
  const gb = (x0, x1, y0, y1, z0, z1, m) => add(gym, box(x1 - x0, y1 - y0, z1 - z0, m, 0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  gb(-9.2, -9, 0, 6, -6.5, 6.5, mg); gb(9, 9.2, 0, 6, -6.5, 6.5, mg); gb(-9, 9, 0, 6, 6.5, 6.7, mg); gb(-9, -0.8, 0, 6, -6.7, -6.5, mg); gb(0.8, 9, 0, 6, -6.7, -6.5, mg); gb(-0.8, 0.8, 2.4, 6, -6.7, -6.5, mg);
  add(gym, box(18, 0.1, 13, M(0xeef2f6, 0.8), 0), 0, 6.05, 0);
  for (const x of [-6, -2, 2, 6]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.2), new THREE.MeshBasicMaterial({ color: 0xcfeaff })); w.position.set(x, 4.6, 6.49); w.rotation.y = Math.PI; gym.add(w); }
  for (const s of [-1, 1]) { const hp = new THREE.Group(); hp.position.set(s * 8.6, 0, 0); gym.add(hp); add(hp, box(0.12, 3.6, 0.12, M(0x555555, 0.4), 0.02), 0, 1.8, 0); add(hp, box(0.08, 1.1, 1.6, M(0xffffff, 0.4), 0.02), -s * 0.2, 3.4, 0); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.025, 8, 24), M(0xff5a00, 0.4)); ring.rotation.x = Math.PI / 2; ring.position.set(-s * 0.55, 3.05, 0); hp.add(ring); }
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffffff, 18, 14, 1.4); l.position.set(-6 + i * 4, 5.6, 0); gym.add(l); }
  const ballM = M(0xff6a1a, 0.55);
  for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12), ballM); b.castShadow = true; gym.add(b); gymBalls.push(b); }
  const gs = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#1e3a5f'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '900 72px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('СПОРТЗАЛ', w / 2, h / 2 + 4); }) })); gs.position.set(0, 2.75, -6.48); gym.add(gs);
}
const camBall = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), M(0xff6a1a, 0.5)); scene.add(camBall);

// ---------- FOMA'S ROOM (morning) ----------
const room = new THREE.Group(); room.position.set(RX, 0, 0); scene.add(room);
const roomDoor = new THREE.Group(); const clockG = new THREE.Group(); const tieChair = new THREE.Group(); const thermo = new THREE.Group();
{
  const wT = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#2b2f45'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.05)'; for (let x = 0; x < w; x += 24) g.fillRect(x, 0, 10, h); }, [4, 1]);
  const mR = M(0xffffff, 0.9, { map: wT });
  const rb = (x0, x1, y0, y1, z0, z1, m) => add(room, box(x1 - x0, y1 - y0, z1 - z0, m, 0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  add(room, box(6.4, 0.06, 6.4, M(0x6b4a33, 0.8), 0), 0, -0.03, 0); add(room, box(6.4, 0.06, 6.4, M(0x1d1f2a, 0.9), 0), 0, 2.83, 0);
  rb(-3.2, -3, 0, 2.8, -3, 3, mR); rb(-3, 3, 0, 2.8, -3.2, -3, mR); rb(-3, 3, 0, 2.8, 3, 3.2, mR);
  rb(3, 3.2, 0, 2.8, -3, 0.0, mR); rb(3, 3.2, 0, 2.8, 1.0, 3, mR); rb(3, 3.2, 2.2, 2.8, 0, 1.0, mR);   // east wall with door gap z 0..1
  const hall = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.4), new THREE.MeshBasicMaterial({ color: 0xffd9a0 })); hall.position.set(3.5, 1.1, 0.5); hall.rotation.y = -Math.PI / 2; room.add(hall);
  roomDoor.position.set(3.0, 0, 0.0); room.add(roomDoor); add(roomDoor, box(0.06, 2.2, 1.0, M(0x5a3a22, 0.6), 0.02), 0, 1.1, 0.5); add(roomDoor, box(0.1, 0.04, 0.14, M(0xcccccc, 0.3, { metalness: 0.8 }), 0.01), -0.06, 1.0, 0.85);
  // window with morning light
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), new THREE.MeshBasicMaterial({ color: 0xffe7b0 })); win.position.set(-1.0, 1.7, -2.98); room.add(win);
  // bed
  add(room, box(1.3, 0.45, 2.3, M(0x2d3a6a, 0.9), 0.06), -2.0, 0.22, 0.6); add(room, box(1.2, 0.12, 0.5, M(0xe8e8f0, 0.9), 0.06), -2.0, 0.5, -0.3);
  // nightstand + alarm clock
  add(room, box(0.5, 0.55, 0.45, M(0x4a3426, 0.7), 0.03), -2.0, 0.27, -0.95); clockG.position.set(-2.0, 0.66, -0.95); room.add(clockG);
  add(clockG, cyl(0.12, 0.12, 0.08, M(0xe0302a, 0.4), 20), 0, 0.1, 0).rotation.x = Math.PI / 2;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.fillStyle = '#111'; g.font = '900 34px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('7:00', 64, 66); }) })); face.position.set(0, 0.1, 0.045); clockG.add(face);
  for (const s of [-1, 1]) add(clockG, new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), M(0xd8b13a, 0.3, { metalness: 0.7 })), s * 0.08, 0.22, 0);
  // desk + chair with a tie and a note from mom
  add(room, box(1.6, 0.06, 0.7, M(0x15161c, 0.4), 0.02), 1.2, 0.76, -2.55); for (const x of [0.5, 1.9]) add(room, box(0.06, 0.74, 0.6, M(0x15161c, 0.4), 0.01), x, 0.37, -2.55);
  tieChair.position.set(1.2, 0, -1.7); room.add(tieChair); add(tieChair, box(0.55, 0.08, 0.55, M(0x1b1c22, 0.6), 0.03), 0, 0.48, 0); add(tieChair, box(0.55, 0.7, 0.08, M(0xe0302a, 0.6), 0.03), 0, 0.88, -0.25); add(tieChair, box(0.06, 0.48, 0.06, M(0x333333, 0.4), 0.01), 0, 0.24, 0);
  const tie = new THREE.Group(); tie.position.set(0, 0.9, -0.2); tieChair.add(tie); add(tie, box(0.07, 0.06, 0.02, M(0x1f4fa8, 0.5), 0.01), 0, 0.05, 0); add(tie, box(0.1, 0.42, 0.02, M(0x1f4fa8, 0.5), 0.01), 0, -0.2, 0);
  const note = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), new THREE.MeshStandardMaterial({ map: canvasTex(340, 240, (g, w, h) => { g.fillStyle = '#fff59d'; g.fillRect(0, 0, w, h); g.fillStyle = '#c0392b'; g.font = '700 40px Inter'; g.textAlign = 'center'; g.fillText('Для учителя', w / 2, 80); g.fillText('❤ Мама', w / 2, 150); }) }));
  note.position.set(0.0, 0.53, 0.05); note.rotation.x = -Math.PI / 2 + 0.25; tieChair.add(note);
  add(room, box(1.0, 0.6, 0.05, M(0x0d0e12, 0.3), 0.02), 1.2, 1.15, -2.85);
  // thermometer (held by Foma)
  add(thermo, cyl(0.012, 0.012, 0.16, M(0xffffff, 0.2), 8), 0, 0, 0); add(thermo, new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), M(0xe0302a, 0.3)), 0, -0.08, 0); scene.add(thermo);
  const l1 = new THREE.PointLight(0xffe2b0, 6, 7, 1.5); l1.position.set(-1.0, 2.0, -2.0); room.add(l1); const l2 = new THREE.PointLight(0x9aa8ff, 3, 7, 1.5); l2.position.set(1.5, 2.4, 1.5); room.add(l2);
  const l3 = new THREE.PointLight(0xffc98a, 4, 4, 1.6); l3.position.set(2.6, 1.6, 0.5); room.add(l3);
}
const blanket = box(0.95, 0.55, 0.85, M(0x3b4c8a, 0.95), 0.18); scene.add(blanket);

// ---------- CAST ----------
const kid = (o) => npc({ scale: 0.72, skin: o.skin, shirt: o.shirt, pants: o.pants, extra: o.extra });
const tim = kid({ skin: 0xf2c94c, shirt: 0xe0302a, pants: 0x2b2f3a, extra(r) { add(r.neck, box(0.47, 0.12, 0.47, M(0x111111, 0.7), 0.04), 0, 0.47, -0.01); add(r.neck, box(0.5, 0.1, 0.5, M(0x1b1c22, 0.5), 0.03), 0, 0.53, 0); add(r.neck, box(0.42, 0.04, 0.26, M(0x1b1c22, 0.5), 0.02), 0, 0.5, -0.32); } });
const lisa = kid({ skin: 0xffd9a8, shirt: 0x7c4dff, pants: 0x3a3a46, extra(r) {
  const hm = M(0x6b3a1e, 0.7); add(r.neck, box(0.48, 0.14, 0.48, hm, 0.05), 0, 0.47, -0.01); add(r.neck, box(0.48, 0.3, 0.12, hm, 0.04), 0, 0.34, -0.2);
  for (const s of [-1, 1]) { add(r.neck, box(0.1, 0.36, 0.1, hm, 0.04), s * 0.27, 0.08, -0.05); add(r.neck, box(0.12, 0.05, 0.12, M(0xff4fa3, 0.5), 0.02), s * 0.27, -0.08, -0.05); }
  const gl = M(0x111111, 0.3); for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 16), gl); f.position.set(s * 0.09, 0.27, 0.235); r.neck.add(f); } add(r.neck, box(0.06, 0.012, 0.012, gl, 0), 0, 0.28, 0.235); } });
const kesha = kid({ skin: 0xf2c94c, shirt: 0xffd23a, pants: 0x2f80ed, extra(r) { add(r.neck, box(0.47, 0.1, 0.47, M(0xe8c25a, 0.7), 0.04), 0, 0.47, -0.01); add(r.chest, box(0.72, 0.42, 0.42, M(0xffd23a, 0.7), 0.12), 0, 0.22, 0.04); } });
const extrasK = [{ skin: 0xc68a5a, shirt: 0x27ae60, pants: 0x3a3a46, hair: 0x3b2a1e }, { skin: 0xffd9a8, shirt: 0xff8fc8, pants: 0x2b4f8a, hair: 0xf5d76e }, { skin: 0x8d5a3b, shirt: 0x2f80ed, pants: 0x2b2f3a, hair: 0x111111 }]
  .map(o => kid({ ...o, extra(r) { add(r.neck, box(0.47, 0.13, 0.47, M(o.hair, 0.7), 0.04), 0, 0.48, -0.01); } }));
const KIDS = [tim, lisa, kesha, ...extrasK];
const SEAT = DESKS.map(([x, z]) => V(x + 0.55, 0, z));
const KID_SEAT_Y = 0.5 - 0.86 * 0.72;
const oleg = teacher, dir = principal;
// Foma's badge
const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.12), new THREE.MeshStandardMaterial({ map: canvasTex(264, 144, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f4fa8'; g.fillRect(0, 0, w, 34); g.fillStyle = '#fff'; g.font = '800 24px Inter'; g.textAlign = 'center'; g.fillText('ШКОЛА №7', w / 2, 25); g.fillStyle = '#111'; g.font = '900 30px Inter'; g.fillText('ФОМА', w / 2, 76); g.font = '800 24px Inter'; g.fillText('ИВАНОВИЧ', w / 2, 108); g.fillStyle = '#c0392b'; g.font = '700 18px Inter'; g.fillText('учитель всего', w / 2, 134); }), roughness: 0.5 }));
badge.position.set(-0.17, 0.46, 0.215); foma.chest.add(badge);

// ---------- STAGE DIRECTION ----------
const inGym = t => t < B('room').t0, inRoom = t => t >= B('room').t0 && t < B('hall').t0, inHall = t => t >= B('hall').t0 && t < B('class').t0;
const FOMA_HALL = V(-3.2, 0, 1.8), OLEG_HALL = V(-4.35, 0, 1.75), FOMA_FRONT = V(-3.4, 0, -4.4), FOMA_LISA = V(-0.75, 0, -3.62);
const sp = id => speaking(id, T_);
let T_ = 0; // time currently being evaluated (for speaking())
function fomaPose(t) {
  T_ = t; let pos, rotY, pose = P.idle(t), eye = 0.85, glow = 0.7, look = null, sit = false;
  if (inGym(t)) {
    pos = V(GX, 0, 0.3); rotY = 0; eye = 0.6; glow = 1.0; look = 'cam';
    if (t > vo('H3').t0) eye = 0.5;
    if (t > B('montage').t1) { pose = { ...P.idle(t), lsx: -0.4, rsx: -2.2, rsz: -0.3, re: -0.6 }; eye = 1.25; look = null; }
    if (sp('H1') || sp('H2')) pose = P.talk(t);
  } else if (inRoom(t)) {
    pos = V(RX - 2.0, 0, 0.75); rotY = Math.PI / 2; sit = true; pose = { ...P.sit(), lean: -0.05, lsx: -0.9, rsx: -1.1, le: -1.4, re: -1.2, lsz: 0.25, rsz: -0.25 }; eye = 0.55; glow = 0.55;
    if (sp('S1') || sp('S3')) { pose = { ...pose, rsx: -1.7, re: -1.9 }; eye = 0.7; }
    if (sp('M2')) { pose = { ...pose, hz: 0.2 }; eye = 0.45; }
    if (t >= B('logic').t0 && t < vo('M4').t1 + 0.3) { eye = 0.42; pose = { ...pose, hz: 0 }; look = 'cam'; }
    if (t >= B('tie').t0) { eye = 1.35; glow = 1.0; pose = { ...pose, lean: -0.15 }; look = V(RX + 1.2, 0.6, -1.7); }
  } else if (inHall(t)) {
    pos = FOMA_HALL.clone(); rotY = -Math.PI / 2; eye = 0.85;
    if (t < vo('O1').t1) { pose = P.walk(t * 7); pos.x += (vo('O1').t1 - t) * 0.6; }
    if (sp('F5')) { pose = { ...P.confused(t) }; look = V(-3.0, 0.9, 1.8); eye = 1.0; }
    if (sp('F6')) { pose = P.shock(t); eye = 1.4; glow = 1.0; }
    if (sp('F7')) { pose = { ...P.idle(t), rsx: -0.6, re: -1.6, lsz: 0.3 }; eye = 0.55; }
    if (t >= B('risk1').t0 && t < B('risk1').t1) { eye = 0.5; }
    if (sp('F8')) { pose = { ...P.idle(t), lean: 0.12 }; eye = 1.15; }
    if (t >= B('freeze1').t0 && t < B('freeze1').t1) { pose = { ...P.idle(0), lsz: 0.08, rsz: -0.08 }; eye = lerp(0.9, 1.45, seg(t, B('freeze1').t0, B('freeze1').t0 + 0.3)); glow = 1.0; }
    if (t >= vo('F15').t0 && t < B('bell').t0) { look = alarmBtn.position.clone(); rotY = Math.PI; pose = { ...P.idle(t), rsx: -1.45, rsz: -0.25, re: -0.2 }; }
    if (t >= vo('O6').t0 && t < B('bell').t0) { pose = { ...P.shock(t) }; eye = 1.3; }
    if (t >= B('bell').t0) { pose = P.walk(t * 7); pos.x += (t - B('bell').t0) * 1.2; rotY = Math.PI / 2; }
  } else {
    pos = FOMA_FRONT.clone(); rotY = Math.PI / 2;
    if (t < B('door').t1) { pos = V(0.7, 0, lerp(0.2, -1.0, seg(t, B('door').t0, B('door').t1))); rotY = Math.PI; pose = P.walk(t * 7); }
    else if (t < vo('F16').t0) { pos = V(0.2, 0, -1.4); rotY = -2.53; }
    if (sp('F9')) { pose = { ...P.idle(t), rsx: -0.5, re: -1.2 }; eye = 0.45; look = headWorld(tim); }
    if (t >= vo('F16').t0 && t < vo('F10').t0) { pose = { ...P.idle(t), lsx: -1.2, le: -1.3, lsz: 0.1, rsx: -1.2, re: -1.3, rsz: -0.1 }; eye = 0.6; }
    if (t >= vo('F19').t0 && t < B('laugh').t1) { eye = lerp(0.6, 1.45, seg(t, vo('F19').t0 + 0.3, vo('F19').t0 + 0.6)); glow = 1.0; }
    if (sp('F20')) { pose = P.shock(t); eye = 1.3; }
    if (sp('F10')) { pose = P.point(); look = myBoard.position.clone(); }
    if (t >= B('p56').t0 && t < vo('F11').t1) { eye = 0.42; look = headWorld(lisa); }
    if (t >= vo('F11').t1 && t < B('teach').t0) { const k = seg(t, vo('F11').t1, vo('F11').t1 + 0.9); pos = vlerp(FOMA_FRONT, FOMA_LISA, ease(k)); rotY = lerp(Math.PI / 2, Math.PI, k); if (k < 1) pose = P.walk(t * 7); else pose = { ...P.idle(t), lean: 0.3 }; look = headWorld(lisa); eye = 0.7; }
    if (sp('F12')) { pose = { ...P.idle(t), lean: 0.32 }; eye = 1.2; }
    if (t >= B('deal').t0 && t < vo('F13').t0) { eye = 0.4; }
    if (sp('F13')) { pose = { ...P.point(), lean: 0.1 }; }
    if (t >= B('teach').t0) { pos = SEAT[1].clone(); rotY = -Math.PI / 2; sit = true; pose = { ...P.sit(), lsx: -1.0, le: -1.5, rsx: -0.6, re: -0.8 }; eye = 0.55; look = myBoard.position.clone(); }
    if (sp('F21') || sp('K2')) { look = 'cam'; eye = 0.42; }
    if (t >= B('plane').t0 + 1.2) { look = V(0.7, 1.6, -0.4); eye = 1.0; }
    if (t >= B('hit').t0) { eye = 1.4; glow = 1.0; }
    if (t >= vo('F14').t0) { pos = V(-0.2, 0, -3.6); rotY = 0.23; sit = false; pose = P.talk(t); eye = 0.7; look = headWorld(dir); }
    if (t >= vo('D3').t1) { pose = P.idle(t); eye = 1.3; }
    if (sp('F22')) { look = 'cam'; eye = 0.5; pose = { ...P.idle(t), lean: 0.08 }; }
  }
  return { pos, rotY, pose, eye, glow, look, sit };
}

function kidPose(i, t) {
  const r = KIDS[i]; const seat = SEAT[i];
  let pos = seat.clone(), rotY = -Math.PI / 2, pose = { ...P.sit(), lsx: -0.6, rsx: -0.6, le: -0.8, re: -0.8 }, mood = 'smile', talk = 0, look = null, sitting = true;
  if (inGym(t)) { // chaos in the gym
    sitting = false; const a = i * 1.3 + (t > B('montage').t1 ? t * 1.6 : 0.7); pos = V(GX + Math.cos(a) * (3 + i * 0.5), 0, Math.sin(a) * 2.6 - 0.5); rotY = -a + (i % 2 ? Math.PI : 0); pose = t > B('montage').t1 ? P.run(t * 11 + i) : P.run(1 + i); mood = i % 2 ? 'scream' : 'smile';
    return { pos, rotY, pose, mood, talk, look, sitting };
  }
  if (t >= B('door').t0 && t < B('door').t1 + 0.4) look = V(0.7, 1.4, -0.8);
  if (r === tim) {
    mood = 'smug';
    if (sp('T1') || sp('T2') || sp('T6') || sp('T3') || sp('T4')) { talk = 1; mood = 'talk'; }
    if (sp('T1')) pose = { ...pose, rsx: -1.9, re: -0.2 };
    if (sp('T6')) { sitting = false; pose = { ...P.point(), rsx: -2.2 }; mood = 'smile'; }
    if (t >= B('laugh').t0 && t < B('laugh').t1) mood = 'smile';
    if (t >= B('plane').t0 && t < B('plane').t0 + 0.6) { pose = { ...pose, rsx: -2.6, re: -0.3 }; }
    if (t >= B('plane').t0 + 0.6 && t < B('plane').t0 + 0.9) { pose = { ...pose, rsx: -1.2, re: 0 }; }
    if (t >= B('hit').t0) { mood = 'surprised'; pose = { ...pose, lsx: -2.4, le: -0.4 }; }
  }
  if (r === lisa) {
    mood = 'deadpan';
    if (sp('L1')) { pose = { ...pose, rsx: -2.9, re: -0.1 }; talk = 1; mood = 'talk'; }
    if (sp('L4')) { talk = 1; mood = 'talk'; }
    if (sp('L2') || sp('L3')) { talk = 0.5; mood = 'smug'; look = fH(); pose = { ...pose, lean: 0.25 }; }
    if (t >= B('deal').t0 && t < B('teach').t0) mood = 'smug';
    if (t >= B('teach').t0 && t < vo('D2').t0) { sitting = false; pos = V(-4.1, 0, -4.2 + 0.25 * Math.sin(t * 1.3)); rotY = -Math.PI / 2; pose = { ...P.idle(t), rsx: -2.6 + 0.2 * Math.sin(t * 6), re: -0.3 }; mood = 'talk'; talk = t < B('teach').t1 ? 1 : 0; }
    if (t >= vo('D2').t0) { sitting = false; pos = V(-3.9, 0, -4.6); rotY = Math.PI / 2; pose = P.idle(t); mood = 'surprised'; }
  }
  if (r === kesha) {
    mood = 'smile';
    if (sp('K1') || sp('K3')) { talk = 1; mood = 'talk'; }
    if (sp('K2')) { talk = 1; mood = 'angry'; pose = { ...pose, rsx: -1.6, re: -0.3 }; }
    if (t >= vo('K2').t1) mood = 'deadpan';
  }
  if (t >= B('laugh').t0 && t < B('laugh').t1 && r !== lisa) { mood = 'smile'; pose = { ...pose, lean: -0.2 + 0.1 * Math.sin(t * 25), py: 0.03 * Math.abs(Math.sin(t * 20)) }; talk = Math.abs(Math.sin(t * 18)); }
  if (t >= B('teach').t0 + 0.5 && t < B('plane').t0 && r !== lisa && r !== tim) { look = myBoard.position.clone(); mood = 'smile'; }
  if (t >= B('hit').t0 && r !== tim) { mood = 'surprised'; look = V(0.7, 1.7, -0.4); }
  if (r === lisa && t >= B('teach').t0) look = null;
  return { pos, rotY, pose, mood, talk, look, sitting };
}

function adultState(t) {
  T_ = t;
  const o = { pos: V(0, -50, 0), rotY: 0, pose: P.idle(t), mood: 'smile', talk: 0, look: null, vis: false };
  const d = { pos: V(0, -50, 0), rotY: 0, pose: P.idle(t), mood: 'angry', talk: 0, look: null, vis: false };
  if (inGym(t)) { d.vis = true; d.pos = V(GX, 0, -6.2); d.rotY = 0; d.mood = 'angry'; d.pose = t > B('montage').t1 ? { ...P.scream(t) } : P.crossed(t); if (sp('H5')) { d.talk = 1; d.mood = 'scream'; } }
  if (inHall(t)) {
    o.vis = true; o.pos = OLEG_HALL.clone(); o.rotY = Math.PI / 2; o.mood = 'smile';
    if (t < vo('O1').t1) { const k = seg(t, B('hall').t0, vo('O1').t1); o.pos = vlerp(V(-10, 0, 1.75), OLEG_HALL, k); o.pose = P.run(t * 11); }
    if (sp('O1') || sp('O2') || sp('O4') || sp('O5') || sp('O6')) { o.talk = 1; o.mood = 'talk'; if (!(t < vo('O1').t1)) o.pose = P.talk(t); }
    if (t >= B('badge').t0 && t < B('badge').t1) o.pose = { ...P.idle(t), rsx: -1.4, re: -0.6 };
    if (t >= B('risk1').t0 && t < B('risk1').t1) { o.mood = 'deadpan'; o.pose = P.skeptic(t); }
    if (sp('O3')) { o.talk = 0.5; o.mood = 'smug'; o.pose = { ...P.idle(t), lean: 0.3 }; o.pos = OLEG_HALL.clone().add(V(0.35, 0, 0)); }
    if (sp('O4')) { o.mood = 'smile'; o.pose = { ...P.talk(t), rsx: -2.4 }; }
    if (sp('O5')) { o.pose = { ...P.point(), rsx: -1.4 }; o.rotY = Math.PI * 0.85; }
    if (sp('O6')) { o.mood = 'scream'; o.pose = { ...P.scream(t) }; o.rotY = Math.PI * 0.6; }
    o.look = sp('O5') ? alarmBtn.position.clone() : fH();
  }
  if (t >= vo('D1').t0 - 0.05 && t < vo('D1').t1 + 0.1) { d.vis = true; const k = seg(t, vo('D1').t0, vo('D1').t1 + 0.1); d.pos = vlerp(V(-7, 0, 1.75), V(-3.2, 0, 1.75), k); d.rotY = Math.PI / 2; d.pose = P.walk(t * 6); d.mood = sp('D1') ? 'talk' : 'deadpan'; d.talk = sp('D1') ? 0.6 : 0; }
  if (t >= B('plane').t0 + 1.0) { d.vis = true; const k = seg(t, B('plane').t0 + 1.0, B('plane').t0 + 1.8); d.pos = vlerp(V(0.7, 0, 0.8), V(0.7, 0, -0.45), k); d.rotY = Math.PI; d.pose = k < 1 ? P.walk(t * 6) : P.idle(t); d.mood = 'deadpan'; d.look = null;
    if (t >= B('hit').t0) { d.pose = { ...P.idle(t), lean: -0.15 * Math.exp(-(t - B('hit').t0) * 4) }; d.mood = 'deadpan'; }
    if (sp('D2') || sp('D3')) { d.talk = 0.6; d.mood = 'angry'; }
    if (t >= vo('D2').t0) { d.pos = V(0.4, 0, -1.0); d.rotY = Math.PI * 1.2; d.look = fH(); }
  }
  return { o, d };
}

// ---------- CAMERAS / SHOTS ----------
function setCam(pos, target, fov = 40, roll = 0) { cam.position.copy(pos); cam.up.set(0, 1, 0); cam.lookAt(target); if (roll) cam.rotateZ(roll); cam.fov = fov; cam.updateProjectionMatrix(); }
const shake = (a, t, s = 0) => V(noise1(t * 37, s) * a, noise1(t * 41, s + 3) * a, noise1(t * 29, s + 7) * a * 0.5);
const punch = (t, at, amt = 0.15, dur = 0.25) => t < at ? 0 : amt * Math.exp(-(t - at) / dur * 3) * (t - at < dur * 2 ? 1 : 0);
const fH = () => headWorld(foma), HW = r => headWorld(r);
const fwd = (rig, d = 1) => V(Math.sin(rig.root.rotation.y), 0, Math.cos(rig.root.rotation.y)).multiplyScalar(d);
const rightOf = (rig, d = 1) => V(Math.cos(rig.root.rotation.y), 0, -Math.sin(rig.root.rotation.y)).multiplyScalar(d);
// close-up of a character's face: camera in front of it (+ side offset), slightly below eye line
const CU = (rig, dist = 1.1, side = 0.25, up = -0.05, fov = 36, tgtDy = -0.08) => { const h = HW(rig); setCam(h.clone().add(fwd(rig, dist)).add(rightOf(rig, side)).add(V(0, up, 0)), h.clone().add(V(0, tgtDy, 0)), fov); };
const SH = []; const S = (id, t0, t1, f, extra = {}) => SH.push({ id, t0, t1, f, ...extra });
const L0 = id => vo(id).t0, L1 = id => vo(id).t1;
// hook / gym
S('G_freeze', 0, L1('H2') + 0.06, (t, u) => { setCam(V(GX + 0.35, 1.45, lerp(3.3, 2.7, ease(u))), V(GX, 1.25, 0), 42); });
S('G_dir', L1('H2') + 0.06, B('montage').t0, (t, u) => { const h = HW(dir); setCam(h.clone().add(V(0.4, -0.1, lerp(2.6, 2.1, u))), h.clone().add(V(0, -0.15, 0)), 34); });
const MT = [['b_hit', 0.12, 'C_hit'], ['b_namefreeze', 0.3, 'C_F19'], ['L2', 0.4, 'C_L2'], ['b_risk5', 0.2, 'C_risk5']];
MT.forEach(([id, off, shot], i) => S('MT' + i, B('montage').t0 + i * 0.4, B('montage').t0 + (i + 1) * 0.4, null, { ref: shot, vt: t => vo(id.startsWith('b_') ? id : id).t0 + off + (t - (B('montage').t0 + i * 0.4)) * 0.5, flash: true }));
S('G_chaos', B('montage').t1, L0('H5'), (t, u) => { setCam(V(GX - 4.5, 2.2, 5.2).add(shake(0.05, t)), V(GX, 1.0, 0), lerp(48, 42, u)); });
S('G_roar', L0('H5'), B('rewind').t0, (t, u) => { const h = HW(dir); setCam(h.clone().add(V(0.2, -0.1, 1.6)).add(shake(0.04, t, 2)), h.clone().add(V(0, -0.1, 0)), 34 * (1 - punch(t, L0('H5') + 0.05, 0.25))); });
S('G_rewind', B('rewind').t0, B('room').t0, null, { ref: 'G_chaos', vt: t => lerp(L0('H5'), B('montage').t1, seg(t, B('rewind').t0, B('room').t0)), rewind: true });
// room
const RF = () => V(RX - 2.0, 0, 0.75);
S('R_alarm', B('room').t0, L0('M1') + 0.4, (t, u) => { setCam(V(RX - 1.55, 0.95, -0.45).add(shake(0.006, t)), V(RX - 2.0, 0.78, -0.95), 34); });
S('R_wide', L0('M1') + 0.4, L0('S1'), (t, u) => { setCam(V(RX + 1.4, 1.7, 2.6), V(RX - 1.0, 0.9, 0.2), lerp(46, 42, u)); });
S('R_S1', L0('S1'), L1('S1') + 0.05, (t) => CU(foma, 1.2, 0.3));
S('R_S2', L1('S1') + 0.05, L1('S2') + 0.08, (t, u) => { setCam(V(RX + 0.9, 1.4, 1.6).add(shake(0.012 * (1 - u), t)), V(RX + 3.0, 1.2, 0.5), 40 * (1 - punch(t, L0('S2'), 0.1))); });
S('R_S3', L1('S2') + 0.08, L1('S3') + 0.1, (t) => CU(foma, 1.0, -0.2));
S('R_M1b', L1('S3') + 0.1, L1('M1b') + 0.05, (t, u) => { setCam(V(RX + 1.2, 1.35, 1.1).add(shake(0.02, t, 4)), V(RX + 3.0, 1.1, 0.5), 38 * (1 - punch(t, L0('M1b'), 0.15))); });
S('R_M2', L1('M1b') + 0.05, L1('M2') + 0.05, (t) => CU(foma, 1.3, 0.35));
S('R_M3', L1('M2') + 0.05, L1('M3') + 0.03, (t, u) => { setCam(V(RX + 1.5, 1.3, 0.9).add(shake(0.015, t, 6)), V(RX + 3.0, 1.15, 0.5), 36 * (1 - punch(t, L0('M3') + 0.4, 0.12))); });
S('R_logic', L1('M3') + 0.03, L1('M4') + 0.15, (t, u) => { const h = fH(); setCam(h.clone().add(V(1.15, -0.05, 0.05)), h.clone().add(V(0, -0.1, 0)), lerp(34, 30, seg(t, L0('M4'), L1('M4')))); });
S('R_tie', B('tie').t0, L0('S4'), (t, u) => { setCam(V(RX + 1.2, 1.25, lerp(-0.85, -1.05, u)), V(RX + 1.2, 0.6, -1.75), 34); });
S('R_S4', L0('S4'), B('whoosh').t0, (t) => { const h = fH(); setCam(h.clone().add(V(0.95, -0.05, -0.35)), h.clone().add(V(0, -0.1, 0)), 34 * (1 - punch(t, L0('S4') + 0.1, 0.18))); });
S('R_whoosh', B('whoosh').t0, B('hall').t0, (t, u) => { const h = fH(); setCam(h.clone().add(V(0.95, -0.05, -0.35)), h.clone().add(V(0, -0.1, 3 * u * u)), 34); }, { blur: true });
// hall
S('H_run', B('hall').t0, L1('O1') + 0.05, (t, u) => { setCam(V(-1.4, 1.55, 2.6), V(-6, 1.2, 1.75), 44); });
S('H_badge', L1('O1') + 0.05, B('badge').t1, (t) => { const h = fH(); setCam(h.clone().add(V(-0.75, -0.3, 0.1)), h.clone().add(V(0, -0.45, 0)), 30); }, { badge: true });
S('H_F5', B('badge').t1, L1('F5') + 0.05, (t) => setCam(V(-4.2, 1.2, 2.35), fH().add(V(0, -0.12, 0)), 34));
S('H_O2', L1('F5') + 0.05, L1('O2') + 0.05, (t) => setCam(V(-3.4, 1.5, 2.6), HW(oleg).add(V(0, -0.1, 0)), 36));
S('H_F6', L1('O2') + 0.05, L1('F7') + 0.05, (t) => { CU(foma, lerp(1.05, 0.85, seg(t, L0('F7'), L1('F7'))), 0.2); });
S('H_risk1', L1('F7') + 0.05, B('risk1').t1, (t) => { setCam(V(-3.75, 1.5, 3.3), V(-3.75, 1.25, 1.75), 40); });
S('H_O3', B('risk1').t1, L1('O3') + 0.05, (t, u) => { setCam(V(lerp(-3.3, -3.45, u), 1.45, 2.6), HW(oleg).add(V(0, -0.08, 0)), 36); });
S('H_F8', L1('O3') + 0.05, L1('F8') + 0.05, (t) => CU(foma, 0.95, 0.15, -0.03, 34));
S('H_O4', L1('F8') + 0.05, L1('O4') + 0.03, (t) => setCam(V(-3.4, 1.5, 2.6), HW(oleg).add(V(0, -0.1, 0)), 34));
S('H_freeze', L1('O4') + 0.03, B('freeze1').t1, (t, u) => { CU(foma, lerp(1.3, 0.75, ease(u)), 0.0, -0.03, 34); });
S('H_O5', B('freeze1').t1, L1('O5') + 0.05, (t, u) => { setCam(V(lerp(-4.6, -3.0, u), 1.6, 3.2), V(lerp(-4.0, -2.3, ease(seg(t, L0('O5') + 1.4, L1('O5')))), 1.3, 0.6), 46); });
S('H_F15', L1('O5') + 0.05, L0('O6'), (t, u) => { setCam(V(-2.0, 1.45, 1.4), V(-2.35, 1.35, 0.1), 34); });
S('H_O6', L0('O6'), B('bell').t0, (t) => { const h = HW(oleg); setCam(h.clone().add(V(0.6, -0.1, 1.3)).add(shake(0.03, t)), h.clone().add(V(0, -0.1, 0)), 36 * (1 - punch(t, L0('O6') + 0.05, 0.22))); });
S('H_bell', B('bell').t0, B('class').t0, (t, u) => { setCam(V(1.2, 2.2, 1.6).add(shake(0.006, t)), V(1.9, 2.6, 0.1), 40); });
// class
S('C_door', B('class').t0, L0('T1'), (t, u) => { setCam(V(-3.6, 1.9, -6.8), V(0.3, 1.1, -1.0), lerp(44, 40, u)); });
S('C_T1', L0('T1'), L1('T1') + 0.04, (t) => CU(tim, 1.0, -0.25, 0.0, 36));
S('C_F9', L1('T1') + 0.04, B('risk2').t1, (t, u) => { const p = HW(tim).add(V(0.1, 0.3, 0.05)); setCam(vlerp(p, fH(), lerp(0.25, 0.4, u)), fH().add(V(0, -0.08, 0)), 30 * (1 - punch(t, L0('F9') + 0.5, 0.1))); });
S('C_T2', B('risk2').t1, L1('T2') + 0.1, (t) => { setCam(V(-2.2, 1.3, -3.2), V(-0.7, 1.0, -3.4), 42); });
S('C_F16', L1('T2') + 0.1, L1('F16') + 0.04, (t) => { const h = fH(); setCam(h.clone().add(V(1.3, -0.15, -0.5)), h.clone().add(V(0, -0.25, 0)), 38); });
S('C_T5', L1('F16') + 0.04, L1('T5') + 0.04, (t) => CU(tim, 1.0, -0.2, 0, 36));
S('C_F17', L1('T5') + 0.04, L1('F17') + 0.04, (t) => { const h = fH(); setCam(h.clone().add(V(1.15, -0.12, 0.45)), h.clone().add(V(0, -0.22, 0)), 36); });
S('C_L4', L1('F17') + 0.04, L1('L4') + 0.04, (t) => CU(lisa, 1.0, 0.2, 0, 36));
S('C_F18', L1('L4') + 0.04, L1('F18') + 0.04, (t) => { const h = fH(); setCam(h.clone().add(V(1.3, -0.15, -0.5)), h.clone().add(V(0, -0.25, 0)), 38); });
S('C_K3', L1('F18') + 0.04, L1('K3') + 0.1, (t) => CU(kesha, 1.0, 0.25, 0, 36));
S('C_F19', L1('K3') + 0.1, B('namefreeze').t1, (t, u) => { CU(foma, lerp(1.2, 0.8, ease(seg(t, L0('F19') + 0.3, B('namefreeze').t1))), 0.15, -0.05, 34); }, { journal: true });
S('C_T6', B('namefreeze').t1, L1('T6') + 0.03, (t) => { const h = HW(tim); setCam(h.clone().add(V(-1.5, 0.05, 0.6)), h.clone().add(V(0, -0.2, 0)), 40 * (1 - punch(t, L0('T6') + 0.6, 0.12))); });
S('C_laugh', L1('T6') + 0.03, B('laugh').t1, (t, u) => { setCam(V(-4.3, 2.0, -7.9).add(shake(0.01, t)), V(0.6, 0.85, -3.4), lerp(50, 46, u)); });
S('C_F20', B('laugh').t1, L1('F20') + 0.1, (t) => { CU(foma, 1.0, 0.0); cam.position.add(shake(0.02, t)); });
S('C_F10', L1('F20') + 0.1, L1('F10') + 0.05, (t, u) => { setCam(V(-1.4, 1.55, -2.0), V(-4.6, 1.55, -5.2), lerp(44, 40, u)); });
S('C_T3', L1('F10') + 0.05, L1('T3') + 0.02, (t) => CU(tim, 0.95, -0.3, 0, 36));
S('C_K1', L1('T3') + 0.02, L1('K1') + 0.02, (t) => CU(kesha, 0.95, 0.3, 0, 36));
S('C_T4', L1('K1') + 0.02, L1('T4') + 0.05, (t) => CU(tim, 0.85, 0.25, 0, 34));
S('C_L1', L1('T4') + 0.05, L1('L1') + 0.05, (t, u) => { CU(lisa, lerp(1.25, 1.05, u), 0.2, 0.05, 36); });
S('C_p56', L1('L1') + 0.05, L1('F11') + 0.05, (t, u) => { CU(foma, lerp(1.3, 1.1, u), -0.15, -0.03, 34); });
S('C_walk', L1('F11') + 0.05, L0('L2'), (t, u) => { setCam(V(-2.6, 1.4, -2.6), V(-0.9, 1.1, -4.2), 42); });
S('C_L2', L0('L2'), L1('L2') + 0.05, (t) => { const h = HW(lisa); setCam(h.clone().add(V(-0.7, 0.15, 0.75)), h.clone().add(V(0, -0.05, 0)), 32); });
S('C_F12', L1('L2') + 0.05, L1('F12') + 0.05, (t) => { const h = fH(); setCam(h.clone().add(V(-0.55, -0.35, -0.85)), h.clone().add(V(0, -0.1, 0)), 32); });
S('C_L3', L1('F12') + 0.05, L1('L3') + 0.03, (t) => { const h = HW(lisa); setCam(h.clone().add(V(-0.6, 0.1, 0.65)), h.clone().add(V(0, -0.05, 0)), 30); });
S('C_deal', L1('L3') + 0.03, L1('F13') + 0.08, (t, u) => { setCam(V(-2.6, 1.4, lerp(-4.2, -4.05, u)), V(-0.7, 1.1, -4.05), 38); });
S('C_teach', L1('F13') + 0.08, L0('K2'), (t, u) => { setCam(V(lerp(3.2, 2.6, u), 2.0, -5.6), V(-3.6, 1.2, -4.0), 46); });
S('C_K2', L0('K2'), L1('K2') + 0.05, (t) => CU(kesha, 1.0, 0.3, 0, 36));
S('C_F21', L1('K2') + 0.05, L1('F21') + 0.15, (t) => CU(foma, 1.0, 0.2, -0.05, 34));
S('C_D1', L1('F21') + 0.15, B('plane').t0, (t, u) => { const h = HW(dir); setCam(h.clone().add(V(2.2, -0.1, 0.6)), h.clone().add(V(0, -0.15, 0)), 40); });
S('C_plane', B('plane').t0, B('hit').t0, (t, u) => { const p = plane.position.clone(); setCam(p.clone().add(V(0.5, 0.18, 0.55)), p, 50); });
S('C_hit', B('hit').t0, B('score').t1, (t, u) => { const h = HW(dir); setCam(h.clone().add(V(0.15, -0.05, -1.25)).add(shake(0.03 * (1 - seg(t, B('hit').t0, B('hit').t0 + 0.4)), t)), h.clone().add(V(0, 0, 0)), 36 * (1 - punch(t, B('hit').t0 + 0.02, 0.25))); }, { score: true });
S('C_D2', B('score').t1, L1('D2') + 0.15, (t, u) => { const h = HW(dir); setCam(h.clone().add(V(0.35, -0.08, -lerp(1.15, 0.95, u))), h.clone().add(V(0, -0.05, 0)), 34); });
S('C_F14', L1('D2') + 0.15, L1('F14') + 0.15, (t) => CU(foma, 1.1, 0.25));
S('C_D3', L1('F14') + 0.15, L1('D3') + 0.05, (t, u) => { const h = HW(dir); setCam(h.clone().add(V(0.3, -0.1, -lerp(1.05, 0.85, u))), h.clone().add(V(0, -0.05, 0)), 34 * (1 - punch(t, L0('D3') + 1.2, 0.1))); });
S('C_risk5', L1('D3') + 0.05, L0('F22'), (t, u) => { setCam(V(-1.0, 1.7, -6.6), V(-4.6, 1.6, -4.4), 44); });
S('C_F22', L0('F22'), B('outro').t0, (t, u) => { CU(foma, lerp(1.1, 0.85, u), 0.1, -0.03, 34); });
S('C_outro', B('outro').t0, END + 1, (t, u) => { setCam(V(-1.5, 1.8, -5.6), V(-4.6, 1.75, -4.5), lerp(40, 30, u)); });
const shotById = Object.fromEntries(SH.map(s => [s.id, s]));
const shotAt = t => SH.find(s => t >= s.t0 && t < s.t1) || SH[SH.length - 1];

// ---------- RISK METER ----------
const RISK = () => [[B('risk1').t0, 10, 'Чуть не проговорился'], [B('risk2').t0, 25, 'Тимур узнал Фому'], [B('laugh').t0 + 0.2, 40, 'Своё имя в журнале'], [L0('F11') + 0.1, 45, 'Учитель сомневается в 7×8'], [B('hit').t0 + 0.1, 65, 'Самолётик в лоб директору'], [B('risk5').t0, 75, 'Директор проверит лично']];
function riskAt(t) { let v = 0, prev = 0, ev = null; for (const r of RISK()) { if (t >= r[0]) { prev = v; v = r[1]; ev = r; } } if (ev) { const k = easeOut(seg(t, ev[0], ev[0] + 0.45)); return { v: lerp(prev, v, k), ev, age: t - ev[0] }; } return { v: 0, ev: null, age: 99 }; }
function drawRisk(t, forced) {
  const r = forced != null ? { v: forced, ev: null, age: 99 } : riskAt(t); const x = 48, y = 40, w = 430, h = 30;
  const hot = r.age < 0.6; const sh = hot ? 6 * Math.sin(t * 90) * (1 - r.age / 0.6) : 0;
  ctx.save(); ctx.translate(sh, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; rr(ctx, x - 16, y - 14, w + 32, 98, 18); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '900 26px Inter'; ctx.textBaseline = 'middle'; ctx.fillText('РИСК РАЗОБЛАЧЕНИЯ', x, y + 6);
  ctx.textAlign = 'right'; const col = r.v > 70 ? '#ff3b3b' : r.v > 35 ? '#ffb020' : '#7CFC8A'; ctx.fillStyle = col; ctx.fillText(Math.round(r.v) + '%', x + w, y + 6); ctx.textAlign = 'left';
  ctx.fillStyle = '#2a2a2e'; rr(ctx, x, y + 32, w, h, 12); ctx.fill(); ctx.fillStyle = col; rr(ctx, x, y + 32, Math.max(14, w * r.v / 100), h, 12); ctx.fill();
  if (forced != null && forced > 90 && Math.floor(t * 5) % 2) { ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 5; rr(ctx, x - 16, y - 14, w + 32, 98, 18); ctx.stroke(); }
  if (r.ev && r.age < 2.0) { const a = Math.min(1, r.age / 0.15) * Math.min(1, (2.0 - r.age) / 0.3); ctx.globalAlpha = a; ctx.fillStyle = '#ff3b3b'; rr(ctx, x - 16, y + 92, w + 32, 50, 14); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '900 26px Inter'; ctx.fillText(`+${r.ev[1] - (RISK()[RISK().indexOf(r.ev) - 1] || [0, 0])[1]}% · ${r.ev[2]}`, x, y + 118); }
  ctx.restore();
}
function plate(t, text, t0, sub) { if (t < t0 || t > t0 + 2.6) return; const a = Math.min(1, (t - t0) / 0.2) * Math.min(1, (t0 + 2.6 - t) / 0.3); ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(0,0,0,0.6)'; rr(ctx, W - 560, 34, 520, sub ? 104 : 68, 16); ctx.fill(); ctx.fillStyle = '#ffd21a'; ctx.font = '900 34px Inter'; ctx.fillText(text, W - 64, 68); if (sub) { ctx.fillStyle = '#fff'; ctx.font = '700 26px Inter'; ctx.fillText(sub, W - 64, 112); } ctx.restore(); }

// ---------- OVERLAYS ----------
function card(lines, t, t0, bg = 'rgba(0,0,0,0.6)') { ctx.save(); const k = easeOut(seg(t, t0, t0 + 0.15)); ctx.translate(W / 2, H / 2 - 40); ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k); ctx.globalAlpha = k; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  lines.forEach(([s, size, col], i) => { ctx.font = `900 ${size}px Inter`; ctx.lineWidth = size / 5; ctx.strokeStyle = '#000'; const y = (i - (lines.length - 1) / 2) * size * 1.2; ctx.strokeText(s, 0, y); ctx.fillStyle = col; ctx.fillText(s, 0, y); }); ctx.restore(); }
function overlay(t, shot, vt) {
  // flash-forward HUD in the hook shows the risk at 99%
  if (inGym(vt) && !shot.rewind) drawRisk(t, 99);
  else if (!inGym(vt) && t > B('room').t0 && !shot.ref) drawRisk(t);
  if (shot.ref && !shot.rewind) drawRisk(t, 99);
  plate(t, '07:00 · УТРО', B('room').t0 + 0.1, 'Дом Фомы');
  plate(t, '08:25 · ШКОЛА №7', B('hall').t0 + 0.1, 'Коридор, 2 этаж');
  plate(t, 'УРОК 1/6 · МАТЕМАТИКА', B('class').t0 + 0.1, '08:30 · кабинет 7Б');
  if (shot.rewind) { ctx.save(); ctx.fillStyle = 'rgba(30,0,60,0.35)'; ctx.fillRect(0, 0, W, H); for (let y = (t * 2600) % 36; y < H; y += 36) { ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(0, y, W, 5); } ctx.restore(); card([['◀◀ СЕГОДНЯ УТРОМ', 110, '#fff']], t, shot.t0); }
  if (shot.badge) { ctx.save(); const k = easeOut(seg(t, shot.t0, shot.t0 + 0.2)); ctx.fillStyle = `rgba(0,0,0,${0.45 * k})`; ctx.fillRect(0, 0, W, H); ctx.translate(W / 2, H / 2 - 30); ctx.rotate(-0.05); ctx.scale(k, k);
    ctx.fillStyle = '#fff'; rr(ctx, -380, -200, 760, 400, 26); ctx.fill(); ctx.fillStyle = '#1f4fa8'; rr(ctx, -380, -200, 760, 90, 26); ctx.fill(); ctx.fillRect(-380, -140, 760, 30);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.font = '900 46px Inter'; ctx.fillText('ШКОЛА №7', 0, -152); ctx.fillStyle = '#111'; ctx.font = '900 92px Inter'; ctx.fillText('ФОМА ИВАНОВИЧ', 0, -20);
    ctx.fillStyle = '#c0392b'; ctx.font = '900 54px Inter'; ctx.fillText('ЗАВУЧ И УЧИТЕЛЬ ВСЕГО', 0, 100); ctx.restore(); }
  if (shot.journal && t > L0('F19') + 0.35) { ctx.save(); const k = easeOut(seg(t, L0('F19') + 0.35, L0('F19') + 0.55)); ctx.translate(W - 470, H / 2 + 10); ctx.rotate(0.04); ctx.scale(k, k); ctx.fillStyle = '#fffdf3'; rr(ctx, -330, -260, 660, 520, 20); ctx.fill(); ctx.strokeStyle = '#1f4fa8'; ctx.lineWidth = 10; rr(ctx, -330, -260, 660, 520, 20); ctx.stroke();
    ctx.fillStyle = '#1f4fa8'; ctx.font = '900 44px Inter'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('ЖУРНАЛ · 7 «Б»', -290, -200);
    [['1. Тимур', '✓'], ['2. Лиза', '✓'], ['3. Кеша', '✓'], ['4. ФОМА', '?']].forEach(([n, m], i) => { const y = -110 + i * 90; if (i === 3) { ctx.fillStyle = 'rgba(255,59,59,0.25)'; ctx.fillRect(-300, y - 38, 600, 76); } ctx.fillStyle = i === 3 ? '#e0302a' : '#222'; ctx.font = `900 ${i === 3 ? 58 : 48}px Inter`; ctx.fillText(n, -280, y); ctx.fillText(m, 220, y); });
    ctx.restore(); }
  if (shot.score && t > B('score').t0) card([['ТИМУР: 1', 92, '#ffd21a'], ['ДИРЕКТОР: 0', 92, '#fff']], t, B('score').t0);
  if (shot.id === 'C_outro') { const k = seg(t, B('outro').t0 + 0.4, B('outro').t0 + 0.7); if (k > 0) { ctx.save(); ctx.translate(0, 330); card([['УРОК 2/6: КОНТРОЛЬНАЯ ▶', 76, '#ffd21a']], t, B('outro').t0 + 0.4); ctx.restore(); } }
  if (shot.flash) { const k = t - shot.t0; if (k < 0.12) { ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - k / 0.12)})`; ctx.fillRect(0, 0, W, H); } }
  for (const [at, a] of [[B('montage').t1, 0.6], [B('room').t0, 0.4], [B('hit').t0 + 0.02, 0.7], [L0('H5'), 0.5]]) { const k = t - at; if (k >= 0 && k < 0.18) { ctx.fillStyle = `rgba(255,255,255,${a * (1 - k / 0.18)})`; ctx.fillRect(0, 0, W, H); } }
  if (shot.blur) { ctx.save(); ctx.globalAlpha = 0.5; for (let i = 1; i < 6; i++) ctx.drawImage(out, -i * 40, 0); ctx.restore(); }
  for (const s of SUBS) if (t >= s.t0 && t <= s.t1) drawSub(s, t);
}

// ---------- UPDATE ----------
function placeRig(r, st, seatY) { applyPose(r, st.pos, st.rotY, st.pose); if (seatY != null) r.root.position.y = seatY; if (st.look) lookAtWorld(r, st.look, 0.85); }
function update(t) {
  T_ = t;
  // kids
  KIDS.forEach((r, i) => { const s = kidPose(i, t); r.root.visible = inGym(t) || (!inRoom(t) && !inHall(t)) || false; applyPose(r, s.pos, s.rotY, s.pose); if (s.sitting && !inGym(t)) r.root.position.y = KID_SEAT_Y; if (s.look) lookAtWorld(r, s.look, 0.8); drawNPCFace(r.face.c.getContext('2d'), s.mood, s.talk ? Math.abs(Math.sin(t * 13)) * s.talk : 0); r.face.t.needsUpdate = true; });
  // adults
  const { o, d } = adultState(t);
  oleg.root.visible = o.vis; if (o.vis) { applyPose(oleg, o.pos, o.rotY, o.pose); if (o.look) lookAtWorld(oleg, o.look, 0.8); drawNPCFace(oleg.face.c.getContext('2d'), o.mood, o.talk ? Math.abs(Math.sin(t * 13)) * o.talk : 0); oleg.face.t.needsUpdate = true; }
  dir.root.visible = d.vis; if (d.vis) { applyPose(dir, d.pos, d.rotY, d.pose); if (d.look) lookAtWorld(dir, d.look, 0.8); drawNPCFace(dir.face.c.getContext('2d'), d.mood, d.talk ? Math.abs(Math.sin(t * 12)) * d.talk : 0); dir.face.t.needsUpdate = true; }
  // Foma
  const fs = fomaPose(t); applyPose(foma, fs.pos, fs.rotY, fs.pose); if (fs.sit) foma.root.position.y = 0.5 - FOMA_L.hip * 0.8 + 0.02; if (inRoom(t) && fs.sit) foma.root.position.y = 0.47 - FOMA_L.hip * 0.8 + 0.02;
  drawFomaMask({ h: fs.eye, px: 0, glow: fs.glow }); fomaLook = fs.look; if (fs.look && fs.look !== 'cam') lookAtWorld(foma, fs.look, 0.85);
  badge.visible = !inRoom(t);
  blanket.visible = inRoom(t) && t < B('tie').t0; if (blanket.visible) { blanket.position.set(RX - 2.0, 0.78, 0.82); }
  thermo.visible = inRoom(t) && t < L1('S3') + 0.3 && t > L0('S1') - 0.2; if (thermo.visible) { foma.hand[1].getWorldPosition(thermo.position); thermo.position.y += 0.06; thermo.rotation.set(0, 0, 0.4); }
  // props
  doorPiv.rotation.y = t >= B('class').t0 && t < B('door').t1 + 0.3 ? -1.3 * ease(seg(t, B('class').t0, B('class').t0 + 0.5)) : (t >= B('plane').t0 + 0.9 ? -1.3 * ease(seg(t, B('plane').t0 + 0.9, B('plane').t0 + 1.3)) : 0);
  roomDoor.rotation.y = inRoom(t) && (sp('M1b') || sp('M3')) ? 0.03 * Math.sin(t * 60) : 0;
  clockG.position.x = -2.0 + (inRoom(t) && t < L0('M1') + 0.3 ? 0.01 * Math.sin(t * 90) : 0);
  bellG.position.x = 1.9 + (t >= B('bell').t0 && t < B('class').t0 + 0.3 ? 0.01 * Math.sin(t * 80) : 0);
  alarmCap.position.z = 0.05;
  journal.visible = t >= vo('F16').t0 && t < vo('F10').t0; if (journal.visible) { foma.hand[0].getWorldPosition(journal.position); journal.position.y += 0.08; journal.rotation.set(-0.9, foma.root.rotation.y, 0); }
  pirozhok.visible = !inGym(t) && !inRoom(t) && !inHall(t) && t < B('plane').t0 + 3; if (pirozhok.visible) { if (t < B('teach').t0 + 0.8) { kesha.hand[1].getWorldPosition(pirozhok.position); } else { foma.hand[0].getWorldPosition(pirozhok.position); } pirozhok.position.y += 0.05; }
  // paper plane: Tim throws at plane.t0+0.75, flies to the door, hits director at hit.t0
  const pt0 = B('plane').t0 + 0.75, pt1 = B('hit').t0; plane.visible = t >= B('plane').t0 && t < B('score').t1 + 6 && !inGym(t);
  if (plane.visible) { if (t < pt0) { tim.hand[1].getWorldPosition(plane.position); plane.rotation.set(0, 0.6, 0); } else { const k = seg(t, pt0, pt1); const a = SEAT[0].clone().add(V(0, 1.25, 0)), b = V(0.7, 1.75, -0.32); const p = vlerp(a, b, k); p.y += Math.sin(k * Math.PI) * 0.5; plane.position.copy(p); const dir2 = b.clone().sub(a).normalize(); plane.rotation.set(0, Math.atan2(dir2.x, dir2.z), Math.sin(t * 8) * 0.15); if (t >= pt1) { plane.position.copy(HW(dir).add(V(0, 0.08, 0)).add(fwd(dir, 0.26))); plane.rotation.set(0.3, Math.PI, 0.2); } } }
  // gym balls
  gymBalls.forEach((b, i) => { const ph = (t > B('montage').t1 ? t : 0.4) * (1.2 + i * 0.13) + i * 1.7; b.position.set(Math.cos(ph * 1.1 + i) * (5 - i * 0.3), 0.2 + Math.abs(Math.sin(ph * 2.3)) * (2.5 + (i % 3)), Math.sin(ph * 0.9 + i * 2) * 4); b.visible = inGym(t); });
  drawBoard(t);
  return fs;
}
let fomaLook = null;
const PUSH = new Set(['R_S1', 'R_S3', 'R_M2', 'H_F5', 'H_O2', 'C_T2', 'C_K2']);
function renderFrame(f) {
  const t = f / FPS; let shot = shotAt(t); const vt = shot.vt ? shot.vt(t) : t; const camShot = shot.ref ? shotById[shot.ref] : shot;
  update(vt);
  const u = (vt - camShot.t0) / Math.max(0.01, camShot.t1 - camShot.t0);
  camShot.f(vt, clamp(u));
  if (PUSH.has(camShot.id)) { cam.translateZ(-0.2 * ease(clamp(u))); cam.position.add(shake(0.004, vt, 11)); }
  if (fomaLook === 'cam') lookAtWorld(foma, cam.position, 0.9);
  // the ball frozen in front of the lens during the hook
  camBall.visible = t < L1('H2') + 0.06; if (camBall.visible) { const d = new THREE.Vector3(); cam.getWorldDirection(d); camBall.position.copy(cam.position).addScaledVector(d, 0.95).add(V(-0.36, -0.2, 0)); }
  renderer.render(scene, cam);
  ctx.drawImage(renderer.domElement, 0, 0, W, H); overlay(t, shot, vt);
  return shot.id;
}
window.renderFrame = renderFrame;
window.grab = (q = 0.93) => out.toDataURL('image/jpeg', q);
window.TOTAL = TOTAL;
window.ready = document.fonts.load('900 60px Inter').then(() => true);
