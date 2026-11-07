
// ===== SET (from school episode) =====
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
