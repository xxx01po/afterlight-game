// ===== timeline, shots, compositing =====
const DUR = 74.5;
const TOTAL_FRAMES = Math.round(DUR * FPS);

// ---------- helpers ----------
function roomCam(ctx, z, fx, fy, tx = W / 2, ty = H / 2) {
  // scale z around focus (fx,fy) placed at (tx,ty)
  ctx.translate(tx, ty); ctx.scale(z, z); ctx.translate(-fx, -fy);
}
function handheld(t, amt = 1) { return [nz(t * 0.7, 1) * 6 * amt, nz(t * 0.6, 2) * 6 * amt, nz(t * 0.5, 3) * 0.004 * amt]; }

const HERO_SILL = { x: 300, y: SILL_Y - 2, s: 1.45 };

function keyPos(ch) {
  // returns phone-local coords of key centre
  ch = ch.toLowerCase();
  const y0 = SCR.h - 600;
  for (let ri = 0; ri < KB_ROWS.length; ri++) {
    const row = KB_ROWS[ri], i = row.indexOf(ch);
    if (i >= 0) {
      const n = row.length, kw = 58, gap = 5.5, tw = n * kw + (n - 1) * gap, x0 = (SCR.w - tw) / 2;
      return [x0 + i * (kw + gap) + kw / 2 - SCR.w / 2, y0 + 24 + ri * 118 + 50 - SCR.h / 2];
    }
  }
  if (ch === ' ') return [340 - SCR.w / 2, y0 + 24 + 354 + 50 - SCR.h / 2];
  return [612 - SCR.w / 2, y0 + 24 + 354 + 50 - SCR.h / 2];
}
function thumbAt(t) {
  const rest = [250, 640, 0];
  const kt = CHAT.keyTimes;
  if (t < kt[0] - 0.45 || t > CHAT.typed.sent + 0.35) return rest;
  // send button press
  if (t > kt[kt.length - 1] + 0.05) {
    const sp = [625 - SCR.w / 2, SCR.h - 130 - 600 * easeOut(chatState(t).kb) + 65 - SCR.h / 2];
    const k = sseg(t, kt[kt.length - 1] + 0.05, CHAT.typed.sent - 0.05);
    const last = keyPos(CHAT.typed.text[kt.length - 1]);
    const p = [lerp(last[0], sp[0], k), lerp(last[1], sp[1], k)];
    if (t > CHAT.typed.sent) { const r = sseg(t, CHAT.typed.sent, CHAT.typed.sent + 0.35); return [lerp(p[0], rest[0], r), lerp(p[1], rest[1], r) + 20, 0]; }
    const press = Math.max(0, 1 - Math.abs(t - CHAT.typed.sent + 0.04) / 0.08);
    return [p[0] + 18, p[1] + 34, press];
  }
  let i = 0; while (i < kt.length - 1 && t > kt[i + 1] - 0.08) i++;
  const a = keyPos(CHAT.typed.text[i]);
  if (t < kt[0]) { const k = sseg(t, kt[0] - 0.45, kt[0]); return [lerp(rest[0], a[0], k) + 18, lerp(rest[1], a[1], k) + 34, 0]; }
  const b = i < kt.length - 1 ? keyPos(CHAT.typed.text[i + 1]) : a;
  const k = i < kt.length - 1 ? sseg(t, kt[i] + 0.06, kt[i + 1] - 0.06) : 0;
  const press = Math.max(0, 1 - Math.abs(t - kt[i]) / 0.07);
  const lift = Math.sin(k * Math.PI) * 18;
  return [lerp(a[0], b[0], k) + 18, lerp(a[1], b[1], k) + 34 - lift, press];
}

// ---------- shots ----------
function s1(ctx, t) {
  const lt = t;
  const z = lerp(1.0, 1.32, easeInOut(seg(lt, 0, 5)));
  const ph = sseg(t, 0.55, 0.75);
  ctx.save();
  roomCam(ctx, z, lerp(540, 420, seg(lt, 0, 5)), lerp(1000, 1150, seg(lt, 0, 5)));
  drawRoom(ctx, t, { dawn: 0, neon: 1, phone: ph }, Object.assign({}, HERO_SILL, { phone: ph, head: 0.42 }), { par: [-(z - 1) * 120, 0] });
  ctx.restore();
  coolGrade(ctx, 1);
}
function coolGrade(ctx, k) {
  POST.grade(ctx, '#1a2a6a', 'soft-light', 0.35 * k);
}
function warmGrade(ctx, k) {
  POST.grade(ctx, '#ff9a50', 'soft-light', 0.35 * k);
  POST.grade(ctx, '#3a1a10', 'lighten', 0.18 * k);
}

function chatShot(ctx, t, a, b, extra = {}) {
  const lt = t - a;
  const hh = handheld(t, 1);
  const s = (extra.s0 ?? 1.12) + (extra.push ?? 0.04) * seg(t, a, b);
  const cam = { s, x: 540 + hh[0], y: (extra.y ?? 800) + hh[1], rot: -0.015 + hh[2] };
  phoneShot(ctx, t, cam, Object.assign({ thumb: thumbAt(t), rain: 0.55 }, extra.o || {}));
  coolGrade(ctx, 1);
}
function s2chat(ctx, t) { chatShot(ctx, t, 5, 12); }

function faceBG(ctx, t, warm = 0, dark = 0) {
  drawBokehBG(ctx, t, warm, 1 - dark);
}
function s2eyes(ctx, t) {
  const lt = t - 12;
  faceBG(ctx, t);
  let look = 0;
  look = lerp(0, -0.45, sseg(lt, 0.7, 0.85));
  look = lerp(look, 0.4, sseg(lt, 1.8, 1.95));
  look = lerp(look, 0.05, sseg(lt, 2.8, 3.0));
  const blink = env4(lt, 2.45, 2.52, 2.58, 2.68);
  drawHeroFace(ctx, {
    cx: 540, cy: 1010, s: lerp(3.4, 3.75, seg(lt, 0, 3.8)), t, look: [look, 0.35], open: 0.95 - 0.12 * sseg(lt, 2.9, 3.6), brow: sseg(lt, 0.5, 3), pupil: lerp(1.15, 0.72, sseg(lt, 1.0, 1.6)),
    phone: 1, blink, rainShadow: 0.5, shake: 1.2, tilt: 0.0,
  });
  coolGrade(ctx, 1);
}
function s2face(ctx, t) {
  const lt = t - 15.8;
  faceBG(ctx, t);
  const ping = 17.3;
  const flare = 1 + 0.35 * env4(t, ping, ping + 0.08, ping + 0.3, ping + 0.9);
  drawHeroFace(ctx, {
    cx: 540, cy: 760, s: lerp(1.0, 1.06, seg(lt, 0, 2.2)), t, look: [0.05, t > ping + 0.2 ? 0.5 : 0.25], open: t > ping + 0.15 ? 1.05 : 0.85, brow: 0.9, pupil: 0.85,
    phone: flare, blink: env4(lt, 0.6, 0.66, 0.7, 0.8), rainShadow: 0.5, tilt: 0.02,
  });
  coolGrade(ctx, 1);
}
function galleryView(ctx, t, variant, a, z0, z1, header = true) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const img = MEM.photoCanvas(variant);
  const z = lerp(z0, z1, easeInOut(seg(t, a, a + 4.5)));
  const pw = 1080 * z, phh = pw * 1.2;
  ctx.save();
  ctx.translate(540, 960);
  ctx.drawImage(img, -pw / 2 + (z - 1) * 120, -phh / 2 - (z - 1) * 80, pw, phh);
  ctx.restore();
  if (header) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, 250);
    ctx.fillStyle = '#f3f4fa'; ctx.font = '600 38px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('14 октября 2022', 540, 160);
    ctx.font = '400 30px Inter'; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('21:40', 540, 208);
    ctx.textAlign = 'left';
  }
}
function s3photo(ctx, t) {
  const lt = t - 18;
  if (t < 19.35) {
    chatShot(ctx, t, 18, 19.4, { s0: 1.16, push: 0.06 });
    // tap ripple on photo
    const tp = seg(t, 19.1, 19.35);
    if (tp > 0) { ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - tp)})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(420, 1080, 40 + tp * 120, 0, TAU); ctx.stroke(); }
    return;
  }
  // photo opens full screen, then pushes in slowly (becoming the memory)
  const op = easeOut(seg(t, 19.35, 19.85));
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = op;
  ctx.translate(540, 960); ctx.scale(lerp(0.55, 1, op), lerp(0.55, 1, op)); ctx.translate(-540, -960);
  galleryView(ctx, t, 'together', 19.35, 1.0, 1.25, op > 0.9 && t < 20.4);
  ctx.restore();
  // warm creeping in
  warmGrade(ctx, sseg(t, 19.9, 21.0) * 0.6);
  coolGrade(ctx, 1 - sseg(t, 19.9, 21.0));
}
function memShot(fn, a, b) {
  return (ctx, t) => {
    const lt = t - a;
    ctx.save();
    const wx = nz(t * 6, 11) * 2, wy = nz(t * 5, 12) * 2;   // gate weave
    ctx.translate(wx, wy);
    fn(ctx, lt, b - a);
    ctx.restore();
    warmGrade(ctx, 1);
    // soft edges / haze
    const g = ctx.createRadialGradient(540, 960, 500, 540, 960, 1150);
    g.addColorStop(0, 'rgba(255,190,130,0)'); g.addColorStop(1, 'rgba(255,190,130,0.28)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // light leak
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const lx = 900 + Math.sin(t * 0.7) * 200, ly = 300 + Math.cos(t * 0.5) * 300;
    glowDot(ctx, lx, ly, 700, [255, 120, 50], 0.22 + 0.1 * Math.sin(t * 1.3));
    ctx.restore();
  };
}
const m1 = memShot(MEM.walk, 20.6, 23.8);
const m2 = memShot(MEM.laugh, 23.2, 26.0);
const m3 = memShot(MEM.hug, 25.4, 28.2);
const m4 = memShot(MEM.busStop, 27.6, 30.6);
const m5base = memShot(MEM.hands, 30.0, 33.0);
function m5(ctx, t) {
  m5base(ctx, t);
  // headlights glare sweeping in at the end
  const g = sseg(t, 32.3, 32.98);
  if (g > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    glowDot(ctx, 1000, 900, 400 + g * 1800, [255, 250, 235], Math.min(1, g * 1.4));
    glowDot(ctx, 1150, 1000, 300 + g * 1000, [255, 255, 250], g);
    ctx.restore();
    ctx.fillStyle = `rgba(255,252,245,${easeIn(g)})`; ctx.fillRect(0, 0, W, H);
  }
}
function s3face(ctx, t) {
  const lt = t - 33;
  faceBG(ctx, t);
  // lips for "Это невозможно…"
  const sp = seg(t, 33.45, 34.55);
  const mouth = sp > 0 && sp < 1 ? Math.abs(Math.sin(sp * Math.PI * 5)) * 0.55 : 0;
  drawHeroFace(ctx, {
    cx: 540, cy: 800, s: lerp(1.12, 1.18, seg(lt, 0, 2)), t, look: [0.0, 0.45], open: 0.92, brow: 1, pupil: 0.8, wet: 0.5,
    phone: 1, mouth, rainShadow: 0.5, shake: 0.6,
  });
  coolGrade(ctx, 1);
}
function s4chat(ctx, t) { chatShot(ctx, t, 35, 39.6, { s0: 1.12, push: 0.05 }); }
function s4side(ctx, t) {
  const off = 40.3, back = 42.8;
  let ph = t < off ? 1 : 0;
  if (t >= back) ph = clamp((t - back) / 0.12) * (0.85 + 0.15 * Math.sin(t * 60)) * (t < back + 0.4 ? (hash1(Math.floor(t * 30)) > 0.3 ? 1 : 0.4) : 1);
  const startle = env4(t, back + 0.05, back + 0.2, back + 0.6, back + 1.1);
  const z = lerp(2.25, 2.4, seg(t, 39.6, 44));
  ctx.save();
  roomCam(ctx, z, 450, 1110, 560, 960);
  drawRoom(ctx, t, { dawn: 0, neon: ph > 0 ? 1 : 0.7, phone: ph }, Object.assign({}, HERO_SILL, { phone: ph, head: 0.45 - (t > off && t < back ? 0.1 * sseg(t, off, off + 1) : 0), startle }), {});
  ctx.restore();
  // room darkens when phone is off
  const dark = (t > off && t < back) ? 0.35 * sseg(t, off, off + 0.25) : 0;
  ctx.fillStyle = `rgba(0,0,8,${dark})`; ctx.fillRect(0, 0, W, H);
  coolGrade(ctx, 1);
}
function s4chat2(ctx, t) { chatShot(ctx, t, 44, 50, { s0: 1.1, push: 0.12, o: { on: clamp((t - 44) / 0.1) } }); }
function s5photo(ctx, t) {
  const op = 0.35 + 0.65 * easeOut(seg(t, 50, 50.5));
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalAlpha = op;
  galleryView(ctx, t, 'alone', 50, 1.0, 1.32, t < 51);
  // ghost flicker: for a few frames, she is still there
  const fl = (t > 51.55 && t < 51.68) || (t > 51.8 && t < 51.85);
  if (fl) { ctx.globalAlpha = 0.28; galleryView(ctx, t, 'together', 50, 1.0, 1.32, false); }
  ctx.restore();
  POST.grade(ctx, '#2a3a6a', 'soft-light', 0.25);
}
function s5face(ctx, t) {
  const lt = t - 54.5;
  faceBG(ctx, t);
  drawHeroFace(ctx, {
    cx: 540, cy: 780, s: lerp(1.05, 1.16, seg(lt, 0, 3.5)), t, look: [0.0, 0.5], open: 0.82, brow: 0.7, pupil: 1.0, wet: 0.7,
    phone: 0.9, blink: env4(lt, 1.6, 1.68, 1.72, 1.86), rainShadow: 0.5,
  });
  coolGrade(ctx, 1);
}
function s5chat(ctx, t) { chatShot(ctx, t, 58, 61, { s0: 1.14, push: 0.06 }); }
function s5cu(ctx, t) {
  const lt = t - 61;
  const warm = sseg(t, 63.6, 65.4);
  faceBG(ctx, t, warm * 0.6);
  drawHeroFace(ctx, {
    cx: 540, cy: 900, s: lerp(1.5, 1.62, seg(lt, 0, 4.4)), t, look: [0.0, 0.45], open: lerp(0.82, 0, sseg(t, 61.8, 62.5)), brow: lerp(0.7, 0.3, sseg(t, 62.5, 64.5)), pupil: 1.0, wet: 0.8,
    phone: lerp(0.9, 0.3, sseg(t, 63, 65)), tear: seg(t, 62.4, 64.9), rainShadow: 0.6, tilt: -0.02 * sseg(t, 62, 64),
    warm: warm * 0.5, key: [[255, 190, 130], 0.45 * warm],
  });
  coolGrade(ctx, 1 - warm);
  warmGrade(ctx, warm * 0.5);
}
function s6(ctx, t) {
  const lt = t - 64.6;
  const k = easeInOut(seg(t, 65.0, 71.5));
  const z = lerp(3.2, 1.0, k);
  const fx = lerp(700, 540, k), fy = lerp(1800, 960, k);
  ctx.save();
  roomCam(ctx, z, fx, fy);
  drawRoom(ctx, t, { dawn: 1, neon: 0, phone: 0 }, Object.assign({}, HERO_SILL, { phone: 0, head: -0.05, eyes: 'closed', arms: 'knees', breathe: 0.6, noPhone: true }), { deskItems: true, photoImg: MEM.photoCanvas('together'), drops: 0.55 });
  ctx.restore();
  // dust motes in light
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const d of POST.dust) {
    const x = (d[0] * W + Math.sin(t * 0.3 + d[2] * 9) * 30 + t * 6) % W;
    const y = (d[1] * H - t * (8 + d[3] * 10) + H * 4) % H;
    const a = 0.25 + 0.35 * Math.sin(t * 1.5 + d[2] * 20);
    if (a > 0) { ctx.fillStyle = `rgba(255,225,180,${a * 0.6})`; ctx.beginPath(); ctx.arc(x, y, 1 + d[3] * 2.5, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
  warmGrade(ctx, 0.7);
}

// shot list: [start, end, fn, transitionStyle-into]
const SHOTS = [
  [0, 5.0, s1],
  [5.0, 12.0, s2chat],
  [12.0, 15.8, s2eyes],
  [15.8, 18.0, s2face],
  [18.0, 21.3, s3photo],
  [20.6, 23.8, m1, 'dream'],
  [23.2, 26.0, m2, 'dream'],
  [25.4, 28.2, m3, 'dream'],
  [27.6, 30.6, m4, 'dream'],
  [30.0, 33.0, m5, 'dream'],
  [33.0, 35.0, s3face],
  [35.0, 39.6, s4chat],
  [39.6, 44.0, s4side],
  [44.0, 50.0, s4chat2],
  [50.0, 54.5, s5photo],
  [54.5, 58.0, s5face],
  [58.0, 61.0, s5chat],
  [61.0, 65.4, s5cu],
  [64.6, DUR, s6, 'dawn'],
];

// ---------- overlays ----------
function notifBanner(ctx, t) {
  const a = 1.0;
  if (t < a || t > 5) return;
  const p = easeOut(seg(t, a, a + 0.45));
  const spring = Math.sin(seg(t, a, a + 0.6) * Math.PI) * 12 * (1 - seg(t, a + 0.3, a + 0.6));
  const y = lerp(-260, 150, p) + spring;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16;
  ctx.fillStyle = 'rgba(30,32,46,0.86)';
  rrect(ctx, 50, y, 980, 210, 52); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2; ctx.stroke();
  // app icon
  const ig = ctx.createLinearGradient(90, y + 40, 190, y + 140);
  ig.addColorStop(0, '#5b86ff'); ig.addColorStop(1, '#3a52d8');
  ctx.fillStyle = ig; rrect(ctx, 86, y + 50, 108, 108, 28); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(140, y + 100, 30, 24, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(122, y + 114); ctx.lineTo(116, y + 132); ctx.lineTo(136, y + 120); ctx.fill();
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f3f4fa'; ctx.font = '600 38px Inter'; ctx.fillText('Неизвестный номер', 226, y + 72);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '400 30px Inter'; ctx.textAlign = 'right'; ctx.fillText('сейчас', 990, y + 72); ctx.textAlign = 'left';
  ctx.fillStyle = '#f3f4fa'; ctx.font = '400 44px Inter'; ctx.fillText('Ты ещё не спишь?', 226, y + 140);
  ctx.restore();
}
function subtitle(ctx, t, text, a, b, y = 1440) {
  const k = env4(t, a, a + 0.3, b - 0.3, b);
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = k;
  ctx.font = 'italic 500 76px Corm';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 24;
  ctx.fillStyle = '#eef2ff';
  ctx.fillText(text, 540, y);
  ctx.restore();
}
function finalText(ctx, t) {
  const k = env4(t, 68.2, 69.4, 71.6, 72.4);
  if (k <= 0) return;
  ctx.save();
  // soft dark band for readability
  const g = ctx.createLinearGradient(0, 520, 0, 1100);
  g.addColorStop(0, 'rgba(40,20,20,0)'); g.addColorStop(0.5, `rgba(40,18,20,${0.42 * k})`); g.addColorStop(1, 'rgba(40,20,20,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 520, W, 580);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(60,20,10,0.8)'; ctx.shadowBlur = 30;
  const lines = ['Иногда самое сложное —', 'отпустить то,', 'чего больше нет'];
  ctx.font = 'italic 500 84px Corm';
  lines.forEach((ln, i) => {
    const kk = env4(t, 68.2 + i * 0.35, 69.4 + i * 0.35, 71.6, 72.4);
    ctx.globalAlpha = kk;
    ctx.fillStyle = '#fff6ea';
    ctx.fillText(ln, 540, 700 + i * 104 + (1 - kk) * 14);
  });
  ctx.restore();
}
function endCard(ctx, t) {
  const k = env4(t, 72.7, 73.2, 74.0, 74.4);
  if (k <= 0) return;
  ctx.save(); ctx.globalAlpha = k;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e9e4dc';
  ctx.font = '600 60px Corm';
  ctx.letterSpacing = '10px';
  ctx.fillText('ПОСЛЕДНЕЕ СООБЩЕНИЕ', 545, 910);
  ctx.font = '500 30px Inter'; ctx.fillStyle = 'rgba(233,228,220,0.55)';
  ctx.letterSpacing = '18px';
  ctx.fillText('ZERO', 549, 1010);
  ctx.restore();
}

// ---------- frame renderer ----------
let bufA, bufB, main, mctx;
function renderShotInto(buf, shot, t) {
  const c = buf.getContext('2d');
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  shot[2](c, t);
  c.restore();
}
function renderFrame(frame) {
  const t = frame / FPS;
  const active = SHOTS.filter(s => t >= s[0] && t < s[1]);
  mctx.save();
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.globalAlpha = 1; mctx.globalCompositeOperation = 'source-over'; mctx.filter = 'none';
  mctx.fillStyle = '#000'; mctx.fillRect(0, 0, W, H);
  if (active.length === 1) {
    renderShotInto(bufA, active[0], t);
    mctx.drawImage(bufA, 0, 0);
  } else if (active.length >= 2) {
    const [sa, sb] = active.slice(-2);
    const p = smooth((t - sb[0]) / (sa[1] - sb[0]));
    renderShotInto(bufA, sa, t);
    renderShotInto(bufB, sb, t);
    const style = sb[3] || 'cross';
    const bump = Math.sin(p * Math.PI);
    if (style === 'dream') mctx.filter = `blur(${(bump * 7).toFixed(1)}px)`;
    mctx.drawImage(bufA, 0, 0);
    mctx.globalAlpha = p;
    mctx.drawImage(bufB, 0, 0);
    mctx.globalAlpha = 1; mctx.filter = 'none';
    if (style === 'dream' || style === 'dawn') {
      mctx.globalCompositeOperation = 'screen';
      mctx.fillStyle = style === 'dawn' ? `rgba(255,220,170,${bump * 0.55})` : `rgba(255,190,120,${bump * 0.3})`;
      mctx.fillRect(0, 0, W, H);
      mctx.globalCompositeOperation = 'source-over';
    }
  }
  // look-dependent post
  const inMem = t >= 20.6 && t < 33.0;
  const dawn = t >= 64.6;
  POST.bloom(mctx, main, inMem ? 0.55 : dawn ? 0.6 : 0.65, inMem ? 0.5 : 0.45, null);
  POST.vignette(mctx, inMem ? 0.45 : 0.6, inMem ? '40,15,5' : '0,0,6');
  // overlays (in-world text)
  notifBanner(mctx, t);
  subtitle(mctx, t, '— Это невозможно…', 33.4, 35.0);
  finalText(mctx, t);
  POST.grainFx(mctx, frame, inMem ? 0.14 : 0.08);
  if (inMem) POST.dustFx(mctx, frame, 0.8);
  // fade from black at start, to black at end
  const fadeIn = 0;
  const fadeOut = sseg(t, 71.9, 72.6);
  const blk = Math.max(fadeIn, fadeOut);
  if (blk > 0) { mctx.fillStyle = `rgba(0,0,0,${blk})`; mctx.fillRect(0, 0, W, H); }
  endCard(mctx, t);
  mctx.restore();
}

// ---------- audio cue export ----------
window.CUES = {
  duration: DUR,
  vibrate: [0.55],
  notif: [1.0],
  msgIn: CHAT.msgs.filter(m => m.side === 'in').map(m => m.at),
  keys: CHAT.keyTimes,
  send: CHAT.typed.sent,
  photoOpen: 19.35,
  memStart: 20.6,
  flash: 32.3, cutToPresent: 33.0,
  powerOff: 40.3, screenBack: 42.8,
  ghostFlicker: 51.55,
  eyesClose: 61.8, tear: 62.4,
  dawn: 64.6, finalText: 68.2, fadeOut: 71.9, endCard: 72.7,
  rustle: [0.3, 39.9, 42.9, 61.2, 66.0],
  heartbeat: [12.4, 13.2, 14.0, 14.8, 15.6],
};

window.FILM = {
  ready: false,
  async init() {
    await document.fonts.load('500 40px Inter'); await document.fonts.load('600 40px Inter'); await document.fonts.load('400 40px Inter');
    await document.fonts.load('italic 500 40px Corm'); await document.fonts.load('600 40px Corm');
    await document.fonts.load('italic 500 40px Corm', 'Это'); await document.fonts.load('600 40px Corm', 'ПОСЛ');
    main = document.getElementById('c');
    mctx = main.getContext('2d', { willReadFrequently: false });
    bufA = mkCanvas(W, H); bufB = mkCanvas(W, H);
    POST.init(); ENV.init();
    MEM.photoCanvas('together'); MEM.photoCanvas('alone');
    this.ready = true;
  },
  render(frame) { renderFrame(frame); },
  total: TOTAL_FRAMES,
};

// ---------- TikTok cover ----------
FILM.cover = function () {
  const t = 16.4;
  mctx.save();
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBokehBG(mctx, t, 0, 1);
  drawHeroFace(mctx, { cx: 540, cy: 1060, s: 1.12, t, look: [0.05, 0.45], open: 0.95, brow: 1, pupil: 0.8, wet: 0.6, phone: 1.15, rainShadow: 0.5 });
  coolGrade(mctx, 1);
  POST.bloom(mctx, main, 0.6, 0.45, null);
  POST.vignette(mctx, 0.65, '0,0,6');
  // message bubble
  mctx.save();
  mctx.shadowColor = 'rgba(0,0,0,0.6)'; mctx.shadowBlur = 40;
  mctx.fillStyle = 'rgba(37,37,47,0.95)'; rrect(mctx, 110, 300, 860, 230, 60); mctx.fill();
  mctx.shadowColor = 'transparent';
  mctx.fillStyle = 'rgba(255,255,255,0.5)'; mctx.font = '500 34px Inter'; mctx.fillText('Неизвестный номер · 3:17', 170, 365);
  mctx.fillStyle = '#f3f4fa'; mctx.font = '600 64px Inter'; mctx.fillText('Ты ещё не спишь?', 170, 455);
  mctx.restore();
  // title
  mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
  mctx.shadowColor = 'rgba(0,0,0,0.9)'; mctx.shadowBlur = 30;
  mctx.fillStyle = '#ffffff'; mctx.font = '600 104px Corm';
  mctx.fillText('ПОСЛЕДНЕЕ', 540, 1440); mctx.fillText('СООБЩЕНИЕ', 540, 1550);
  mctx.font = '500 34px Inter'; mctx.fillStyle = 'rgba(255,255,255,0.7)'; mctx.letterSpacing = '16px';
  mctx.fillText('ZERO', 548, 1650);
  mctx.restore();
};
