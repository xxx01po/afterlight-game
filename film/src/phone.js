// ===== phone + messenger UI =====
const CHAT = {
  msgs: [
    { side: 'in', text: 'Ты ещё не спишь?', at: 1.0 },
    { side: 'out', text: 'Кто это?', at: 7.35 },
    { side: 'in', text: 'Ты обещал, что никогда меня не забудешь.', at: 9.7 },
    { side: 'in', kind: 'photo', at: 17.3, loaded: 18.7 },
    { side: 'in', text: 'Ты ведь помнишь, что произошло в тот вечер?', at: 36.0 },
    { side: 'in', text: 'Ты не виноват, что тогда не смог меня спасти.', at: 45.0 },
    { side: 'in', text: 'Пора отпустить меня.', at: 58.6 },
  ],
  typingIn: [[8.2, 9.7], [16.2, 17.3], [35.0, 36.0], [44.0, 45.0], [57.6, 58.6]],
  typed: { text: 'Кто это?', from: 5.55, to: 7.0, sent: 7.35 },
  keyboard: [5.15, 7.6],
};
CHAT.keyTimes = (() => {
  const n = CHAT.typed.text.length, a = [];
  for (let i = 0; i < n; i++) a.push(CHAT.typed.from + (CHAT.typed.to - CHAT.typed.from) * (i / (n - 1)) + (i === 3 ? 0.08 : 0));
  return a;
})();

const SCR = { w: 700, h: 1500 };   // screen size in phone-local units

function chatState(t) {
  const typingIn = CHAT.typingIn.some(([a, b]) => t >= a && t < b);
  const kb = env4(t, CHAT.keyboard[0], CHAT.keyboard[0] + 0.35, CHAT.keyboard[1], CHAT.keyboard[1] + 0.35);
  let typedN = 0;
  CHAT.keyTimes.forEach((kt) => { if (t >= kt) typedN++; });
  if (t >= CHAT.typed.sent) typedN = 0;
  let pressed = -1;
  CHAT.keyTimes.forEach((kt, i) => { if (t >= kt - 0.06 && t < kt + 0.1) pressed = i; });
  return { typingIn, kb, input: CHAT.typed.text.slice(0, typedN), pressed };
}

function bubbleLayout(ctx, m) {
  ctx.font = '500 40px Inter';
  if (m.kind === 'photo') return { w: 440, h: 540, lines: [] };
  const lines = wrapText(ctx, m.text, 470);
  const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 64 + (m.side === 'out' ? 70 : 0);
  return { w: Math.max(w, m.side === 'out' ? 0 : 170), h: lines.length * 54 + 52, lines };
}

// draw screen content into ctx (origin top-left of screen)
function drawScreen(ctx, t, o = {}) {
  const st = chatState(t);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, SCR.w, SCR.h); ctx.clip();
  // wallpaper
  const g = ctx.createLinearGradient(0, 0, SCR.w, SCR.h);
  g.addColorStop(0, '#0d1022'); g.addColorStop(1, '#141028');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SCR.w, SCR.h);
  ctx.globalAlpha = 0.06; ctx.strokeStyle = '#8aa0ff'; ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc(80 + (i % 4) * 190, 300 + Math.floor(i / 4) * 380, 50, 0, TAU); ctx.stroke(); }
  ctx.globalAlpha = 1;

  const kbH = 600 * easeOut(st.kb);
  const inputY = SCR.h - 130 - kbH;
  // messages, bottom anchored
  let y = inputY - 30;
  const vis = CHAT.msgs.filter(m => t >= m.at);
  for (let i = vis.length - 1; i >= 0; i--) {
    const m = vis[i];
    const L = bubbleLayout(ctx, m);
    const ap = easeOut(seg(t, m.at, m.at + 0.35));
    const hh = (L.h + 22) * ap;
    // typing indicator occupies space if active & this is the newest
    y -= hh;
    if (y + L.h < 150) break;
    ctx.save();
    const bx = m.side === 'in' ? 28 : SCR.w - 28 - L.w;
    ctx.globalAlpha = ap;
    const sc = 0.85 + 0.15 * ap;
    ctx.translate(m.side === 'in' ? bx : bx + L.w, y + L.h);
    ctx.scale(sc, sc);
    ctx.translate(m.side === 'in' ? 0 : -L.w, -L.h);
    ctx.fillStyle = m.side === 'in' ? '#25252f' : '#3d6cf2';
    rrect(ctx, 0, 0, L.w, L.h, 38); ctx.fill();
    if (m.kind === 'photo') {
      drawPhotoBubble(ctx, t, m, L);
    } else {
      ctx.fillStyle = '#f3f4fa'; ctx.font = '500 40px Inter'; ctx.textBaseline = 'top';
      L.lines.forEach((ln, k) => ctx.fillText(ln, 32, 26 + k * 54));
      ctx.font = '400 24px Inter'; ctx.fillStyle = m.side === 'in' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.7)';
      ctx.textAlign = 'right';
      const stamp = m.side === 'out' ? '3:17 ✓✓' : (m.at > 30 ? '3:24' : m.at > 15 ? '3:19' : '3:17');
      ctx.fillText(stamp, L.w - 24, L.h - 34);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }
  // incoming typing indicator bubble
  if (st.typingIn) {
    const yy = inputY - 30 - 90;
    ctx.fillStyle = '#25252f'; rrect(ctx, 28, yy, 150, 80, 38); ctx.fill();
    for (let k = 0; k < 3; k++) {
      const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 7 - k * 0.9));
      ctx.fillStyle = `rgba(230,232,245,${a})`;
      ctx.beginPath(); ctx.arc(70 + k * 34, yy + 40, 10, 0, TAU); ctx.fill();
    }
  }
  // header
  ctx.fillStyle = 'rgba(14,15,28,0.96)'; ctx.fillRect(0, 0, SCR.w, 200);
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, 199, SCR.w, 2);
  ctx.fillStyle = '#f3f4fa'; ctx.font = '600 30px Inter'; ctx.textBaseline = 'middle';
  ctx.fillText(t > 60 ? '6:12' : (t > 30 ? '3:24' : '3:17'), 50, 44);
  // battery/signal
  ctx.fillRect(560, 36, 50, 18); ctx.fillStyle = '#0e0f1c'; ctx.fillRect(589, 39, 18, 12);
  ctx.fillStyle = '#f3f4fa'; for (let i = 0; i < 4; i++) ctx.fillRect(490 + i * 12, 54 - i * 6, 8, 6 + i * 6);
  // back chevron
  ctx.strokeStyle = '#6f8cff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(52, 118); ctx.lineTo(34, 138); ctx.lineTo(52, 158); ctx.stroke();
  // avatar
  ctx.fillStyle = '#3a3a48'; ctx.beginPath(); ctx.arc(116, 138, 38, 0, TAU); ctx.fill();
  ctx.fillStyle = '#9a9aac'; ctx.font = '600 38px Inter'; ctx.textAlign = 'center'; ctx.fillText('?', 116, 140); ctx.textAlign = 'left';
  ctx.fillStyle = '#f3f4fa'; ctx.font = '600 34px Inter'; ctx.fillText('Неизвестный номер', 172, 122);
  ctx.font = '400 26px Inter';
  if (st.typingIn) { ctx.fillStyle = '#6f8cff'; ctx.fillText('печатает…', 172, 160); }
  else { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillText('был(а) в сети давно', 172, 160); }
  // input bar
  ctx.fillStyle = 'rgba(14,15,28,0.98)'; ctx.fillRect(0, inputY, SCR.w, SCR.h - inputY);
  ctx.fillStyle = '#20212e'; rrect(ctx, 28, inputY + 24, 540, 82, 41); ctx.fill();
  ctx.font = '400 36px Inter'; ctx.textBaseline = 'middle';
  if (st.input) {
    ctx.fillStyle = '#f3f4fa'; ctx.fillText(st.input, 60, inputY + 66);
    const cw = ctx.measureText(st.input).width;
    if (Math.floor(t * 2.5) % 2 === 0) ctx.fillRect(64 + cw, inputY + 44, 3, 44);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillText('Сообщение', 60, inputY + 66);
  }
  // send button
  ctx.fillStyle = st.input ? '#3d6cf2' : '#2a2b3a';
  ctx.beginPath(); ctx.arc(625, inputY + 65, 41, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(608, inputY + 50); ctx.lineTo(645, inputY + 65); ctx.lineTo(608, inputY + 80); ctx.lineTo(614, inputY + 65); ctx.closePath(); ctx.fill();
  // keyboard
  if (kbH > 1) drawKeyboard(ctx, SCR.h - kbH, st);
  ctx.restore();
}

const KB_ROWS = ['йцукенгшщзх', 'фывапролджэ', 'ячсмитьбю'];
function drawKeyboard(ctx, y0, st) {
  ctx.fillStyle = '#1a1b26'; ctx.fillRect(0, y0, SCR.w, 600);
  const pressedCh = st.pressed >= 0 ? CHAT.typed.text[st.pressed].toLowerCase() : null;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  KB_ROWS.forEach((row, ri) => {
    const n = row.length, kw = 58, gap = 5.5;
    const tw = n * kw + (n - 1) * gap;
    const x0 = (SCR.w - tw) / 2;
    for (let i = 0; i < n; i++) {
      const ch = row[i];
      const x = x0 + i * (kw + gap), y = y0 + 24 + ri * 118;
      const p = ch === pressedCh;
      ctx.fillStyle = p ? '#5a5d74' : '#33354a';
      rrect(ctx, x, y, kw, 100, 10); ctx.fill();
      ctx.fillStyle = '#f0f0f6'; ctx.font = '400 38px Inter';
      ctx.fillText(ch, x + kw / 2, y + 52);
      if (p) { // key pop-up
        ctx.fillStyle = '#6a6d86'; rrect(ctx, x - 14, y - 120, kw + 28, 120, 14); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '500 56px Inter'; ctx.fillText(ch, x + kw / 2, y - 60);
      }
    }
  });
  // space bar row
  const y = y0 + 24 + 3 * 118;
  const spaceP = st.pressed >= 0 && CHAT.typed.text[st.pressed] === ' ';
  ctx.fillStyle = '#26283a'; rrect(ctx, 18, y, 120, 100, 10); ctx.fill();
  ctx.fillStyle = spaceP ? '#5a5d74' : '#33354a'; rrect(ctx, 150, y, 380, 100, 10); ctx.fill();
  const qP = st.pressed >= 0 && CHAT.typed.text[st.pressed] === '?';
  ctx.fillStyle = qP ? '#5a5d74' : '#26283a'; rrect(ctx, 542, y, 140, 100, 10); ctx.fill();
  ctx.fillStyle = '#c8c9d6'; ctx.font = '400 30px Inter';
  ctx.fillText('123', 78, y + 52); ctx.fillText('пробел', 340, y + 52); ctx.fillText('. , ?', 612, y + 52);
  ctx.textAlign = 'left';
}

function drawPhotoBubble(ctx, t, m, L) {
  const img = MEM.photoCanvas(t > 49 ? 'alone' : 'together');
  ctx.save();
  rrect(ctx, 10, 10, L.w - 20, L.h - 20, 30); ctx.clip();
  const ld = seg(t, m.loaded - 0.6, m.loaded);
  if (ld < 1) {
    ctx.filter = `blur(${(1 - ld) * 22}px)`;
  }
  ctx.drawImage(img, 10, 10, L.w - 20, L.h - 20);
  ctx.filter = 'none';
  if (ld < 1) {
    ctx.fillStyle = `rgba(10,10,20,${0.5 * (1 - ld)})`; ctx.fillRect(0, 0, L.w, L.h);
    // progress ring
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    const a = seg(t, m.at, m.loaded) * TAU;
    ctx.beginPath(); ctx.arc(L.w / 2, L.h / 2, 46, -Math.PI / 2, -Math.PI / 2 + a); ctx.stroke();
  }
  ctx.restore();
}

// whole phone object at origin (center), phone-local units: 760x1580
function drawPhoneDevice(ctx, t, o = {}) {
  const PW = 760, PH = 1580;
  ctx.save();
  // body shadow
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30;
  ctx.fillStyle = '#0a0a10'; rrect(ctx, -PW / 2, -PH / 2, PW, PH, 96); ctx.fill();
  ctx.shadowColor = 'transparent';
  // metal edge
  ctx.strokeStyle = '#3a3c4c'; ctx.lineWidth = 6; rrect(ctx, -PW / 2 + 3, -PH / 2 + 3, PW - 6, PH - 6, 94); ctx.stroke();
  // screen
  const sx = -SCR.w / 2, sy = -SCR.h / 2;
  ctx.save();
  rrect(ctx, sx, sy, SCR.w, SCR.h, 70); ctx.clip();
  const on = o.on ?? 1;
  if (on > 0) {
    ctx.translate(sx, sy);
    if (o.screenFn) o.screenFn(ctx, t); else drawScreen(ctx, t, o);
    ctx.translate(-sx, -sy);
    if (on < 1) { ctx.fillStyle = `rgba(2,2,4,${1 - on})`; ctx.fillRect(sx, sy, SCR.w, SCR.h); }
  } else {
    ctx.fillStyle = '#030306'; ctx.fillRect(sx, sy, SCR.w, SCR.h);
  }
  // glass reflection + rain on glass reflection
  const rg = ctx.createLinearGradient(sx, sy, sx + SCR.w, sy + SCR.h);
  rg.addColorStop(0, 'rgba(255,255,255,0.06)'); rg.addColorStop(0.4, 'rgba(255,255,255,0)'); rg.addColorStop(0.7, 'rgba(255,120,220,0.03)'); rg.addColorStop(1, 'rgba(120,200,255,0.05)');
  ctx.fillStyle = rg; ctx.fillRect(sx, sy, SCR.w, SCR.h);
  if (o.reflect) o.reflect(ctx, sx, sy);
  if (o.rain !== 0) drawRainShadow(ctx, t, sx, sy, SCR.w, SCR.h, (o.rain ?? 0.6), 1);
  ctx.restore();
  // dynamic island
  ctx.fillStyle = '#000'; rrect(ctx, -70, sy + 22, 140, 40, 20); ctx.fill();
  ctx.restore();
}

// bokeh background for phone close-ups (out-of-focus window + room)
function drawBokehBG(ctx, t, warm = 0, k = 1) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, col(mix3([10, 10, 26], [60, 40, 40], warm)));
  g.addColorStop(1, col(mix3([4, 4, 12], [30, 20, 20], warm)));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of ENV.bokeh) {
    const c = b.c < 0.33 ? [255, 60, 180] : b.c < 0.66 ? [70, 170, 255] : [255, 180, 100];
    const cc = mix3(c, [255, 190, 120], warm);
    const x = b.x * W + Math.sin(t * 0.2 + b.ph) * 20, y = b.y * H * 0.8 + Math.cos(t * 0.15 + b.ph) * 14;
    const a = b.a * k * (0.75 + 0.25 * Math.sin(t * 0.9 + b.ph));
    ctx.fillStyle = col(cc, a * 0.12);
    ctx.beginPath(); ctx.arc(x, y, b.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = col(cc, a * 0.12); ctx.lineWidth = 3; ctx.stroke();
  }
  ctx.restore();
}

// complete phone close-up shot; cam {s, x, y, rot}
function phoneShot(ctx, t, cam, o = {}) {
  drawBokehBG(ctx, t, o.warm || 0, o.bokeh ?? 1);
  ctx.save();
  ctx.translate(cam.x, cam.y); ctx.rotate(cam.rot || 0); ctx.scale(cam.s, cam.s);
  drawHandsBack(ctx, o.warm || 0);
  drawPhoneDevice(ctx, t, o);
  drawFingersFront(ctx, o.warm || 0, o.on ?? 1, o.thumb);
  ctx.restore();
  // screen glow spill into lens
  const on = o.on ?? 1;
  if (on > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glowDot(ctx, cam.x, cam.y, 900 * cam.s, [60, 90, 200], 0.12 * on);
    ctx.restore();
  }
}
