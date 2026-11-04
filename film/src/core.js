// ===== core: math, rng, canvas helpers, post-processing =====
const W = 1080, H = 1920, FPS = 30;
const TAU = Math.PI * 2;

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const sseg = (t, a, b) => smooth(seg(t, a, b));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const easeIn = (x) => Math.pow(clamp(x), 3);
const easeInOut = (x) => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
// window function: rises a..b, holds, falls c..d
const env4 = (t, a, b, c, d) => Math.min(sseg(t, a, b), 1 - sseg(t, c, d));

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const hash1 = (n) => { const r = mulberry32((n * 2654435761) >>> 0); r(); return r(); };
// smooth 1d value noise
function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash1(i * 7 + seed * 131), b = hash1((i + 1) * 7 + seed * 131);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}
const nz = (x, seed) => noise1(x, seed) * 2 - 1;

function mkCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return c;
}
function rgba(r, g, b, a = 1) { return `rgba(${r | 0},${g | 0},${b | 0},${a})`; }
function mix3(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }
function col(c, a = 1) { return rgba(c[0], c[1], c[2], a); }

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function glowDot(ctx, x, y, r, c, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col(c, a));
  g.addColorStop(0.35, col(c, a * 0.35));
  g.addColorStop(1, col(c, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function poly(ctx, pts) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}
// smooth closed curve through points (Catmull-Rom -> bezier)
function smoothPath(ctx, pts, closed = true, tension = 0.5) {
  const n = pts.length;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const q0 = (!closed && i === 0) ? p1 : p0;
    const q3 = (!closed && i + 2 >= n) ? p2 : p3;
    const k = tension / 3;
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - q0[0]) * k, p1[1] + (p2[1] - q0[1]) * k,
      p2[0] - (q3[0] - p1[0]) * k, p2[1] - (q3[1] - p1[1]) * k,
      p2[0], p2[1]);
  }
  if (closed) ctx.closePath();
}

// ---------- post FX ----------
const POST = {};
POST.init = function () {
  // film grain textures
  POST.grain = [];
  for (let k = 0; k < 6; k++) {
    const c = mkCanvas(540, 960), x = c.getContext('2d');
    const im = x.createImageData(540, 960), d = im.data, r = mulberry32(1000 + k);
    for (let i = 0; i < d.length; i += 4) {
      const v = (r() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    POST.grain.push(c);
  }
  POST.small = mkCanvas(135, 240);
  POST.small2 = mkCanvas(135, 240);
  POST.dust = [];
  const r = mulberry32(77);
  for (let i = 0; i < 400; i++) POST.dust.push([r(), r(), r(), r()]);
};
// bloom: threshold bright areas at low res and add back blurred
POST.bloom = function (ctx, src, amount = 0.6, thresh = 0.55, tint = null) {
  if (amount <= 0) return;
  const s = POST.small, sx = s.getContext('2d', { willReadFrequently: true });
  sx.globalCompositeOperation = 'copy';
  sx.filter = 'none';
  sx.drawImage(src, 0, 0, 135, 240);
  sx.globalCompositeOperation = 'source-over';
  const im = sx.getImageData(0, 0, 135, 240), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
    const k = clamp((l - thresh) / (1 - thresh));
    d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
  }
  sx.putImageData(im, 0, 0);
  const s2 = POST.small2, s2x = s2.getContext('2d');
  s2x.globalCompositeOperation = 'copy';
  s2x.filter = 'blur(6px)';
  s2x.drawImage(s, 0, 0);
  s2x.filter = 'none';
  s2x.globalCompositeOperation = 'lighter';
  s2x.globalAlpha = 0.7;
  s2x.filter = 'blur(2px)';
  s2x.drawImage(s, 0, 0);
  s2x.filter = 'none'; s2x.globalAlpha = 1;
  s2x.globalCompositeOperation = 'source-over';
  if (tint) { s2x.globalCompositeOperation = 'multiply'; s2x.fillStyle = tint; s2x.fillRect(0, 0, 135, 240); s2x.globalCompositeOperation = 'source-over'; }
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = amount;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(s2, 0, 0, W, H);
  ctx.restore();
};
POST.vignette = function (ctx, amount = 0.6, color = '0,0,0') {
  const g = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.25, W / 2, H * 0.5, H * 0.72);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(1, `rgba(${color},${amount})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
};
POST.grainFx = function (ctx, frame, amount = 0.07) {
  const g = POST.grain[frame % 6];
  const r = mulberry32(frame * 31 + 5);
  const ox = (r() * 200) | 0, oy = (r() * 300) | 0;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = amount;
  ctx.drawImage(g, -ox, -oy, W + 400, H + 600);
  ctx.restore();
};
POST.grade = function (ctx, color, mode, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
  ctx.restore();
};
POST.dustFx = function (ctx, frame, amount) {
  // film dust & hair specks for memories
  if (amount <= 0) return;
  const r = mulberry32(frame * 17 + 3);
  ctx.save();
  ctx.globalAlpha = amount;
  const n = 3 + ((r() * 5) | 0);
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H, s = 1 + r() * 3;
    ctx.fillStyle = r() < 0.5 ? 'rgba(255,240,220,0.55)' : 'rgba(30,20,10,0.5)';
    ctx.beginPath(); ctx.ellipse(x, y, s, s * (0.5 + r()), r() * 3, 0, TAU); ctx.fill();
  }
  if (r() < 0.12) {
    ctx.strokeStyle = 'rgba(255,240,220,0.35)'; ctx.lineWidth = 1.2;
    const x = r() * W, y = r() * H;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 20, y + 30, x + 5, y + 70); ctx.stroke();
  }
  ctx.restore();
};

// ---------- text ----------
function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
