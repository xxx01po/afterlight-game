// ===== environments: city, rain, glass, room =====
const ENV = {};

// City view region in "room space" (room space == frame space at camera scale 1)
const WIN = { x: 130, y: 250, w: 860, h: 1240 };   // glass opening
const MULL_X = 760;                                 // vertical mullion
const TRANS_Y = 560;                                // transom
const SILL_Y = 1490;

function cityLayer(seed, w, h, p) {
  const c = mkCanvas(w, h), x = c.getContext('2d');
  const r = mulberry32(seed);
  let bx = -20;
  while (bx < w) {
    const bw = p.bw[0] + r() * (p.bw[1] - p.bw[0]);
    const bh = p.minH + Math.pow(r(), 1.3) * (p.maxH - p.minH);
    const top = h - bh;
    // body
    const g = x.createLinearGradient(0, top, 0, h);
    g.addColorStop(0, p.top); g.addColorStop(1, p.bot);
    x.fillStyle = g;
    x.fillRect(bx, top, bw, bh);
    // roof details
    if (r() < 0.35) { x.fillRect(bx + bw * 0.3, top - 18 - r() * 30, bw * 0.25, 40); }
    if (r() < 0.3) { x.fillRect(bx + bw * 0.6, top - 60 - r() * 60, 3, 80); p.antennas && p.antennas.push([bx + bw * 0.6 + 1.5, top - 60]); }
    if (r() < 0.25) { // stepped top
      x.fillRect(bx + bw * 0.15, top - 30, bw * 0.7, 32);
    }
    // windows
    const ww = p.win[0], wh = p.win[1], gapx = p.win[2], gapy = p.win[3];
    const cols = Math.floor((bw - gapx) / (ww + gapx));
    const offx = (bw - cols * (ww + gapx) + gapx) / 2;
    const style = r();
    for (let yy = top + 14; yy < h - 6; yy += wh + gapy) {
      for (let i = 0; i < cols; i++) {
        const q = r();
        if (q < p.lit) {
          const warm = r() < p.warmRatio;
          const lc = warm ? p.litWarm : p.litCool;
          const a = 0.35 + r() * 0.65;
          x.fillStyle = col(lc, a * p.litAlpha);
          x.fillRect(bx + offx + i * (ww + gapx), yy, ww, wh);
        } else if (q < p.lit + 0.25) {
          x.fillStyle = col(p.dimWin, 0.5);
          x.fillRect(bx + offx + i * (ww + gapx), yy, ww, wh);
        }
      }
    }
    // edge light
    x.fillStyle = p.edge;
    x.fillRect(bx + bw - 2, top, 2, bh);
    bx += bw + p.gap[0] + r() * (p.gap[1] - p.gap[0]);
  }
  return c;
}

ENV.init = function () {
  const night = {
    far: { bw: [40, 110], minH: 280, maxH: 900, top: '#1b2140', bot: '#141833', win: [5, 7, 5, 7], lit: 0.22, warmRatio: 0.55, litWarm: [255, 196, 120], litCool: [150, 200, 255], litAlpha: 0.75, dimWin: [40, 48, 80], edge: 'rgba(120,140,255,0.15)', gap: [0, 10] },
    mid: { bw: [110, 230], minH: 300, maxH: 1100, top: '#10132a', bot: '#0b0d1e', win: [12, 16, 10, 12], lit: 0.18, warmRatio: 0.6, litWarm: [255, 190, 110], litCool: [130, 190, 255], litAlpha: 0.9, dimWin: [26, 30, 58], edge: 'rgba(255,80,200,0.25)', gap: [10, 50] },
  };
  ENV.antFar = []; ENV.antMid = [];
  night.far.antennas = ENV.antFar; night.mid.antennas = ENV.antMid;
  ENV.cityFar = cityLayer(11, 1400, 1300, night.far);
  ENV.cityMid = cityLayer(23, 1500, 1200, night.mid);
  const dawn = {
    far: { bw: [40, 110], minH: 280, maxH: 900, top: '#8c7a9c', bot: '#a98a95', win: [5, 7, 5, 7], lit: 0.03, warmRatio: 1, litWarm: [255, 220, 170], litCool: [255, 220, 170], litAlpha: 0.6, dimWin: [150, 130, 150], edge: 'rgba(255,220,180,0.3)', gap: [0, 10] },
    mid: { bw: [110, 230], minH: 300, maxH: 1100, top: '#4c3f5e', bot: '#3a2f48', win: [12, 16, 10, 12], lit: 0.04, warmRatio: 1, litWarm: [255, 210, 150], litCool: [255, 210, 150], litAlpha: 0.8, dimWin: [80, 66, 92], edge: 'rgba(255,200,140,0.5)', gap: [10, 50] },
  };
  ENV.cityFarD = cityLayer(11, 1400, 1300, dawn.far);
  ENV.cityMidD = cityLayer(23, 1500, 1200, dawn.mid);
  // blurred whole-window plate cache (built lazily per variant)
  ENV.plates = {};
  // glass drops
  const r = mulberry32(5);
  ENV.drops = [];
  for (let i = 0; i < 230; i++) {
    const s = Math.pow(r(), 2.2);
    ENV.drops.push({ x: r(), y: r(), r: 2 + s * 13, e: 0.75 + r() * 0.35 });
  }
  ENV.runners = [];
  for (let i = 0; i < 14; i++) ENV.runners.push({ x: r(), r: 5 + r() * 6, sp: 0.05 + r() * 0.09, ph: r(), wob: r() * 10 });
  ENV.streaks = [];
  for (let i = 0; i < 260; i++) ENV.streaks.push({ x: r(), y: r(), l: 20 + r() * 70, s: 0.6 + r() * 1.2, z: r() });
  // fabric noise for curtain
  ENV.bokeh = [];
  for (let i = 0; i < 60; i++) ENV.bokeh.push({ x: r(), y: r(), r: 20 + r() * 90, c: r(), a: 0.2 + r() * 0.6, ph: r() * 10 });
};

// sky + city composited into the window rect (room space). dawn 0..1
function drawCity(ctx, t, rect, par, dawn) {
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  // sky
  const g = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  const n0 = [8, 10, 26], n1 = [30, 22, 60], n2 = [84, 40, 96];
  const d0 = [70, 96, 150], d1 = [236, 166, 140], d2 = [255, 214, 160];
  g.addColorStop(0, col(mix3(n0, d0, dawn)));
  g.addColorStop(0.55, col(mix3(n1, d1, dawn)));
  g.addColorStop(1, col(mix3(n2, d2, dawn)));
  ctx.fillStyle = g; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  if (dawn > 0) {
    // sun
    ctx.globalAlpha = dawn;
    glowDot(ctx, rect.x + rect.w * 0.62, rect.y + rect.h * 0.72, 520, [255, 220, 160], 0.9);
    glowDot(ctx, rect.x + rect.w * 0.62, rect.y + rect.h * 0.72, 120, [255, 245, 220], 1);
    ctx.globalAlpha = 1;
  }
  const px = par[0], py = par[1];
  // far layer
  const farY = rect.y + rect.h - 1300 + 120;
  ctx.globalAlpha = 1;
  if (dawn < 1) ctx.drawImage(ENV.cityFar, rect.x - 150 + px * 0.3, farY + py * 0.3);
  if (dawn > 0) { ctx.globalAlpha = dawn; ctx.drawImage(ENV.cityFarD, rect.x - 150 + px * 0.3, farY + py * 0.3); ctx.globalAlpha = 1; }
  // haze
  const hz = ctx.createLinearGradient(0, rect.y + rect.h * 0.4, 0, rect.y + rect.h);
  hz.addColorStop(0, col(mix3([90, 50, 120], [255, 200, 170], dawn), 0));
  hz.addColorStop(1, col(mix3([110, 60, 140], [255, 205, 170], dawn), 0.45));
  ctx.fillStyle = hz; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  // blinking aviation lights
  if (dawn < 1) {
    for (let i = 0; i < ENV.antFar.length; i++) {
      const a = ENV.antFar[i];
      const on = (Math.sin(t * 2.2 + i * 1.7) > 0.4) ? 1 : 0.15;
      glowDot(ctx, rect.x - 150 + px * 0.3 + a[0], farY + py * 0.3 + a[1], 14, [255, 40, 40], 0.9 * on * (1 - dawn));
    }
  }
  // mid layer
  const midY = rect.y + rect.h - 1200 + 260;
  if (dawn < 1) ctx.drawImage(ENV.cityMid, rect.x - 220 + px * 0.6, midY + py * 0.6);
  if (dawn > 0) { ctx.globalAlpha = dawn; ctx.drawImage(ENV.cityMidD, rect.x - 220 + px * 0.6, midY + py * 0.6); ctx.globalAlpha = 1; }
  // neon signs on mid layer
  drawNeonSigns(ctx, t, rect.x - 220 + px * 0.6, midY + py * 0.6, 1 - dawn);
  // rain streaks outside
  if (dawn < 0.8) drawRainStreaks(ctx, t, rect, 1 - dawn * 1.25);
  ctx.restore();
}

function neonFlicker(t, seed) {
  // mostly on, with occasional stutters
  const k = Math.floor(t * 12);
  const h = hash1(k * 3 + seed);
  const burst = noise1(t * 0.6, seed) > 0.82;
  if (burst && h < 0.5) return 0.25;
  return 0.92 + 0.08 * Math.sin(t * 50 + seed);
}

function neonText(ctx, txt, x, y, size, c, on, vertical = false) {
  ctx.save();
  ctx.font = `600 ${size}px Inter`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = vertical ? txt.split('') : [txt];
  for (let pass = 0; pass < 3; pass++) {
    ctx.shadowColor = col(c, 0.9 * on);
    ctx.shadowBlur = [40, 16, 4][pass];
    ctx.fillStyle = pass === 2 ? col(mix3(c, [255, 255, 255], 0.75), 0.4 + 0.6 * on) : col(c, 0.6 * on);
    lines.forEach((ch, i) => ctx.fillText(ch, x, y + i * size * 1.05));
  }
  ctx.restore();
}

function drawNeonSigns(ctx, t, ox, oy, k) {
  if (k <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = k;
  // vertical hotel sign
  const f1 = neonFlicker(t, 1);
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(ox + 933, oy + 40, 74, 430);
  neonText(ctx, 'ОТЕЛЬ', ox + 970, oy + 90, 64, [255, 60, 190], f1, true);
  // pharmacy cross + word
  const f2 = 0.95;
  ctx.save();
  ctx.shadowColor = 'rgba(60,255,170,0.9)'; ctx.shadowBlur = 30;
  ctx.fillStyle = `rgba(120,255,200,${0.9 * f2})`;
  const cx = ox + 330, cy = oy + 170;
  ctx.fillRect(cx - 9, cy - 30, 18, 60); ctx.fillRect(cx - 30, cy - 9, 60, 18);
  ctx.restore();
  neonText(ctx, 'АПТЕКА 24', ox + 460, oy + 172, 34, [70, 255, 180], f2);
  // cyan strip
  const f3 = neonFlicker(t, 7);
  neonText(ctx, 'КАФЕ «НОЧЬ»', ox + 935, oy + 640, 30, [80, 200, 255], f3);
  ctx.restore();
}

function drawRainStreaks(ctx, t, rect, a) {
  ctx.save();
  ctx.lineCap = 'round';
  for (const s of ENV.streaks) {
    const speed = 900 + s.z * 900;
    const y = ((s.y * (rect.h + 200) + t * speed) % (rect.h + 200)) + rect.y - 100;
    const x = rect.x + s.x * rect.w + (y - rect.y) * 0.08;
    ctx.strokeStyle = `rgba(190,210,255,${(0.08 + s.z * 0.22) * a})`;
    ctx.lineWidth = 0.8 + s.z * 1.6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s.l * 0.08, y + s.l * (0.6 + s.z)); ctx.stroke();
  }
  ctx.restore();
}

// water drops on the glass; refraction via flipped sample of 'plate'
function drawGlassDrops(ctx, t, rect, plate, k, warm = 0) {
  if (k <= 0) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  const hi = warm > 0.5 ? 'rgba(255,235,200,' : 'rgba(220,235,255,';
  const drawDrop = (x, y, r, e) => {
    ctx.save();
    ctx.beginPath(); ctx.ellipse(x, y, r, r * e, 0, 0, TAU);
    ctx.clip();
    // refraction: flipped and magnified sample of what's behind
    ctx.translate(x, y); ctx.scale(-1, -1);
    const sw = r * 7;
    ctx.drawImage(plate, (x - rect.x) / rect.w * plate.width - sw / 2, (y - rect.y) / rect.h * plate.height - sw / 2, sw, sw, -r, -r * e, r * 2, r * 2 * e);
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.1, r, r * e, 0, 0, TAU);
    ctx.strokeStyle = 'rgba(0,0,10,0.35)'; ctx.lineWidth = Math.max(1, r * 0.18); ctx.stroke();
    ctx.fillStyle = hi + '0.85)';
    ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35 * e, Math.max(0.8, r * 0.18), 0, TAU); ctx.fill();
  };
  ctx.globalAlpha = k;
  for (const d of ENV.drops) drawDrop(rect.x + d.x * rect.w, rect.y + d.y * rect.h, d.r, d.e);
  // running drops with trails
  for (const ru of ENV.runners) {
    const p = (ru.ph + t * ru.sp) % 1.2;
    const y = rect.y + p * rect.h;
    const x = rect.x + ru.x * rect.w + Math.sin(p * 20 + ru.wob) * 4;
    // trail
    const tg = ctx.createLinearGradient(0, y - 260, 0, y);
    tg.addColorStop(0, hi + '0)'); tg.addColorStop(1, hi + '0.25)');
    ctx.strokeStyle = tg; ctx.lineWidth = ru.r * 0.6;
    ctx.beginPath(); ctx.moveTo(x - Math.sin(p * 20 + ru.wob) * 4, y - 260);
    for (let k2 = 1; k2 <= 8; k2++) { const yy = y - 260 + k2 * 32.5; ctx.lineTo(rect.x + ru.x * rect.w + Math.sin(((yy - rect.y) / rect.h) * 20 + ru.wob) * 4, yy); }
    ctx.stroke();
    drawDrop(x, y, ru.r, 1.15);
  }
  ctx.restore();
}

// Build a plate (sharp city image of the window) for refraction sampling
function cityPlate(t, dawn) {
  const key = 'p' + Math.round(dawn * 4);
  let c = ENV.plates[key];
  if (!c) { c = mkCanvas(430, 620); ENV.plates[key] = c; }
  const x = c.getContext('2d');
  x.save(); x.scale(0.5, 0.5); x.translate(-WIN.x, -WIN.y);
  drawCity(x, t, WIN, [0, 0], dawn);
  x.restore();
  return c;
}

// ---------- the room ----------
// L: lighting {dawn 0..1, phone 0..1, neon 0..1}
function drawRoom(ctx, t, L, heroPose, extras = {}) {
  const dawn = L.dawn;
  // wall
  const wallN = [18, 18, 38], wallD = [150, 110, 100];
  ctx.fillStyle = col(mix3(wallN, wallD, dawn));
  ctx.fillRect(-400, -400, W + 800, H + 800);
  // light spill on walls from window
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const spill = mix3([60, 40, 110], [255, 170, 110], dawn);
  glowDot(ctx, 560, 900, 1100, spill, 0.55 * (L.neon * (1 - dawn) + dawn));
  // magenta neon pulse
  const nf = neonFlicker(t, 1) * (1 - dawn) * L.neon;
  glowDot(ctx, 1050, 500, 700, [255, 40, 160], 0.22 * nf);
  ctx.restore();
  // window recess (deeper shade)
  ctx.fillStyle = col(mix3([10, 10, 24], [120, 84, 80], dawn));
  ctx.fillRect(WIN.x - 70, WIN.y - 70, WIN.w + 140, WIN.h + 110);
  // city
  const par = extras.par || [0, 0];
  drawCity(ctx, t, WIN, par, dawn);
  // light rays at dawn
  if (dawn > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = dawn * 0.55;
    for (let i = 0; i < 4; i++) {
      const g = ctx.createLinearGradient(700, 900, 300, 1900);
      g.addColorStop(0, 'rgba(255,210,150,0.45)'); g.addColorStop(1, 'rgba(255,190,130,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      const o = i * 130 + Math.sin(t * 0.3 + i) * 10;
      ctx.moveTo(560 + o, 700); ctx.lineTo(640 + o, 700); ctx.lineTo(240 + o * 1.6, 1950); ctx.lineTo(80 + o * 1.6, 1950);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // glass drops
  const plate = cityPlate(t, dawn);
  drawGlassDrops(ctx, t, WIN, plate, extras.drops ?? 1, dawn);
  // window frame
  const frameC = col(mix3([14, 14, 30], [110, 74, 68], dawn));
  const frameHi = col(mix3([90, 70, 160], [255, 200, 150], dawn), 0.5);
  ctx.fillStyle = frameC;
  ctx.fillRect(WIN.x - 24, WIN.y - 24, WIN.w + 48, 24);
  ctx.fillRect(WIN.x - 24, WIN.y - 24, 24, WIN.h + 24);
  ctx.fillRect(WIN.x + WIN.w, WIN.y - 24, 24, WIN.h + 24);
  ctx.fillRect(MULL_X - 11, WIN.y, 22, WIN.h);
  ctx.fillRect(WIN.x, TRANS_Y - 10, WIN.w, 20);
  ctx.fillStyle = frameHi;
  ctx.fillRect(MULL_X - 11, WIN.y, 3, WIN.h);
  ctx.fillRect(WIN.x, TRANS_Y - 10, WIN.w, 2);
  // window handle
  ctx.fillStyle = col(mix3([40, 40, 70], [200, 160, 120], dawn));
  rrect(ctx, MULL_X + 16, 1010, 14, 70, 6); ctx.fill();
  // sill
  const sillTop = mix3([34, 32, 60], [214, 170, 140], dawn);
  ctx.fillStyle = col(sillTop);
  ctx.beginPath(); ctx.moveTo(WIN.x - 90, SILL_Y); ctx.lineTo(WIN.x + WIN.w + 90, SILL_Y); ctx.lineTo(WIN.x + WIN.w + 110, SILL_Y + 40); ctx.lineTo(WIN.x - 110, SILL_Y + 40); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col(mix3([20, 18, 40], [150, 110, 96], dawn));
  ctx.fillRect(WIN.x - 110, SILL_Y + 40, WIN.w + 220, 36);
  // radiator under sill
  ctx.fillStyle = col(mix3([16, 16, 34], [130, 96, 90], dawn));
  rrect(ctx, 250, SILL_Y + 130, 620, 230, 12); ctx.fill();
  ctx.strokeStyle = col(mix3([30, 30, 60], [170, 130, 110], dawn)); ctx.lineWidth = 4;
  for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(280 + i * 50, SILL_Y + 145); ctx.lineTo(280 + i * 50, SILL_Y + 345); ctx.stroke(); }
  // plant on sill (right pane)
  drawPlant(ctx, 900, SILL_Y, t, dawn);
  // hero on sill
  if (heroPose) drawHeroSide(ctx, t, heroPose, L);
  // curtain right
  drawCurtain(ctx, t, dawn, L);
  // desk in foreground
  drawDesk(ctx, t, dawn, L, extras);
}

function drawPlant(ctx, x, y, t, dawn) {
  ctx.save();
  const leaf = col(mix3([12, 24, 30], [80, 100, 60], dawn));
  ctx.fillStyle = col(mix3([30, 20, 40], [180, 110, 80], dawn));
  ctx.beginPath(); ctx.moveTo(x - 40, y - 70); ctx.lineTo(x + 40, y - 70); ctx.lineTo(x + 30, y); ctx.lineTo(x - 30, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = leaf;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.38 + Math.sin(t * 0.7 + i) * 0.02;
    ctx.save(); ctx.translate(x, y - 70); ctx.rotate(a);
    ctx.beginPath(); ctx.ellipse(55, 0, 60, 13, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawCurtain(ctx, t, dawn, L) {
  ctx.save();
  const x0 = 900, x1 = 1120;
  const base = mix3([22, 20, 46], [200, 140, 120], dawn);
  for (let i = 0; i < 9; i++) {
    const sway = Math.sin(t * 0.8 + i * 0.6) * 6;
    const xx = x0 + i * 26;
    const g = ctx.createLinearGradient(xx, 0, xx + 30, 0);
    const lit = 0.65 + 0.35 * Math.sin(i * 1.9);
    g.addColorStop(0, col(base.map(v => v * lit), 0.92));
    g.addColorStop(0.5, col(base.map(v => Math.min(255, v * (lit + 0.5))), 0.92));
    g.addColorStop(1, col(base.map(v => v * lit * 0.8), 0.92));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(xx, 140);
    ctx.bezierCurveTo(xx + sway, 700, xx - sway, 1300, xx + sway * 1.4, 1900);
    ctx.lineTo(xx + 40 + sway * 1.4, 1900);
    ctx.bezierCurveTo(xx + 40 - sway, 1300, xx + 40 + sway, 700, xx + 40, 140);
    ctx.closePath(); ctx.fill();
  }
  // rod
  ctx.fillStyle = col(mix3([10, 10, 20], [90, 60, 50], dawn));
  ctx.fillRect(60, 130, 1080, 14);
  ctx.restore();
}

function drawDesk(ctx, t, dawn, L, extras) {
  ctx.save();
  // desk top (perspective slab) bottom-right foreground
  const top = mix3([20, 18, 36], [170, 116, 84], dawn);
  const front = mix3([10, 10, 22], [110, 70, 52], dawn);
  ctx.fillStyle = col(top);
  ctx.beginPath(); ctx.moveTo(360, 1690); ctx.lineTo(1200, 1690); ctx.lineTo(1200, 1830); ctx.lineTo(300, 1830); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col(front);
  ctx.fillRect(300, 1830, 900, 140);
  // light on desk at dawn
  if (dawn > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = dawn * 0.5;
    glowDot(ctx, 720, 1760, 420, [255, 170, 100], 0.6);
    ctx.restore();
  }
  // mug
  ctx.fillStyle = col(mix3([26, 24, 48], [230, 220, 205], dawn));
  rrect(ctx, 1000, 1610, 70, 95, 10); ctx.fill();
  ctx.strokeStyle = col(mix3([26, 24, 48], [230, 220, 205], dawn)); ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(1072, 1655, 20, -1.2, 1.2); ctx.stroke();
  // phone on desk + photo (dawn scene)
  if (extras.deskItems) {
    // polaroid
    ctx.save();
    ctx.translate(560, 1745); ctx.rotate(-0.12); ctx.scale(1, 0.55);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-88, -98, 186, 210);
    ctx.fillStyle = col(mix3([90, 90, 100], [250, 240, 225], dawn));
    ctx.fillRect(-95, -105, 186, 210);
    if (extras.photoImg) ctx.drawImage(extras.photoImg, -82, -92, 160, 150);
    ctx.restore();
    // phone
    ctx.save();
    ctx.translate(800, 1755); ctx.rotate(0.08); ctx.scale(1, 0.55);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrect(ctx, -58, -112, 128, 236, 20); ctx.fill();
    ctx.fillStyle = '#0b0b10'; rrect(ctx, -64, -120, 128, 236, 20); ctx.fill();
    const sg = ctx.createLinearGradient(-60, -116, 60, 112);
    sg.addColorStop(0, 'rgba(255,220,180,0.25)'); sg.addColorStop(0.45, 'rgba(20,20,30,0.1)'); sg.addColorStop(1, 'rgba(255,200,150,0.15)');
    ctx.fillStyle = sg; rrect(ctx, -58, -114, 116, 224, 16); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
