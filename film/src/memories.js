// ===== memories (warm palette) + the photograph =====
const MEM = { cache: {} };

// ---------- standing figure, front or back view. origin at feet centre; height ~600 ----------
// o: {who, view:'front'|'back', walk (phase), arm:'umbrella'|'down'|'hug', face:'happy'|'closed'|'smile', skin, lightC, rim}
function drawStanding(ctx, o) {
  const G = o.who === 'girl';
  const P = G ? GIRL : HERO;
  const walk = o.walk ?? null;
  const bob = walk !== null ? Math.abs(Math.sin(walk)) * 8 : 0;
  const lg = walk !== null ? Math.sin(walk) * 16 : 0;
  ctx.save();
  ctx.translate(0, -bob);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const skin = col(o.skin || (G ? GIRL.skinWarm : HERO.skinWarm));
  const rim = o.rim;
  const dr = (fn) => { if (rim) { ctx.save(); ctx.strokeStyle = col(rim, 0.9); ctx.fillStyle = col(rim, 0.9); fn(6); ctx.restore(); } fn(0); };
  // legs
  dr((R) => {
    if (!R) ctx.strokeStyle = col(G ? GIRL.legs : HERO.jeans);
    ctx.lineWidth = (G ? 30 : 40) + R;
    ctx.beginPath(); ctx.moveTo(-22, -270); ctx.lineTo(-24 - lg, -10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(22, -270); ctx.lineTo(24 + lg, -10); ctx.stroke();
    if (!R) ctx.strokeStyle = col([30, 26, 30]);
    ctx.lineWidth = 34 + R;
    ctx.beginPath(); ctx.moveTo(-30 - lg, -8); ctx.lineTo(-18 - lg, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(30 + lg, -8); ctx.lineTo(18 + lg, -6); ctx.stroke();
  });
  // torso
  dr((R) => {
    if (!R) ctx.fillStyle = col(G ? GIRL.coat : HERO.hoodie);
    ctx.beginPath();
    if (G) {
      ctx.moveTo(-58 - R, -440 - R); ctx.bezierCurveTo(-70 - R, -360, -86 - R, -260, -96 - R, -190 + R);
      ctx.lineTo(96 + R, -190 + R); ctx.bezierCurveTo(86 + R, -260, 70 + R, -360, 58 + R, -440 - R);
      ctx.bezierCurveTo(30, -460 - R, -30, -460 - R, -58 - R, -440 - R);
    } else {
      ctx.moveTo(-76 - R, -460 - R); ctx.bezierCurveTo(-84 - R, -380, -74 - R, -300, -66 - R, -250 + R);
      ctx.lineTo(66 + R, -250 + R); ctx.bezierCurveTo(74 + R, -300, 84 + R, -380, 76 + R, -460 - R);
      ctx.bezierCurveTo(40, -486 - R, -40, -486 - R, -76 - R, -460 - R);
    }
    ctx.fill();
  });
  if (G && o.view !== 'back') { // coat details: buttons + collar
    ctx.fillStyle = col(GIRL.coatDark);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(8, -400 + i * 60, 5, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = col(GIRL.coatDark); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -450); ctx.lineTo(4, -200); ctx.stroke();
  }
  if (G && o.view === 'back') { // hood folded on back
    ctx.fillStyle = col(GIRL.coatDark); ctx.beginPath(); ctx.ellipse(0, -420, 50, 30, 0, 0, TAU); ctx.fill();
  }
  if (!G && o.view !== 'back') { // drawstrings + pocket
    ctx.strokeStyle = col(HERO.string, 0.9); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-14, -460); ctx.lineTo(-16, -400); ctx.moveTo(14, -460); ctx.lineTo(16, -404); ctx.stroke();
    ctx.strokeStyle = col(HERO.hoodieDark); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-44, -300); ctx.lineTo(44, -300); ctx.stroke();
  }
  // arms
  const armC = col(G ? GIRL.coat : HERO.hoodie);
  dr((R) => {
    if (!R) ctx.strokeStyle = armC;
    ctx.lineWidth = (G ? 28 : 34) + R;
    const arms = o.arms || [[-1, 'down'], [1, 'down']];
    for (const [s, kind] of arms) {
      ctx.beginPath(); ctx.moveTo(s * (G ? 54 : 70), -440);
      if (kind === 'down') { ctx.lineTo(s * (G ? 70 : 86) - (walk !== null ? lg * 0.5 * s : 0), -330); ctx.lineTo(s * (G ? 66 : 80) - (walk !== null ? lg * s : 0), -240); }
      else if (kind === 'umbrella') { ctx.lineTo(s * 112, -372); ctx.lineTo(s * 80, -350); }
      else if (kind === 'link') { ctx.lineTo(s * 84, -340); ctx.lineTo(s * 120, -300); }
      else if (kind === 'hug') { ctx.lineTo(s * 120, -370); ctx.lineTo(s * 40, -320); }
      ctx.stroke();
    }
  });
  // neck + head
  ctx.fillStyle = skin;
  ctx.fillRect(-14, -500, 28, 50);
  const hy = -545;
  // hair (back layer)
  ctx.fillStyle = col(P.hair);
  if (G) {
    ctx.beginPath(); ctx.moveTo(-58, hy - 10); ctx.bezierCurveTo(-64, hy - 70, 64, hy - 70, 58, hy - 10);
    ctx.bezierCurveTo(66, hy + 50, 70, hy + 90, 56, hy + 110); ctx.lineTo(-56, hy + 110); ctx.bezierCurveTo(-70, hy + 90, -66, hy + 50, -58, hy - 10); ctx.fill();
  }
  if (o.view === 'back') {
    ctx.beginPath();
    if (G) { ctx.ellipse(0, hy - 6, 52, 58, 0, 0, TAU); }
    else { ctx.ellipse(0, hy - 6, 48, 54, 0, 0, TAU); }
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(0, hy, G ? 40 : 44, G ? 50 : 54, 0, 0, TAU); ctx.fill();
  if (o.lightC) {
    const g = ctx.createRadialGradient(o.lightX || 30, hy - 10, 4, o.lightX || 30, hy - 10, 70);
    g.addColorStop(0, col(o.lightC, 0.6)); g.addColorStop(1, col(o.lightC, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, hy, G ? 40 : 44, G ? 50 : 54, 0, 0, TAU); ctx.fill();
  }
  // face
  const ink = col(P.hair);
  ctx.strokeStyle = ink; ctx.lineWidth = 3.2;
  const face = o.face || 'smile';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    if (face === 'closed') { ctx.moveTo(s * 18 - 8, hy + 2); ctx.quadraticCurveTo(s * 18, hy + 7, s * 18 + 8, hy + 2); }
    else { ctx.moveTo(s * 18 - 8, hy + 3); ctx.quadraticCurveTo(s * 18, hy - 5, s * 18 + 8, hy + 3); }
    ctx.stroke();
  }
  ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(-10, hy + 24); ctx.quadraticCurveTo(0, hy + (face === 'closed' ? 28 : 32), 10, hy + 24); ctx.stroke();
  glowDot(ctx, -26, hy + 16, 14, [255, 120, 110], 0.5);
  glowDot(ctx, 26, hy + 16, 14, [255, 120, 110], 0.5);
  // hair front
  ctx.fillStyle = col(P.hair);
  ctx.beginPath();
  if (G) {
    ctx.moveTo(-46, hy + 30); ctx.bezierCurveTo(-56, hy - 40, -20, hy - 64, 6, hy - 60);
    ctx.bezierCurveTo(40, hy - 58, 56, hy - 30, 46, hy + 30);
    ctx.bezierCurveTo(40, hy - 10, 30, hy - 30, 10, hy - 34);
    ctx.bezierCurveTo(-10, hy - 20, -34, hy - 20, -46, hy + 30);
  } else {
    ctx.moveTo(-50, hy + 4); ctx.bezierCurveTo(-58, hy - 60, 56, hy - 74, 52, hy - 4);
    ctx.lineTo(40, hy - 26); ctx.lineTo(30, hy - 14); ctx.lineTo(20, hy - 30); ctx.lineTo(4, hy - 18);
    ctx.lineTo(-8, hy - 32); ctx.lineTo(-22, hy - 18); ctx.lineTo(-34, hy - 30); ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

function drawUmbrella(ctx, x, y, r, t, rim) {
  ctx.save();
  ctx.translate(x, y);
  // clear dome
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 10, 0, 0, r * 1.1);
  g.addColorStop(0, 'rgba(255,250,240,0.32)'); g.addColorStop(1, 'rgba(255,240,220,0.12)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-r, 0); ctx.bezierCurveTo(-r, -r * 0.85, r, -r * 0.85, r, 0);
  for (let i = 8; i >= 0; i--) { const xx = -r + i * (2 * r / 8); ctx.quadraticCurveTo(xx + r / 8, 14, xx, 0); }
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,245,230,0.55)'; ctx.lineWidth = 3; ctx.stroke();
  // ribs
  ctx.strokeStyle = 'rgba(255,245,230,0.35)'; ctx.lineWidth = 2;
  for (let i = 1; i < 8; i++) { const xx = -r + i * (2 * r / 8); ctx.beginPath(); ctx.moveTo(0, -r * 0.64); ctx.quadraticCurveTo(xx * 0.8, -r * 0.5, xx, 0); ctx.stroke(); }
  // drops on canopy
  const rr = mulberry32(8);
  ctx.fillStyle = 'rgba(255,250,240,0.7)';
  for (let i = 0; i < 26; i++) { const a = rr() * Math.PI; const d = rr() * r * 0.9; ctx.beginPath(); ctx.arc(Math.cos(a) * d * 1.05 * (rr() < 0.5 ? -1 : 1), -Math.sin(a) * d * 0.62, 1.5 + rr() * 2.5, 0, TAU); ctx.fill(); }
  // shaft + handle
  ctx.strokeStyle = 'rgba(40,30,30,0.9)'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0, -r * 0.66); ctx.lineTo(0, r * 0.95); ctx.stroke();
  ctx.beginPath(); ctx.arc(-12, r * 0.95, 12, 0, Math.PI); ctx.stroke();
  ctx.restore();
}

function warmStreet(ctx, w, h, t, horizon, k = 1) {
  // warm rainy street with bokeh lamps
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2a1a2a'); g.addColorStop(horizon / h, '#7a4632'); g.addColorStop(1, '#1e1418');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // buildings either side
  ctx.fillStyle = '#2a1820';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.36, horizon - 60); ctx.lineTo(w * 0.36, horizon + 8); ctx.lineTo(0, h * 0.95); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(w * 0.64, horizon - 60); ctx.lineTo(w * 0.64, horizon + 8); ctx.lineTo(w, h * 0.95); ctx.closePath(); ctx.fill();
  // shop windows (warm rectangles in perspective)
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const u = Math.pow(0.72, i);
    const xl = w * 0.36 * (1 - u), yt = lerp(horizon - 40, h * 0.5, u), yb = lerp(horizon + 6, h * 0.9, u);
    ctx.fillStyle = `rgba(255,170,80,${0.25 * k})`;
    ctx.fillRect(xl, yt, w * 0.06 * u + 4, yb - yt);
    ctx.fillRect(w - xl - (w * 0.06 * u + 4), yt, w * 0.06 * u + 4, yb - yt);
  }
  // lamps & bokeh
  const r = mulberry32(31);
  for (let i = 0; i < 40; i++) {
    const x = r() * w, y = horizon - 200 + r() * 260, rad = 8 + r() * 40;
    const c = r() < 0.7 ? [255, 180, 90] : [255, 110, 120];
    ctx.fillStyle = col(c, 0.18 * k); ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
  }
  // wet reflections
  for (let i = 0; i < 18; i++) {
    const x = r() * w, rw = 6 + r() * 20;
    const rg = ctx.createLinearGradient(0, horizon, 0, h);
    rg.addColorStop(0, `rgba(255,170,90,${0.3 * k})`); rg.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = rg; ctx.fillRect(x, horizon, rw, h - horizon);
  }
  ctx.restore();
}

function warmRain(ctx, w, h, t, a = 1, seed = 3) {
  const r = mulberry32(seed);
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < 120; i++) {
    const x0 = r() * w, y0 = r() * h, z = r(), l = 20 + z * 50;
    const y = (y0 + t * (500 + z * 600)) % (h + 100) - 50;
    ctx.strokeStyle = `rgba(255,220,170,${(0.1 + z * 0.3) * a})`; ctx.lineWidth = 1 + z * 2;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + 3, y + l); ctx.stroke();
  }
  ctx.restore();
}

// ---------- the photograph ----------
MEM.photoCanvas = function (variant) {
  if (MEM.cache[variant]) return MEM.cache[variant];
  const w = 600, h = 720, SS = 2;
  const c = mkCanvas(w * SS, h * SS), x = c.getContext('2d');
  x.scale(SS, SS);
  warmStreet(x, w, h, 0, 430, 1);
  warmRain(x, w, h, 0.3, 0.7, 12);
  const together = variant === 'together';
  // figures
  x.save(); x.translate(232, 700); x.scale(0.86, 0.86);
  drawStanding(x, { who: 'hero', view: 'front', arms: [[-1, 'down'], [1, together ? 'umbrella' : 'umbrella']], face: 'smile', rim: [255, 190, 120], lightC: [255, 200, 150] });
  x.restore();
  if (together) {
    x.save(); x.translate(372, 700); x.scale(0.78, 0.78); x.rotate(-0.05);
    drawStanding(x, { who: 'girl', view: 'front', arms: [[-1, 'link'], [1, 'down']], face: 'happy', rim: [255, 200, 130], lightC: [255, 210, 160], lightX: -20 });
    x.restore();
  }
  drawUmbrella(x, 300, 205, 200, 0);
  // photo finish: warm fade, soft vignette, date stamp
  x.fillStyle = 'rgba(255,170,100,0.12)'; x.fillRect(0, 0, w, h);
  const vg = x.createRadialGradient(w / 2, h / 2, 200, w / 2, h / 2, 520);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,8,6,0.55)');
  x.fillStyle = vg; x.fillRect(0, 0, w, h);
  x.font = '600 26px "JetBrains Mono", monospace'; x.fillStyle = 'rgba(255,150,60,0.9)';
  x.textAlign = 'right'; x.fillText("14 10 '22", w - 30, h - 30);
  MEM.cache[variant] = c;
  return c;
};

// ---------- memory shots: each draws a full frame. lt = local seconds ----------
MEM.walk = function (ctx, lt) {
  const cam = 1 + lt * 0.03;
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(cam, cam); ctx.translate(-W / 2, -H / 2);
  warmStreet(ctx, W, H, lt, 980, 1.2);
  warmRain(ctx, W, H, lt, 1, 4);
  // two walking away (back view), shared umbrella
  const ph = lt * 4.2;
  ctx.save(); ctx.translate(470, 1660); ctx.scale(1.35, 1.35);
  drawStanding(ctx, { who: 'hero', view: 'back', walk: ph, arms: [[-1, 'down'], [1, 'umbrella']], rim: [255, 170, 90] });
  ctx.restore();
  ctx.save(); ctx.translate(640, 1660); ctx.scale(1.22, 1.22);
  drawStanding(ctx, { who: 'girl', view: 'back', walk: ph + Math.PI, arms: [[-1, 'link'], [1, 'down']], rim: [255, 190, 110] });
  ctx.restore();
  drawUmbrella(ctx, 560 + Math.sin(ph) * 4, 950 - Math.abs(Math.sin(ph)) * 8, 290, lt);
  // puddle reflections of figures
  ctx.globalAlpha = 0.2; ctx.fillStyle = '#ffb070';
  ctx.fillRect(400, 1670, 320, 6);
  ctx.globalAlpha = 1;
  ctx.restore();
};

MEM.laugh = function (ctx, lt) {
  const cam = 1.02 + lt * 0.025;
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(cam, cam); ctx.translate(-W / 2, -H / 2);
  // cafe bokeh warm background
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3a2026'); g.addColorStop(0.6, '#6a3a2a'); g.addColorStop(1, '#2a1616');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const r = mulberry32(44);
  for (let i = 0; i < 50; i++) {
    const x = r() * W, y = 300 + r() * 900, rad = 30 + r() * 100;
    ctx.fillStyle = col(r() < 0.7 ? [255, 170, 80] : [255, 110, 110], 0.08 + r() * 0.1);
    ctx.beginPath(); ctx.arc(x + Math.sin(lt * 0.4 + i) * 10, y, rad, 0, TAU); ctx.fill();
  }
  // string lights
  for (let i = 0; i < 12; i++) { const x = i * 100 + 20; const y = 260 + Math.sin(i * 0.9) * 30 + i * 8; glowDot(ctx, x, y, 40, [255, 200, 120], 0.8); }
  ctx.restore();
  const laugh = 0.5 + 0.5 * Math.sin(lt * 9);
  // hero (left, facing right) shoulders + head
  ctx.save(); ctx.translate(250, 1230);
  ctx.fillStyle = col(HERO.hoodie);
  ctx.beginPath(); ctx.moveTo(-420, 900); ctx.bezierCurveTo(-400, 380, -200, 300, 0, 300); ctx.bezierCurveTo(160, 300, 260, 400, 300, 900); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = col([255, 190, 120], 0.6); ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(0, 300); ctx.bezierCurveTo(160, 300, 260, 400, 300, 900); ctx.stroke();
  ctx.translate(30, 100); ctx.scale(3.4, 3.4); ctx.rotate(-0.06 + laugh * 0.02);
  drawProfileHead(ctx, { who: 'hero', t: lt, skin: HERO.skinWarm.map(v => v * 0.92), hair: HERO.hair, rim: [[255, 200, 130], 0.9], lit: { x: 60, y: 0, r: 80, c: [255, 210, 160], a: 0.6 }, eye: 'happy', mouth: 'smile', blush: 0.35 });
  ctx.restore();
  // girl (right, facing left), laughing head back
  ctx.save(); ctx.translate(850, 1280);
  ctx.fillStyle = col(GIRL.coat);
  ctx.beginPath(); ctx.moveTo(400, 900); ctx.bezierCurveTo(380, 380, 200, 290, 0, 290); ctx.bezierCurveTo(-140, 290, -240, 400, -270, 900); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col(GIRL.coatDark);
  ctx.beginPath(); ctx.moveTo(-60, 300); ctx.bezierCurveTo(-20, 420, 60, 440, 110, 310); ctx.lineTo(60, 290); ctx.closePath(); ctx.fill();
  ctx.translate(-20, 90); ctx.scale(-3.3, 3.3); ctx.rotate(-0.22 - laugh * 0.06);
  drawProfileHead(ctx, { who: 'girl', t: lt, skin: GIRL.skinWarm, hair: GIRL.hair, rim: [[255, 210, 140], 0.9], lit: { x: 60, y: 0, r: 80, c: [255, 225, 180], a: 0.6 }, eye: 'happy', mouth: 'laugh', blush: 0.5, hairHi: [[255, 170, 110], 0.6] });
  ctx.restore();
  ctx.restore();
};

MEM.hug = function (ctx, lt) {
  const cam = 1.08 - lt * 0.02;
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(cam, cam); ctx.rotate(Math.sin(lt * 0.3) * 0.01); ctx.translate(-W / 2, -H / 2);
  // backlight streetlamp
  ctx.fillStyle = '#1e1216'; ctx.fillRect(0, 0, W, H);
  glowDot(ctx, 700, 520, 1300, [255, 160, 80], 0.75);
  glowDot(ctx, 700, 520, 260, [255, 230, 180], 1);
  warmRain(ctx, W, H, lt, 1.3, 9);
  // glowing droplets near lamp
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const r = mulberry32(61);
  for (let i = 0; i < 60; i++) { const x = 700 + (r() - 0.5) * 900, y = ((r() * 1400 + lt * 300) % 1400) + 0; glowDot(ctx, x, y, 6 + r() * 10, [255, 210, 150], 0.5); }
  ctx.restore();
  // hero facing camera, girl back to camera, embracing
  ctx.save(); ctx.translate(560, 2150); ctx.scale(2.6, 2.6);
  drawStanding(ctx, { who: 'hero', view: 'front', face: 'closed', arms: [[-1, 'hug'], [1, 'hug']], rim: [255, 200, 120], skin: HERO.skinWarm.map(v => v * 0.8) });
  ctx.restore();
  ctx.save(); ctx.translate(650, 2250); ctx.scale(2.25, 2.25); ctx.rotate(0.05);
  drawStanding(ctx, { who: 'girl', view: 'back', arms: [], rim: [255, 210, 130] });
  ctx.restore();
  // his hands on her back
  ctx.fillStyle = col(HERO.skinWarm.map(v => v * 0.7));
  ctx.beginPath(); ctx.ellipse(466, 1330, 30, 40, 0.5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(670, 1330, 30, 40, -0.5, 0, TAU); ctx.fill();
  ctx.restore();
};

MEM.busStop = function (ctx, lt) {
  const cam = 1 + lt * 0.02;
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(cam, cam); ctx.translate(-W / 2, -H / 2);
  // sunset sky
  const g = ctx.createLinearGradient(0, 0, 0, 1300);
  g.addColorStop(0, '#3a2a5a'); g.addColorStop(0.45, '#c8607a'); g.addColorStop(0.8, '#ffa860'); g.addColorStop(1, '#ffd08a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  glowDot(ctx, 330, 1150, 600, [255, 200, 120], 0.8);
  glowDot(ctx, 330, 1150, 110, [255, 240, 200], 1);
  // distant city silhouette
  ctx.fillStyle = '#5a3048';
  const r = mulberry32(71);
  let x = 0; while (x < W) { const bw = 40 + r() * 90, bh = 80 + r() * 260; ctx.fillRect(x, 1250 - bh, bw, bh + 10); x += bw; }
  // street
  ctx.fillStyle = '#2a1a26'; ctx.fillRect(0, 1250, W, 700);
  ctx.fillStyle = 'rgba(255,190,120,0.25)'; ctx.fillRect(0, 1256, W, 8);
  // shelter
  ctx.fillStyle = 'rgba(255,220,180,0.12)'; ctx.fillRect(160, 900, 760, 560);  // glass
  ctx.fillStyle = '#24161e'; ctx.fillRect(130, 870, 820, 40); ctx.fillRect(150, 900, 16, 600); ctx.fillRect(914, 900, 16, 600);
  ctx.strokeStyle = 'rgba(255,210,170,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(166, 910, 748, 540);
  // sign
  ctx.fillStyle = '#24161e'; ctx.fillRect(990, 760, 10, 760);
  ctx.fillStyle = '#ffd08a'; rrect(ctx, 950, 740, 92, 92, 14); ctx.fill();
  ctx.fillStyle = '#24161e'; ctx.font = '600 50px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('17', 996, 788);
  ctx.textAlign = 'left';
  // bench
  ctx.fillStyle = '#1a1016'; ctx.fillRect(260, 1330, 560, 26); ctx.fillRect(280, 1356, 14, 100); ctx.fillRect(786, 1356, 14, 100);
  // two sitting (front view), her head on his shoulder
  const sitC = (who, x0, s, tilt) => {
    const G = who === 'girl';
    ctx.strokeStyle = col(G ? GIRL.legs : HERO.jeans); ctx.lineCap = 'round'; ctx.lineWidth = (G ? 30 : 40) * s;
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x0 + d * 22 * s, 1356); ctx.lineTo(x0 + d * 26 * s, 1440); ctx.stroke(); }
    ctx.strokeStyle = '#1e1a1e'; ctx.lineWidth = 30 * s;
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x0 + d * 30 * s, 1446); ctx.lineTo(x0 + d * 18 * s, 1448); ctx.stroke(); }
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, 1346); ctx.clip();
    ctx.translate(x0, 1335); ctx.rotate(tilt); ctx.translate(0, (G ? 205 : 255) * s); ctx.scale(s, s);
    drawStanding(ctx, { who, view: 'front', face: G ? 'closed' : 'smile', rim: [255, 190, 120], lightC: [255, 200, 140], lightX: -30, arms: [[-1, 'down'], [1, 'down']] });
    ctx.restore();
  };
  sitC('hero', 470, 0.78, 0);
  sitC('girl', 585, 0.72, -0.17);
  // cover legs region with bench front shadow to imply sitting
  ctx.fillStyle = '#1a1016'; ctx.fillRect(250, 1356, 580, 18);
  // bus far right approaching lights
  const bl = seg(lt, 1.2, 3.0);
  glowDot(ctx, 1080 - bl * 60, 1240, 60 + bl * 60, [255, 240, 200], 0.4 + bl * 0.4);
  ctx.restore();
};

function drawHand(ctx, x, y, ang, s, skin, sleeve, curl, flip) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s * (flip ? -1 : 1), s);
  ctx.fillStyle = col(sleeve);
  ctx.beginPath(); ctx.moveTo(-760, -120); ctx.lineTo(-190, -96); ctx.lineTo(-180, 100); ctx.lineTo(-760, 130); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col(sleeve.map(v => v * 0.72)); ctx.fillRect(-214, -100, 34, 202);
  const sh = col(skin.map(v => v * 0.72));
  const pg = ctx.createLinearGradient(0, -90, 0, 90);
  pg.addColorStop(0, col(skin.map(v => Math.min(255, v * 1.05)))); pg.addColorStop(1, sh);
  // wrist + palm
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.moveTo(-190, -62); ctx.bezierCurveTo(-110, -78, -20, -84, 30, -60); ctx.bezierCurveTo(50, -20, 50, 40, 30, 66); ctx.bezierCurveTo(-40, 80, -120, 72, -190, 64); ctx.closePath(); ctx.fill();
  // fingers: tapered, slightly fanned, curling (foreshortened)
  const lens = [118, 132, 124, 98];
  for (let i = 0; i < 4; i++) {
    const fy = -48 + i * 32;
    const L = lens[i] * (1 - curl * 0.45);
    const dy = (i - 1.5) * 6 + curl * 34;
    ctx.fillStyle = pg;
    fingerPath(ctx, 20, fy, 20 + L, fy + dy, 31, 25);
    ctx.fill();
    ctx.strokeStyle = sh; ctx.lineWidth = 2; ctx.stroke();
    // knuckle crease + nail
    ctx.strokeStyle = col(skin.map(v => v * 0.65), 0.6); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(20 + L * 0.55, fy + dy * 0.55 - 9); ctx.lineTo(20 + L * 0.55, fy + dy * 0.55 + 9); ctx.stroke();
    ctx.fillStyle = col(skin.map(v => Math.min(255, v * 1.08)), 0.9);
    ctx.beginPath(); ctx.ellipse(20 + L - 8, fy + dy - 3, 9, 7, Math.atan2(dy, L), 0, TAU); ctx.fill();
  }
  // thumb
  ctx.fillStyle = pg;
  fingerPath(ctx, -70, -54, 40, -112 + curl * 20, 40, 30); ctx.fill();
  ctx.strokeStyle = sh; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

MEM.hands = function (ctx, lt, dur) {
  const u = easeInOut(seg(lt, 0.4, dur - 0.5));
  ctx.save();
  // blurred warm background (bus stop dusk)
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#5a2e46'); g.addColorStop(0.5, '#c46a5a'); g.addColorStop(1, '#3a1e28');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const r = mulberry32(90);
  for (let i = 0; i < 30; i++) glowDot(ctx, r() * W, r() * H, 60 + r() * 140, [255, 180, 110], 0.25);
  ctx.restore();
  warmRain(ctx, W, H, lt * 0.35, 0.7, 21);
  const sep = u * 420;
  const zoom = 1.25 + lt * 0.04;
  ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2);
  // her hand from right, his from left; fingers hooked then sliding
  drawHand(ctx, 600 + sep * 0.55, 1000 + u * 40, 0.15, 1.15, GIRL.skinWarm, GIRL.coat, clamp(0.7 - u * 1.4), true);
  drawHand(ctx, 480 - sep * 0.45, 960 - u * 20, -0.12, 1.25, HERO.skinWarm.map(v => v * 0.92), HERO.hoodie, clamp(0.75 - u * 1.2), false);
  ctx.restore();
};
