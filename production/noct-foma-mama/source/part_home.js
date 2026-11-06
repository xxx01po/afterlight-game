
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
