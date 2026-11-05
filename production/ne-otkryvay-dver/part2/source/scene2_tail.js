
// ======================= PART 2: «ГЛАЗАМИ ДВОЙНИКА» =======================
// Part-2 time t -> Part-1 time t1 for everything that happens in the real room,
// so the boy behind the glass repeats exactly what he did in Part 1.
const T1KEYS = [[0, -1.3], [3.2, 3.4], [7.0, 7.6], [11.5, 15.1], [11.9, 16.65], [14.9, 19.65], [19.0, 23.6], [22.5, 25.0], [24.3, 26.75], [25.5, 27.9]];
function mapT(t) {
  if (t <= T1KEYS[0][0]) return T1KEYS[0][1];
  for (let i = 0; i < T1KEYS.length - 1; i++) { const [a, x] = T1KEYS[i], [b, y] = T1KEYS[i + 1]; if (t <= b) return x + (y - x) * (t - a) / (b - a); }
  return T1KEYS[T1KEYS.length - 1][1];
}

// ---- the mirror is a window into the reflected room ----
reflector.visible = false;
crackPlane.material.side = THREE.DoubleSide;
room.remove(mirrorGroup);
const room2 = room.clone(); room2.scale.z = -1; room2.position.z = 2 * RZ; scene.add(room2);
room.add(mirrorGroup);
const frame2 = new THREE.Group(); mirrorGroup.children.forEach(c => { if (c !== reflector && c !== crackPlane) frame2.add(c.clone()); });
frame2.position.set(MIRROR.x, MIRROR.y, RZ + 0.03); scene.add(frame2);
const glass = new THREE.Mesh(new THREE.PlaneGeometry(MIRROR.w, MIRROR.h), new THREE.MeshBasicMaterial({ color: 0xb0c0d8, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }));
glass.position.set(MIRROR.x, MIRROR.y, RZ); scene.add(glass);
// hallway behind the real door
const hallGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), new THREE.MeshBasicMaterial({ color: 0xffb070, toneMapped: false }));
hallGlow.position.set(DOOR_X, 1.05, -RZ - 0.25); scene.add(hallGlow);
const hallSpot = new THREE.SpotLight(0xffb070, 0, 10, 0.7, 0.5, 1.2); hallSpot.position.set(DOOR_X, 1.7, -RZ - 0.6); hallSpot.target.position.set(DOOR_X + 0.3, 0.2, 0.8); scene.add(hallSpot, hallSpot.target);

// mirror-world light: sick red moon
const moon2 = new THREE.SpotLight(0xc06a80, 60, 12, 1.05, 0.7, 1.5); moon2.position.set(3.6, 2.9, 2 * RZ - 1.25); moon2.target.position.set(-0.4, 0.2, 2 * RZ - 0.3); scene.add(moon2, moon2.target);
const fill2 = new THREE.PointLight(0x7a2c44, 3.5, 8, 1.3); fill2.position.set(-0.6, 2.7, 2 * RZ - 0.4); scene.add(fill2);
const figRim = new THREE.PointLight(0xff2a3a, 0, 3.5, 1.3); figRim.position.set(-0.3, 2.3, 2 * RZ + 1.7); scene.add(figRim);
const phone2Light = new THREE.PointLight(0xffd6d6, 0, 1.6, 2); scene.add(phone2Light);

// the double and the figure now live on the normal layer (they are real — in their world)
dup.root.traverse(o => o.layers.set(0));
fig.root.traverse(o => o.layers.set(0));

// ---- second phone (the double's) ----
const phone2 = new THREE.Group(); scene.add(phone2);
add(phone2, box(PH.w, PH.h, 0.009, M(0x0c0c10, 0.3, { metalness: 0.4 }), 0.008), 0, 0, 0);
const s2c = document.createElement('canvas'); s2c.width = 400; s2c.height = 840;
const s2t = new THREE.CanvasTexture(s2c); s2t.colorSpace = THREE.SRGBColorSpace;
const screen2 = new THREE.Mesh(new THREE.PlaneGeometry(PH.w - 0.006, PH.h - 0.008), new THREE.MeshBasicMaterial({ map: s2t, toneMapped: false }));
screen2.position.z = 0.0047; phone2.add(screen2);

const F = (s, w = 700) => `${w} ${s}px Inter, "Noto Color Emoji", sans-serif`;
function chatScreen(g, o) {
  const w = 400, h = 840;
  g.fillStyle = '#0d0709'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1c0e12'; g.fillRect(0, 0, w, 110);
  g.fillStyle = o.avatar || '#7d1d28'; g.beginPath(); g.arc(60, 66, 24, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.font = F(24, 800); g.textAlign = 'center'; g.fillText(o.avatarText || '?', 60, 75);
  g.textAlign = 'left'; g.font = F(24, 700); g.fillText(o.header, 98, 64); g.fillStyle = '#b88'; g.font = F(17, 500); g.fillText(o.sub || 'в сети', 98, 90);
  let y = 140;
  for (const b of o.bubbles) {
    if (b.k <= 0) continue;
    g.save(); g.globalAlpha = b.k;
    if (b.video) { g.fillStyle = '#6e1b25'; rr(g, 140, y, 238, 150, 20); g.fill(); g.fillStyle = '#000'; rr(g, 150, y + 10, 218, 130, 14); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(240, y + 45); g.lineTo(240, y + 105); g.lineTo(285, y + 75); g.fill(); y += 165; }
    else { g.font = F(27, 900); const lines = []; let line = ''; for (const wd of b.text.split(' ')) { const tt = line ? line + ' ' + wd : wd; if (g.measureText(tt).width > 250 && line) { lines.push(line); line = wd; } else line = tt; } lines.push(line);
      const bh = 30 + lines.length * 34; g.fillStyle = '#6e1b25'; rr(g, 100, y, 278, bh, 20); g.fill(); g.fillStyle = '#fff'; lines.forEach((l, i) => g.fillText(l, 118, y + 40 + i * 34)); y += bh + 14; }
    g.restore();
  }
  if (o.input) { // live draft, big, so the hook reads on a phone
    g.save(); g.globalAlpha = 0.85; g.font = F(34, 900); const lines = []; let line = ''; for (const wd of o.input.split(' ')) { const tt = line ? line + ' ' + wd : wd; if (g.measureText(tt).width > 300 && line) { lines.push(line); line = wd; } else line = tt; } lines.push(line);
    const bh = 36 + lines.length * 42; g.strokeStyle = '#a33a48'; g.setLineDash([10, 8]); g.lineWidth = 3; rr(g, 40, y, 340, bh, 22); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#fff'; lines.forEach((l, i) => g.fillText(l, 60, y + 48 + i * 42)); g.fillStyle = '#c99'; g.font = F(17, 600); g.fillText('печатает…', 60, y + bh + 24); g.restore(); y += bh + 30;
  }
  if (o.status) { g.fillStyle = '#c99'; g.font = F(17, 600); g.textAlign = 'right'; g.fillText(o.status, 376, y + 4); g.textAlign = 'left'; }
  // input + keyboard
  g.fillStyle = '#1c0e12'; g.fillRect(0, 560, w, 280);
  g.fillStyle = '#2b161b'; rr(g, 16, 574, 368, 56, 28); g.fill();
  g.fillStyle = '#fff'; g.font = F(22, 700);
  const txt = o.input || ''; const shown = txt.length > 22 ? '…' + txt.slice(-21) : txt;
  g.fillText(shown, 34, 610);
  if (o.cursor) { const cw = g.measureText(shown).width; g.fillRect(36 + cw, 590, 3, 28); }
  g.fillStyle = '#3a2228'; for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) { rr(g, 12 + c * 38, 648 + r * 58, 32, 48, 7); g.fill(); }
  if (o.press !== undefined) { const r = o.press % 3, c = (o.press * 7) % 10; g.fillStyle = '#8a4a55'; rr(g, 12 + c * 38, 648 + r * 58, 32, 48, 7); g.fill(); }
  if (o.record) { g.fillStyle = 'rgba(13,7,9,0.92)'; g.fillRect(0, 560, w, 280); g.fillStyle = '#ff2d3d'; g.beginPath(); g.arc(60, 640, 14 + 3 * Math.sin(o.record * 12), 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = F(24, 700); g.fillText('Голосовое · 0:0' + Math.floor(o.record), 90, 648);
    g.fillStyle = '#ff7a86'; for (let i = 0; i < 26; i++) { const a = 0.15 + 0.85 * Math.abs(noise1(o.record * 9 + i * 0.6, i)); rr(g, 30 + i * 13.5, 740 - 50 * a, 8, 100 * a, 4); g.fill(); } }
}
function typed(text, t, t0, t1) { return text.slice(0, Math.floor(text.length * clamp((t - t0) / (t1 - t0)))); }
function drawPhone2(t) {
  const g = s2c.getContext('2d');
  if (t < 22.5) {
    const bubbles = [{ text: MSG1, k: easeOut(seg(t, 1.05, 1.2)) }, { text: MSG2, k: easeOut(seg(t, 7.0, 7.15)) }, { video: true, k: easeOut(seg(t, 9.3, 9.45)) }];
    let input = '', press;
    if (t >= 0 && t < 1.05) { input = typed(MSG1, t, -0.25, 0.95); press = input.length; }
    if (t > 6.2 && t < 7.0) { input = typed(MSG2, t, 6.2, 6.9); press = input.length; }
    const status = t > 9.6 ? 'Просмотрено' : t > 7.6 ? 'Прочитано' : t > 1.6 ? 'Прочитано' : t > 1.05 ? 'Доставлено' : '';
    chatScreen(g, { header: 'Я', avatarText: 'Я', sub: 'по ту сторону', bubbles, input, cursor: Math.floor(t * 3) % 2 === 0 || !!input, press, status, record: t > 11.85 && t < 14.9 ? t - 11.85 : 0 });
  } else {
    const gr = g.createLinearGradient(0, 0, 0, 840); gr.addColorStop(0, '#2a1018'); gr.addColorStop(1, '#07030a'); g.fillStyle = gr; g.fillRect(0, 0, 400, 840);
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = F(54, 800); g.fillText('МАМА ❤️', 200, 230);
    g.font = F(24, 500); g.fillStyle = '#d9b8c0'; g.fillText(t < 23.7 ? 'вызов…' : '00:0' + Math.floor(t - 23.7), 200, 280);
    g.fillStyle = '#e5383b'; g.beginPath(); g.arc(200, 700, 44, 0, 7); g.fill();
    g.textAlign = 'left';
  }
  s2t.needsUpdate = true;
}
function drawTrapped(t) { // the boy, now inside the mirror, starts the next loop
  const g = screenCanvas.getContext('2d');
  const input = typed(MSG1, t, 30.5, 32.6);
  chatScreen(g, { header: 'Я', avatarText: 'Я', sub: 'по ту сторону', bubbles: [], input, cursor: true, press: input.length });
  screenTex.needsUpdate = true;
}

// ---- the double (in the mirror room) ----
const D0 = V(1.05, 0, RZ + 0.65), D_ROT = Math.PI + 0.32;
const FIG_DEEP = V(-0.32, 0, 2 * RZ + 0.42); // exact reflection of Part-1 FIG_SPOT
function dupState(t) {
  const s = { pos: D0.clone(), rotY: D_ROT, sit: 0, walk: 0, back: 0, lean: 0, tremble: 0, lift: 1, phoneMode: 'hand' };
  if (t > 20.3) { const k = ease(seg(t, 20.3, 21.3)); s.pos = vlerp(D0, V(1.4, 0, RZ + 0.85), k); s.walk = Math.sin(seg(t, 20.3, 21.3) * Math.PI) * 0.5; }
  let look = headPos();
  if (t < 1.15 || (t > 6.15 && t < 7.05) || (t > 22.5 && t < 24.05)) look = 'phone2';
  else if (t > 14.9 && t < 16.1) look = FIG_DEEP.clone().add(V(0, 2.5, 0));
  else if (t > 25.5) look = V(DOOR_X, 1.2, -RZ);
  if ([[1.2, 3.2], [7.2, 9.0], [13.0, 14.9], [16.0, 17.3], [24.2, 25.5]].some(([a, b]) => t >= a && t < b)) look = V(-0.5, 1.6, 1.55); // talks to the viewer
  s.look = look;
  s.holdUp = keys(t, [[0, 0.45], [1.2, 0.45], [1.5, 0.1], [6.0, 0.1], [6.2, 0.45], [7.1, 0.45], [7.4, 0.1], [11.6, 0.1], [11.9, 0.75], [14.8, 0.75], [15.1, 0.1], [22.4, 0.1], [22.6, 0.9]]);
  s.toEar = ease(seg(t, 24.0, 24.4));
  const speaking = [[0.25, 2.8], [3.4, 5.1], [7.3, 8.6], [11.9, 14.9], [16.2, 17.1], [24.35, 25.3]].some(([a, b]) => t > a && t < b);
  s.dupFace = { lx: 0, ly: 0, pupil: 0.6, eye: 1.05, mouth: speaking ? 0.18 + 0.32 * Math.abs(Math.sin(t * 15)) : 0, smile: 0.15 + 0.6 * seg(t, 7.3, 8.4) + 0.3 * seg(t, 16.0, 16.6), brow: 0, blink: 0 };
  return s;
}
function placePhone2(s) {
  const headW = new THREE.Vector3(); dup.neck.getWorldPosition(headW); headW.y += 0.2;
  const fwd = V(Math.sin(s.rotY), 0, Math.cos(s.rotY)), right = V(-Math.cos(s.rotY), 0, Math.sin(s.rotY));
  const handPos = headW.clone().addScaledVector(fwd, 0.3 - 0.06 * (1 - s.holdUp)).addScaledVector(V(0, 1, 0), -0.17 - 0.38 * (1 - s.holdUp)).addScaledVector(right, 0.07);
  const earPos = headW.clone().addScaledVector(right, 0.27).addScaledVector(fwd, 0.02).addScaledVector(V(0, 1, 0), -0.02);
  phone2.position.copy(vlerp(handPos, earPos, s.toEar));
  const m = new THREE.Object3D(); m.position.copy(handPos); m.lookAt(headW); m.rotateX(-0.15);
  const e = new THREE.Object3D(); e.position.copy(earPos); e.lookAt(headW); e.rotateZ(Math.PI / 2 * 0.6);
  phone2.quaternion.copy(m.quaternion).slerp(e.quaternion, s.toEar);
  phone2.updateMatrixWorld(true);
  const n = V(0, 0, 1).applyQuaternion(phone2.quaternion), dn = V(0, -1, 0).applyQuaternion(phone2.quaternion);
  aimArm(dup.root, dup.arms[0], phone2.position.clone().addScaledVector(dn, 0.2 - 0.12 * s.toEar).addScaledVector(n, -0.12));
  phone2Light.intensity = 1.3; phone2Light.position.copy(new THREE.Vector3(0, 0, 0.06).applyMatrix4(phone2.matrixWorld));
}

// ---------- camera helpers ----------
function headPos() { const v = new THREE.Vector3(); hero.neck.getWorldPosition(v); v.y += 0.23; return v; }
function dupHead() { const v = new THREE.Vector3(); dup.neck.getWorldPosition(v); v.y += 0.23; return v; }
function dupFwd() { const r = dup.root.rotation.y; return V(Math.sin(r), 0, Math.cos(r)); }
function figHead() { const v = new THREE.Vector3(); fig.neck.getWorldPosition(v); v.y += 0.3; return v; }
function setCam(pos, target, fov = 50, roll = 0) { cam.position.copy(pos); cam.up.set(0, 1, 0); cam.lookAt(target); if (roll) cam.rotateZ(roll); cam.fov = fov; cam.updateProjectionMatrix(); }
function shake(amount, t, seed = 0) { return V(noise1(t * 37, seed) * amount, noise1(t * 41, seed + 3) * amount, noise1(t * 29, seed + 7) * amount * 0.5); }
function impulse(t, list, decay = 10) { let v = 0; for (const k of list) if (t >= k) v += Math.exp(-(t - k) * decay) * (t - k < 0.4 ? 1 : 0); return v; }
function insertUp(ph, dist, fov = 50, roll = 0) { const p = ph.position; const n = V(0, 0, 1).applyQuaternion(ph.quaternion), up = V(0, 1, 0).applyQuaternion(ph.quaternion); setCam(p.clone().addScaledVector(n, dist).addScaledVector(up, 0.04), p.clone().addScaledVector(up, 0.035), fov, roll); }
function insert(ph, dist, fov = 50, roll = 0) { const p = ph.position; const n = V(0, 0, 1).applyQuaternion(ph.quaternion); setCam(p.clone().addScaledVector(n, dist).add(V(0, 0.02, 0)), p, fov, roll); }
function dupCU(dist, fov, roll = 0) { const h = dupHead(); setCam(V(-0.5, 1.6, 1.55).addScaledVector(V(0.69, 0, 0.73), (0.8 - dist) * 0.6), h.clone().add(V(0, -0.12, 0)), fov * 0.85, roll); }
const KNOCKS = [3.45, 3.75, 4.05];
const LATE_KNOCKS = [11.9, 12.5, 13.1, 13.6, 14.05, 14.45, 14.8, 15.1];
const GLASS_THUMPS = [28.85, 29.25, 29.65, 30.05];

const SHOTS = [
  { id: 'P1', t0: 0.0, t1: 1.2, f(t, u) { insertUp(phone2, lerp(0.16, 0.13, easeOut(u)), 50, 0.08); } },
  { id: 'P2', t0: 1.2, t1: 3.2, f(t, u) { dupCU(0.6, lerp(44, 38, u), -0.05); } },
  { id: 'P3', t0: 3.2, t1: 6.2, f(t, u) { setCam(V(0.42, 1.75, RZ + 0.95), headPos(), lerp(26, 21, u)); } },
  { id: 'P4', t0: 6.2, t1: 7.2, f(t, u) { insertUp(phone2, lerp(0.16, 0.13, u), 50, -0.06); } },
  { id: 'P5', t0: 7.2, t1: 9.0, f(t, u) { dupCU(0.6, lerp(40, 32, u), 0.0); } },
  { id: 'P6', t0: 9.0, t1: 11.5, f(t, u) { setCam(V(0.45, 1.75, RZ + 0.9), headPos().add(V(0, -0.15, 0)), lerp(30, 24, u)); } },
  { id: 'P7', t0: 11.5, t1: 13.0, f(t, u) { setCam(V(0.35, 1.62, RZ + 1.0), headPos(), lerp(18, 15, u)); } },
  { id: 'P8a', t0: 13.0, t1: 14.9, f(t, u) { dupCU(0.6, lerp(42, 36, u), 0.04); } },
  { id: 'P8', t0: 14.9, t1: 16.0, f(t, u) { const h = dupHead(); setCam(h.clone().add(V(0.05, 0.05, 0.28)), figHead().add(V(0, -0.3, 0)), lerp(52, 40, ease(u))); } },
  { id: 'P8b', t0: 16.0, t1: 17.3, f(t, u) { dupCU(0.6, lerp(38, 30, u), 0.0); } },
  { id: 'P9', t0: 17.3, t1: 19.0, f(t, u) { const k = impulse(t, [17.38, 17.73, 18.03], 12); setCam(V(0.15, 1.6, RZ + 0.9).add(shake(0.02 * k, t, 13)), V(0.2, 1.55, RZ), 54); } },
  { id: 'P9b', t0: 19.0, t1: 20.3, f(t, u) { setCam(V(-0.15, 2.3, RZ + 3.95), V(0.15, 1.5, RZ), lerp(46, 40, u)); } },
  { id: 'P9c', t0: 20.3, t1: 22.5, f(t, u) { setCam(V(-0.22, 0.55, RZ + 0.3), figHead().add(V(0, -0.4, 0)), 62, 0.08); } },
  { id: 'P10', t0: 22.5, t1: 24.2, f(t, u) { insert(phone2, lerp(0.2, 0.16, u), 50, 0.06); } },
  { id: 'P11', t0: 24.2, t1: 25.5, f(t, u) { dupCU(0.6, 36, -0.04); } },
  { id: 'P12', t0: 25.5, t1: 27.2, f(t, u) { setCam(V(-0.2, 1.35, RZ + 0.5), V(DOOR_X, 1.1, -RZ), lerp(40, 34, u)); } },
  { id: 'BLACK', t0: 27.2, t1: 28.6, black: true, f() { } },
  { id: 'P14', t0: 28.6, t1: 30.4, f(t, u) { const k = impulse(t, GLASS_THUMPS, 14); setCam(V(0.3, 1.52, -1.2).add(shake(0.01 * k, t, 5)), V(0.3, 1.5, 2.6), lerp(40, 36, u)); } },
  { id: 'P15', t0: 30.4, t1: 32.01, f(t, u) { insert(phone, lerp(0.2, 0.16, u), 50, 0.05); cam.position.add(shake(0.002, t, 3)); } },
];
const shotAt = t => SHOTS.find(s => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1];

// ---------- overlays ----------
const SUBS = window.SUBS || [];
function overlay(t) {
  if (t < 2.6) { // series tag
    const k = 1 - seg(t, 2.2, 2.6);
    ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = 'rgba(120,20,32,0.92)'; rr(ctx, W / 2 - 165, 1560, 330, 84, 20); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '900 46px Inter'; ctx.textAlign = 'center'; ctx.fillText('ЧАСТЬ 2', W / 2, 1618); ctx.restore();
  }
  for (const s of SUBS) {
    if (t < s.t0 || t > s.t1) continue;
    const k = easeOut(seg(t, s.t0, s.t0 + 0.08));
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const size = s.size || 70; ctx.font = `900 ${size}px Inter`;
    ctx.translate(W / 2, s.y || 1390); ctx.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k); ctx.globalAlpha = k;
    ctx.lineJoin = 'round'; ctx.lineWidth = 14; ctx.strokeStyle = '#000';
    const lines = s.text.split('\n'); lines.forEach((l, i) => { const yy = (i - (lines.length - 1) / 2) * size * 1.15; ctx.strokeText(l, 0, yy); ctx.fillStyle = s.color || '#fff'; ctx.fillText(l, 0, yy); });
    ctx.restore();
  }
}

// ---------- frame update ----------
function update(t) {
  const final = t >= 28.6;
  const t1 = mapT(t);
  if (!final) {
    const s = heroState(t1); poseAvatar(hero, s, t1); placePhone(s, t1);
    drawPhoneScreen(t1);
  } else {
    const s = heroState(27.9);
    Object.assign(s, { pos: V(0.0, 0, RZ + 0.36), rotY: Math.PI, sit: 0, walk: 0, lean: 0, tremble: 1, phoneMode: 'hand', lift: 1, toEar: 0,
      holdUp: t < 30.4 ? 0.2 : 0.95, look: t < 30.4 ? V(0.3, 1.5, -1.2) : 'phone',
      face: { eye: 1.25, pupil: 0.28, brow: 1, lx: 0, ly: 0, mouth: t < 30.4 ? 0.75 : 0.3, blink: 0 } });
    poseAvatar(hero, s, t); placePhone(s, 20);
    if (t < 30.4) { const thump = impulse(t, GLASS_THUMPS, 9); aimArm(hero.root, hero.arms[1], V(-0.15, 1.8, RZ + 0.02 + 0.08 * (1 - thump))); }
    drawTrapped(t);
  }
  // the double
  if (!final) {
    const ds = dupState(t); poseAvatar(dup, ds, t, true); placePhone2(ds);
    dup.neck.rotation.z += seg(t, 11.0, 11.25) * 0.35 * (1 - seg(t, 12.6, 13.0)); // the head tilt from the Part-1 video
    phone2.visible = true;
  } else {
    const ds = { pos: V(0.58, 0, 0.95), rotY: -3.03, sit: 0, walk: 0, back: 0, lean: 0, tremble: 0, look: V(0.3, 1.52, -1.2),
      dupFace: { lx: 0, ly: 0, black: false, blackK: 1 - ease(seg(t, 29.0, 29.8)), eye: 1.0, pupil: 0.6, mouth: 0, smile: 0.7, brow: 0, blink: 0 } };
    poseAvatar(dup, ds, t, true); dup.arms[0].rotation.set(0, 0, -0.06); phone2.visible = false; phone2Light.intensity = 0;
  }
  dup.root.visible = true; dup.root.scale.setScalar(1.07);
  // the figure
  fig.root.visible = t > 14.85 && t < 27.2;
  let fp = FIG_DEEP.clone(), fwalk = 0;
  if (t > 20.3) { const k = ease(seg(t, 20.3, 22.4)); fp = vlerp(FIG_DEEP, V(0.12, 0, RZ + 0.8), k); fwalk = Math.sin(seg(t, 20.3, 22.4) * Math.PI); }
  fig.root.position.copy(fp); fig.root.rotation.y = Math.PI + 0.05;
  fig.legs[0].rotation.x = fwalk * 0.3 * Math.sin(t * 5); fig.legs[1].rotation.x = -fwalk * 0.3 * Math.sin(t * 5);
  fig.chest.rotation.x = 0.28 + 0.02 * Math.sin(t * 1.3); fig.neck.rotation.z = 0.12 * Math.sin(t * 0.7);
  fig.arms[1].rotation.set(0.05, 0, 0.04);
  const raise = ease(seg(t, 18.9, 20.1)) * (1 - ease(seg(t, 21.4, 22.3)));
  fig.root.updateMatrixWorld(true);
  if (raise > 0) { const rest = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, 0, -0.04)); aimArm(fig.root, fig.arms[0], headPos()); const aim = fig.arms[0].quaternion.clone(); fig.arms[0].quaternion.copy(rest).slerp(aim, raise); }
  else fig.arms[0].rotation.set(0.05, 0, -0.04);
  figRim.intensity = fig.root.visible ? 2.6 + 0.4 * noise1(t * 3, 2) : 0;
  figLight.intensity = 0;
  // the real door: knocks (Part-1 time), then it opens by itself
  const kick = impulse(t1, KNOCKS, 18) + 0.5 * impulse(t1, LATE_KNOCKS, 18);
  const a = -1.25 * ease(seg(t, 25.6, 27.0));
  doorSlab.rotation.y = a === 0 ? 0.004 * kick : a;
  doorSlab.position.set(-0.48 + 0.48 * Math.cos(a), 0, a === 0 ? -0.012 * kick : -0.48 * Math.sin(a));
  doorSlab.userData.lever.rotation.z = t1 > 10.6 && t1 < 12.0 ? -0.35 * Math.abs(Math.sin((t1 - 10.6) * 6)) * seg(t1, 10.6, 10.9) : 0;
  const open = seg(t, 25.6, 26.4);
  const hallOn = t1 < 15.55 || open > 0 ? 1 : 0;
  drawGap(hallOn, t1 > 3.4 && t1 < 15.55 ? 1 : 0, Math.round(noise1(t1 * 0.5, 2) * 4));
  hallLight.intensity = hallOn ? 1.2 : 0; hallSpot.intensity = 28 * open; hallGlow.visible = open > 0;
  drawCracks(t - 17.35);
  drawPhone2(t);
  screenMat.map = screenTex;
  if (final) { phoneLight.intensity = t >= 30.4 ? 0.7 : 0.3; }
}

function renderFrame(f) {
  const t = f / FPS;
  const shot = shotAt(t);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (!shot.black) {
    update(t);
    shot.f(t, (t - shot.t0) / (shot.t1 - shot.t0));
    renderer.setRenderTarget(null); renderer.render(scene, cam);
    ctx.drawImage(renderer.domElement, 0, 0, W, H);
  }
  overlay(t);
  return shot.id;
}
window.renderFrame = renderFrame;
window.grab = (q = 0.93) => out.toDataURL('image/jpeg', q);
window.ready = document.fonts.load('900 60px Inter').then(() => document.fonts.load('800 60px "Noto Color Emoji"')).then(() => true);
