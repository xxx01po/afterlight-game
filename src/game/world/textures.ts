import * as THREE from 'three';
import { makeCanvas, noiseFill, stains } from '@/utils/canvas';
import { rng } from '@/utils/math';

/**
 * Procedural texture library. Everything is painted on canvases at startup,
 * so the demo ships without image assets and stays small on mobile.
 * `tile` = metres covered by one texture repeat (used by UV scaling).
 */
export interface TexEntry { map: THREE.Texture; tile: number }

function finish(c: HTMLCanvasElement, tile: number, srgb = true): TexEntry {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return { map: t, tile };
}

function wallpaper(seed: number, base: string, ink: string, kind: 'diamond' | 'damask' | 'stripe') {
  const R = rng(seed);
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  if (kind === 'diamond') {
    ctx.lineWidth = 1.2;
    for (let y = 0; y < S; y += 32)
      for (let x = (y / 32) % 2 ? 16 : 0; x < S + 16; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x + 5, y);
        ctx.lineTo(x, y + 6);
        ctx.lineTo(x - 5, y);
        ctx.closePath();
        ctx.stroke();
      }
  } else if (kind === 'damask') {
    for (let y = 0; y < S; y += 128)
      for (let x = (y / 128) % 2 ? 64 : 0; x < S + 64; x += 128) {
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 2;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.ellipse(x, y + 40, 10 + k * 6, 30 - k * 5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + 30, y + 20, x - 30, y + 60, x, y + 90);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
  } else {
    for (let x = 0; x < S; x += 24) ctx.fillRect(x, 0, 3, S);
  }
  // roll seams every ~0.53 m
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#000';
  ctx.fillRect(Math.floor(S * 0.53), 0, 1, S);
  ctx.globalAlpha = 1;
  stains(ctx, S, S, 8, R, 'rgba(90,80,50,0.08)', 90);
  noiseFill(ctx, S, S, 14, R);
  return finish(c, 1);
}

function tiles(seed: number, size: number, color: string, grout: string, px = 512) {
  const R = rng(seed);
  const { c, ctx } = makeCanvas(px, px);
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, px, px);
  const n = Math.round(1 / size);
  const step = px / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const v = Math.floor(R() * 14 - 7);
      ctx.fillStyle = color;
      ctx.filter = `brightness(${100 + v}%)`;
      ctx.fillRect(i * step + 2, j * step + 2, step - 4, step - 4);
      ctx.filter = 'none';
      const g = ctx.createLinearGradient(i * step, j * step, i * step + step, j * step + step);
      g.addColorStop(0, 'rgba(255,255,255,0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0.06)');
      ctx.fillStyle = g;
      ctx.fillRect(i * step + 2, j * step + 2, step - 4, step - 4);
      if (R() < 0.04) {
        ctx.strokeStyle = 'rgba(40,40,40,0.5)';
        ctx.beginPath();
        ctx.moveTo(i * step + R() * step, j * step);
        ctx.lineTo(i * step + R() * step, j * step + step);
        ctx.stroke();
      }
    }
  stains(ctx, px, px, 5, R, 'rgba(120,100,60,0.08)', 60);
  noiseFill(ctx, px, px, 8, R);
  return finish(c, 1);
}

function herringbone(seed: number) {
  const R = rng(seed);
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = '#6b5641';
  ctx.fillRect(0, 0, S, S);
  const w = 32, l = 128;
  for (let y = -l; y < S + l; y += w * 2)
    for (let x = -l; x < S + l; x += l) {
      for (const flip of [0, 1]) {
        ctx.save();
        ctx.translate(x + flip * w * 2, y + flip * w);
        ctx.rotate(flip ? -Math.PI / 4 : Math.PI / 4);
        const tone = 85 + R() * 30;
        ctx.fillStyle = `hsl(30, 22%, ${tone * 0.36}%)`;
        ctx.fillRect(0, 0, l * 0.7, w * 0.95);
        ctx.restore();
      }
    }
  stains(ctx, S, S, 12, R, 'rgba(20,15,10,0.18)', 80);
  noiseFill(ctx, S, S, 18, R);
  return finish(c, 1.2);
}

function planks(seed: number, hue: number, light: number) {
  const R = rng(seed);
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  const ph = S / 4;
  for (let i = 0; i < 4; i++) {
    let x = -R() * S;
    while (x < S) {
      const len = S * (0.5 + R() * 0.6);
      ctx.fillStyle = `hsl(${hue}, 18%, ${light + R() * 8 - 4}%)`;
      ctx.fillRect(x, i * ph, len, ph - 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      for (let k = 0; k < 7; k++) {
        ctx.beginPath();
        const yy = i * ph + R() * ph;
        ctx.moveTo(x, yy);
        ctx.bezierCurveTo(x + len * 0.3, yy + R() * 6 - 3, x + len * 0.6, yy + R() * 6 - 3, x + len, yy);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + len - 1, i * ph, 2, ph);
      x += len;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, i * ph + ph - 2, S, 2);
  }
  noiseFill(ctx, S, S, 10, R);
  return finish(c, 1.6);
}

function plaster(seed: number, base: string, stainCol: string, nStains: number, tile = 2) {
  const R = rng(seed);
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  stains(ctx, S, S, nStains, R, stainCol, 120);
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    let x = R() * S, y = R() * S;
    ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += R() * 30 - 15;
      y += R() * 30 - 15;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  noiseFill(ctx, S, S, 12, R);
  return finish(c, tile);
}

function ceilingLeak() {
  const R = rng(77);
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = '#d9d6cc';
  ctx.fillRect(0, 0, S, S);
  stains(ctx, S, S, 10, R, 'rgba(110,100,70,0.06)', 140);
  // rings of an old water leak
  for (let k = 0; k < 5; k++) {
    ctx.strokeStyle = `rgba(120,95,50,${0.12 - k * 0.018})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(380, 120, 60 + k * 18 + R() * 6, 40 + k * 14, 0.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  noiseFill(ctx, S, S, 8, R);
  return finish(c, 3);
}

function stairwell() {
  const R = rng(11);
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  const split = S * (1 - 1.5 / 2.6);
  ctx.fillStyle = '#c9c6b8';
  ctx.fillRect(0, 0, S, split);
  ctx.fillStyle = '#4f6b50';
  ctx.fillRect(0, split, S, S - split);
  ctx.fillStyle = '#2e3a33';
  ctx.fillRect(0, split - 3, S, 5);
  // peeling paint
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = R() < 0.5 ? 'rgba(200,198,184,0.7)' : 'rgba(120,120,110,0.5)';
    const x = R() * S, y = split + R() * (S - split);
    ctx.beginPath();
    ctx.ellipse(x, y, 4 + R() * 14, 2 + R() * 7, R() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // scratches & a faded scribble
  ctx.strokeStyle = 'rgba(30,30,30,0.35)';
  for (let i = 0; i < 30; i++) {
    ctx.beginPath();
    const x = R() * S, y = split + 20 + R() * 150;
    ctx.moveTo(x, y);
    ctx.lineTo(x + R() * 40 - 20, y + R() * 10 - 5);
    ctx.stroke();
  }
  ctx.font = '28px monospace';
  ctx.fillStyle = 'rgba(25,25,30,0.45)';
  ctx.fillText('ЦОЙ', 60, split + 90);
  ctx.font = '18px monospace';
  ctx.fillText('кв 48 ?', 300, split + 160);
  stains(ctx, S, S, 10, R, 'rgba(60,50,30,0.12)', 90);
  noiseFill(ctx, S, S, 16, R);
  return finish(c, 2.6);
}

function mosaicFloor() {
  const R = rng(19);
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = '#3b332b';
  ctx.fillRect(0, 0, S, S);
  const n = 16, st = S / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const pick = (i + j) % 2 === 0;
      ctx.fillStyle = pick ? `hsl(18, 25%, ${30 + R() * 6}%)` : `hsl(35, 15%, ${48 + R() * 6}%)`;
      ctx.fillRect(i * st + 1, j * st + 1, st - 2, st - 2);
      if (R() < 0.05) {
        ctx.fillStyle = '#2a241f';
        ctx.fillRect(i * st + 1, j * st + 1, st - 2, st - 2);
      }
    }
  stains(ctx, S, S, 14, R, 'rgba(10,8,5,0.25)', 70);
  noiseFill(ctx, S, S, 16, R);
  return finish(c, 1.5);
}

function leatherDoor() {
  const R = rng(5);
  const W = 256, H = 512;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#2e2420';
  ctx.fillRect(0, 0, W, H);
  const cols = 4, rows = 9;
  const dx = W / cols, dy = H / rows;
  for (let i = 0; i <= cols; i++)
    for (let j = 0; j <= rows; j++) {
      const x = i * dx, y = j * dy;
      const g = ctx.createRadialGradient(x + dx / 2, y + dy / 2, 2, x + dx / 2, y + dy / 2, dx * 0.7);
      g.addColorStop(0, 'rgba(255,240,220,0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x + dx / 2, y);
      ctx.lineTo(x + dx, y + dy / 2);
      ctx.lineTo(x + dx / 2, y + dy);
      ctx.lineTo(x, y + dy / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#9a8a6a';
      ctx.beginPath();
      ctx.arc(x, y + dy / 2, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  ctx.strokeStyle = '#8a7a5a';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  noiseFill(ctx, W, H, 12, R);
  return finish(c, 1);
}

function paintedDoor() {
  const R = rng(8);
  const W = 256, H = 512;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#d6d2c4';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 4;
  ctx.strokeRect(30, 30, W - 60, H * 0.42);
  ctx.strokeRect(30, H * 0.5, W - 60, H * 0.44);
  stains(ctx, W, H, 6, R, 'rgba(110,90,50,0.10)', 60);
  noiseFill(ctx, W, H, 10, R);
  return finish(c, 1);
}

function chipboard(seed: number, hue = 25, light = 30) {
  const R = rng(seed);
  const S = 256;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = `hsl(${hue}, 30%, ${light}%)`;
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(0,0,0,${0.04 + R() * 0.08})`;
    ctx.beginPath();
    const y = R() * S;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(S * 0.3, y + R() * 20 - 10, S * 0.6, y + R() * 20 - 10, S, y + R() * 8 - 4);
    ctx.stroke();
  }
  noiseFill(ctx, S, S, 10, R);
  return finish(c, 1);
}

function fabric(seed: number, a: string, b: string, check = false) {
  const R = rng(seed);
  const S = 256;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = b;
  if (check) {
    for (let i = 0; i < S; i += 64) {
      ctx.globalAlpha = 0.5;
      ctx.fillRect(i, 0, 18, S);
      ctx.fillRect(0, i, S, 18);
    }
    ctx.globalAlpha = 1;
  } else {
    for (let y = 0; y < S; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < S; x += 32) ctx.fillRect(x, y, 6, 6);
  }
  for (let y = 0; y < S; y += 2) {
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, y, S, 1);
  }
  noiseFill(ctx, S, S, 16, R);
  return finish(c, 0.6);
}

function wallCarpet() {
  const R = rng(31);
  const W = 512, H = 384;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#4a2f2c';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#b9a37a';
  ctx.lineWidth = 10;
  ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.strokeStyle = '#2f4746';
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  const cx = W / 2, cy = H / 2;
  for (let k = 6; k > 0; k--) {
    ctx.fillStyle = k % 2 ? '#7a5a3d' : '#2f4746';
    ctx.beginPath();
    ctx.moveTo(cx, cy - k * 22);
    ctx.lineTo(cx + k * 34, cy);
    ctx.lineTo(cx, cy + k * 22);
    ctx.lineTo(cx - k * 34, cy);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 4; i++) {
    const x = i % 2 ? W - 110 : 110, y = i < 2 ? 100 : H - 100;
    ctx.fillStyle = '#6d4b36';
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b9a37a';
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  noiseFill(ctx, W, H, 26, R, false);
  return finish(c, 1);
}

function elevatorPanel() {
  const R = rng(41);
  const S = 256;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = '#6a5038';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 30; i++) {
    ctx.strokeStyle = `rgba(0,0,0,${0.1 + R() * 0.15})`;
    ctx.beginPath();
    const y = R() * S;
    ctx.moveTo(0, y);
    ctx.lineTo(S, y + R() * 6 - 3);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(230,220,200,0.35)';
  for (let i = 0; i < 25; i++) {
    ctx.beginPath();
    const x = R() * S, y = R() * S;
    ctx.moveTo(x, y);
    ctx.lineTo(x + R() * 30 - 15, y + R() * 30 - 15);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(220,210,180,0.6)';
  ctx.fillRect(40, 60, 50, 22);
  ctx.fillStyle = 'rgba(30,30,30,0.8)';
  ctx.font = '10px sans-serif';
  ctx.fillText('ЭЛЕКТРИК 24ч', 42, 75);
  noiseFill(ctx, S, S, 12, R);
  return finish(c, 1.3);
}

/** Facade of the panel block across the courtyard; doubles as emissive map. */
export function facade(seed: number, litChance: number) {
  const R = rng(seed);
  const W = 1024, H = 512;
  const color = makeCanvas(W, H);
  const glow = makeCanvas(W, H);
  const a = color.ctx, g = glow.ctx;
  a.fillStyle = '#4d5257';
  a.fillRect(0, 0, W, H);
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  const cols = 24, rows = 9;
  const cw = W / cols, rh = H / rows;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      a.strokeStyle = 'rgba(0,0,0,0.25)';
      a.strokeRect(i * cw, j * rh, cw, rh);
      const wx = i * cw + cw * 0.25, wy = j * rh + rh * 0.25, ww = cw * 0.5, wh = rh * 0.5;
      a.fillStyle = '#15181c';
      a.fillRect(wx, wy, ww, wh);
      const roll = R();
      if (roll < litChance) {
        const warm = R() < 0.8;
        g.fillStyle = warm ? `hsl(42, 70%, ${35 + R() * 25}%)` : `hsl(210, 50%, ${25 + R() * 20}%)`;
        g.fillRect(wx, wy, ww, wh);
        a.fillStyle = g.fillStyle;
        a.fillRect(wx, wy, ww, wh);
        if (R() < 0.5) {
          g.fillStyle = 'rgba(0,0,0,0.5)';
          g.fillRect(wx + ww * 0.55, wy, ww * 0.45, wh); // curtain
        }
      }
      a.fillStyle = 'rgba(0,0,0,0.6)';
      a.fillRect(wx, wy + wh * 0.48, ww, 2);
    }
  const m = finish(color.c, 1);
  const e = finish(glow.c, 1);
  m.map.wrapS = m.map.wrapT = THREE.ClampToEdgeWrapping;
  e.map.wrapS = e.map.wrapT = THREE.ClampToEdgeWrapping;
  return { map: m.map, emissive: e.map };
}

export function radialBlob(inner = 'rgba(0,0,0,0.7)') {
  const { c, ctx } = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function glowSprite(color = '255,220,160') {
  const { c, ctx } = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${color},1)`);
  g.addColorStop(0.2, `rgba(${color},0.35)`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Small canvas texture with text, e.g. door numbers, labels. */
export function labelTex(text: string, w: number, h: number, fg: string, bg: string, font: string) {
  const { c, ctx } = makeCanvas(w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export type TexLib = ReturnType<typeof buildTextures>;

export function buildTextures() {
  return {
    wpHall: wallpaper(1, '#b8ad95', 'rgba(90,80,60,0.35)', 'diamond'),
    wpRoom: wallpaper(2, '#8f9a88', 'rgba(60,70,58,0.5)', 'damask'),
    paintKitchen: plaster(3, '#c4bd9f', 'rgba(90,80,40,0.10)', 12),
    tileBath: tiles(4, 1 / 6, '#c8d0d0', '#8f9593'),
    tileSplash: tiles(5, 1 / 8, '#a9b8b0', '#6f7873', 256),
    linoleum: herringbone(6),
    laminate: planks(7, 30, 34),
    ceiling: plaster(8, '#d8d5cb', 'rgba(110,100,70,0.06)', 6, 3),
    ceilingLeak: ceilingLeak(),
    stair: stairwell(),
    mosaic: mosaicFloor(),
    plasterRaw: plaster(9, '#9a978d', 'rgba(40,40,30,0.2)', 14),
    leather: leatherDoor(),
    paintedDoor: paintedDoor(),
    walnut: chipboard(12, 24, 26),
    oak: chipboard(13, 35, 48),
    sofa: fabric(14, '#4a5560', 'rgba(150,160,170,0.25)'),
    blanket: fabric(15, '#6d6a5a', 'rgba(170,140,70,0.5)', true),
    wallCarpet: wallCarpet(),
    elevator: elevatorPanel(),
    oilcloth: fabric(16, '#bfb59a', 'rgba(70,100,90,0.35)', true),
  };
}
