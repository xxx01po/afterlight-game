import * as THREE from 'three';
import { makeCanvas, noiseFill, stains } from '@/utils/canvas';
import { rng } from '@/utils/math';

/**
 * Procedural texture library painted on canvases at startup: the game ships
 * without image assets, which keeps the first load small. `tile` = metres per repeat.
 */
export interface Tex { map: THREE.Texture; tile: number; bump?: THREE.Texture }

function finish(c: HTMLCanvasElement, tile: number, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.userData.tile = tile;
  return t;
}

/** Grayscale bump derived from the albedo luminance (cheap but convincing relief). */
function bumpFrom(c: HTMLCanvasElement, invert = false) {
  const { c: b, ctx } = makeCanvas(c.width, c.height);
  ctx.filter = invert ? 'grayscale(1) invert(1) contrast(1.4)' : 'grayscale(1) contrast(1.4)';
  ctx.drawImage(c, 0, 0);
  return finish(b, 1, false);
}

function entry(c: HTMLCanvasElement, tile: number, bump = false, invert = false): Tex {
  return { map: finish(c, tile), tile, bump: bump ? bumpFrom(c, invert) : undefined };
}

function bark(seed: number, base: string, dark: string, S = 256) {
  const R = rng(seed);
  const { c, ctx } = makeCanvas(S, S * 2);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S * 2);
  for (let i = 0; i < 260; i++) {
    const x = R() * S, y = R() * S * 2, h = 20 + R() * 90, w = 1 + R() * 4;
    ctx.fillStyle = R() > 0.5 ? dark : 'rgba(255,255,255,0.05)';
    ctx.globalAlpha = 0.25 + R() * 0.5;
    ctx.fillRect(x, y, w, h);
    ctx.fillRect(x - S, y, w, h);
  }
  ctx.globalAlpha = 1;
  stains(ctx, S, S * 2, 10, R, 'rgba(60,80,40,0.25)', 40); // lichen
  noiseFill(ctx, S, S * 2, 30, R);
  return entry(c, 1.5, true);
}

function birch() {
  const R = rng(77);
  const S = 256;
  const { c, ctx } = makeCanvas(S, S * 2);
  ctx.fillStyle = '#cfcbc0';
  ctx.fillRect(0, 0, S, S * 2);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(20,20,18,${0.4 + R() * 0.5})`;
    const y = R() * S * 2, w = 10 + R() * 60;
    ctx.fillRect(R() * S, y, w, 2 + R() * 5);
  }
  noiseFill(ctx, S, S * 2, 26, R);
  return entry(c, 1.5, true);
}

function needles(seed: number) {
  // foliage albedo with alpha cut-outs (used with alphaTest)
  const R = rng(seed);
  const S = 256;
  const { c, ctx } = makeCanvas(S, S);
  ctx.clearRect(0, 0, S, S);
  for (let i = 0; i < 2200; i++) {
    const x = R() * S, y = R() * S, a = R() * Math.PI, l = 6 + R() * 10;
    const g = 40 + R() * 40;
    ctx.strokeStyle = `rgb(${g * 0.45},${g},${g * 0.6})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  const t = finish(c, 1);
  return { map: t, tile: 1 } as Tex;
}

function ground(seed: number, base: [number, number, number], specks: string[], S = 512) {
  const R = rng(seed);
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = `rgb(${base.join(',')})`;
  ctx.fillRect(0, 0, S, S);
  stains(ctx, S, S, 40, R, 'rgba(0,0,0,0.25)', 80);
  stains(ctx, S, S, 25, R, 'rgba(120,110,80,0.12)', 60);
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = specks[Math.floor(R() * specks.length)];
    const x = R() * S, y = R() * S;
    const a = R() * Math.PI;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillRect(0, 0, 1 + R() * 6, 1 + R() * 1.5);
    ctx.restore();
  }
  noiseFill(ctx, S, S, 22, R);
  return entry(c, 4, true);
}

function asphalt() {
  const R = rng(9);
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = '#2c2d2e';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) {
    const v = 30 + R() * 50;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(R() * S, R() * S, 1.5, 1.5);
  }
  stains(ctx, S, S, 20, R, 'rgba(0,0,0,0.35)', 90); // puddles / dark wet patches
  ctx.strokeStyle = 'rgba(10,10,10,0.8)';
  for (let k = 0; k < 14; k++) {
    ctx.lineWidth = 1 + R() * 2;
    ctx.beginPath();
    let x = R() * S, y = R() * S;
    ctx.moveTo(x, y);
    for (let s = 0; s < 8; s++) {
      x += (R() - 0.5) * 60;
      y += (R() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  noiseFill(ctx, S, S, 16, R);
  return entry(c, 5, true, true);
}

function concrete(seed: number, base = '#7d7b76', S = 512, panels = false) {
  const R = rng(seed);
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  stains(ctx, S, S, 30, R, 'rgba(0,0,0,0.12)', 70);
  stains(ctx, S, S, 10, R, 'rgba(60,50,30,0.15)', 120);
  // rain streaks
  for (let i = 0; i < 40; i++) {
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, 'rgba(0,0,0,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(R() * S, 0, 2 + R() * 8, R() * S);
  }
  if (panels) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, S, 3);
    ctx.fillRect(0, 0, 3, S);
  }
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(R() * S, R() * S, R() * 2, 0, 7);
    ctx.fill();
  }
  noiseFill(ctx, S, S, 26, R);
  return entry(c, panels ? 3 : 2.5, true);
}

function paintedWall(seed: number, top: string, bottom: string, split = 0.55) {
  // Soviet institutional wall: oil paint lower part, whitewash top
  const R = rng(seed);
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = bottom;
  ctx.fillRect(0, S * (1 - split), S, S * split);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, S * (1 - split) - 3, S, 4);
  stains(ctx, S, S, 18, R, 'rgba(70,60,40,0.18)', 80);
  // peeling paint
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = 'rgba(160,155,140,0.6)';
    ctx.beginPath();
    const x = R() * S, y = R() * S;
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) ctx.lineTo(x + (R() - 0.5) * 30, y + (R() - 0.5) * 20);
    ctx.fill();
  }
  noiseFill(ctx, S, S, 14, R);
  return entry(c, 2.6, true);
}

function planks(seed: number, base: [number, number, number], width = 64, vertical = false, gaps = 0.6) {
  const R = rng(seed);
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  for (let x = 0; x < S; x += width) {
    const k = 0.75 + R() * 0.4;
    ctx.fillStyle = `rgb(${base[0] * k},${base[1] * k},${base[2] * k})`;
    if (vertical) ctx.fillRect(x, 0, width, S);
    else ctx.fillRect(0, x, S, width);
    for (let g = 0; g < 26; g++) {
      ctx.fillStyle = `rgba(0,0,0,${0.08 + R() * 0.12})`;
      const o = x + R() * width;
      if (vertical) ctx.fillRect(o, 0, 1, S);
      else ctx.fillRect(0, o, S, 1);
    }
    ctx.fillStyle = `rgba(0,0,0,${gaps})`;
    if (vertical) ctx.fillRect(x, 0, 3, S);
    else ctx.fillRect(0, x, S, 3);
  }
  stains(ctx, S, S, 14, R, 'rgba(0,0,0,0.25)', 70);
  noiseFill(ctx, S, S, 22, R);
  return entry(c, 2, true);
}

function logs() {
  const R = rng(31);
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  const n = 8;
  const h = S / n;
  for (let i = 0; i < n; i++) {
    const y = i * h;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    const k = 0.8 + R() * 0.3;
    g.addColorStop(0, `rgb(${30 * k},${24 * k},${18 * k})`);
    g.addColorStop(0.25, `rgb(${92 * k},${74 * k},${54 * k})`);
    g.addColorStop(0.6, `rgb(${70 * k},${56 * k},${42 * k})`);
    g.addColorStop(1, `rgb(${22 * k},${18 * k},${14 * k})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, y, S, h);
    for (let s = 0; s < 40; s++) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(R() * S, y + h * 0.2 + R() * h * 0.6, 20 + R() * 80, 1);
    }
    // moss/tow between logs
    ctx.fillStyle = 'rgba(70,72,50,0.7)';
    ctx.fillRect(0, y + h - 4, S, 4);
  }
  stains(ctx, S, S, 10, R, 'rgba(0,0,0,0.35)', 90);
  noiseFill(ctx, S, S, 20, R);
  return entry(c, 2.4, true);
}

function corrugated(seed: number, rust: number) {
  const R = rng(seed);
  const S = 256;
  const { c, ctx } = makeCanvas(S, S);
  for (let x = 0; x < S; x++) {
    const v = 0.5 + 0.5 * Math.sin((x / S) * Math.PI * 2 * 10);
    const l = 70 + v * 50;
    ctx.fillStyle = `rgb(${l},${l * 1.02},${l * 1.04})`;
    ctx.fillRect(x, 0, 1, S);
  }
  stains(ctx, S, S, Math.floor(40 * rust), R, 'rgba(120,60,20,0.45)', 40);
  stains(ctx, S, S, 10, R, 'rgba(0,0,0,0.3)', 60);
  noiseFill(ctx, S, S, 20, R);
  return entry(c, 2, true);
}

function rustMetal(seed: number, paint: string, rust = 0.5) {
  const R = rng(seed);
  const S = 256;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = paint;
  ctx.fillRect(0, 0, S, S);
  stains(ctx, S, S, Math.floor(70 * rust), R, 'rgba(90,45,18,0.45)', 10);
  stains(ctx, S, S, Math.floor(30 * rust), R, 'rgba(50,28,12,0.55)', 6);
  // streaks running down from rivets/edges
  for (let i = 0; i < 30 * rust; i++) {
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, 'rgba(90,45,18,0.35)');
    g.addColorStop(1, 'rgba(90,45,18,0)');
    ctx.fillStyle = g;
    ctx.fillRect(R() * S, R() * S * 0.5, 1 + R() * 3, R() * S);
  }
  stains(ctx, S, S, 10, R, 'rgba(0,0,0,0.25)', 60);
  noiseFill(ctx, S, S, 22, R, false);
  return entry(c, 1.5, true);
}

function tiles(seed: number, n: number, color: string, grout: string) {
  const R = rng(seed);
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, S, S);
  const st = S / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85 + R() * 0.15;
      ctx.fillRect(i * st + 2, j * st + 2, st - 4, st - 4);
      if (R() < 0.08) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(i * st + R() * st, j * st, 1, st);
      }
    }
  ctx.globalAlpha = 1;
  stains(ctx, S, S, 16, R, 'rgba(60,50,30,0.2)', 80);
  noiseFill(ctx, S, S, 12, R);
  return entry(c, 1.6, true, true);
}

function linoleum() {
  const R = rng(55);
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = '#5b4836';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 16; j++) {
      ctx.fillStyle = (i + j) % 2 ? 'rgba(255,240,210,0.06)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(i * 32, j * 32, 32, 32);
    }
  stains(ctx, S, S, 24, R, 'rgba(0,0,0,0.22)', 70);
  noiseFill(ctx, S, S, 14, R);
  return entry(c, 2.5, true);
}

function wallpaper() {
  const R = rng(88);
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = '#7a6f58';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(50,40,25,0.5)';
  for (let y = 0; y < S; y += 64)
    for (let x = (y / 64) % 2 ? 32 : 0; x < S + 32; x += 64) {
      ctx.beginPath();
      ctx.ellipse(x, y + 32, 9, 20, 0, 0, 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      ctx.lineTo(x, y + 56);
      ctx.stroke();
    }
  stains(ctx, S, S, 22, R, 'rgba(60,40,10,0.25)', 110);
  // torn strips
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = 'rgba(140,130,110,0.9)';
    const x = R() * S;
    ctx.fillRect(x, R() * S * 0.6, 8 + R() * 30, 40 + R() * 160);
  }
  noiseFill(ctx, S, S, 16, R);
  return entry(c, 1.6, true);
}

function chainlink() {
  const S = 128;
  const { c, ctx } = makeCanvas(S, S);
  ctx.clearRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(150,150,145,1)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(S, S);
  ctx.moveTo(S, 0);
  ctx.lineTo(0, S);
  ctx.stroke();
  return { map: finish(c, 0.12), tile: 0.12 } as Tex;
}

function leaves(seed: number, hue: [number, number, number]) {
  const R = rng(seed);
  const S = 256;
  const { c, ctx } = makeCanvas(S, S);
  ctx.clearRect(0, 0, S, S);
  // dense clumps with a few holes: reads as foliage instead of a net at alphaTest
  for (let i = 0; i < 2600; i++) {
    const x = R() * S, y = R() * S, r = 3 + R() * 6;
    const k = 0.6 + R() * 0.6;
    ctx.fillStyle = `rgb(${hue[0] * k},${hue[1] * k},${hue[2] * k})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.5, R() * 3, 0, 7);
    ctx.fill();
  }
  return { map: finish(c, 1), tile: 1 } as Tex;
}

export function footprintTex() {
  const S = 128;
  const { c, ctx } = makeCanvas(S, S);
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(10,8,6,0.85)';
  // elongated print with long toes — not human
  ctx.beginPath();
  ctx.ellipse(64, 80, 16, 34, 0, 0, 7);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(40 + i * 16, 30 - Math.abs(i - 1.5) * 6, 4, 14, (i - 1.5) * 0.25, 0, 7);
    ctx.fill();
  }
  const t = finish(c, 1);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function bootTex() {
  const S = 128;
  const { c, ctx } = makeCanvas(S, S);
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(12,10,8,0.8)';
  ctx.beginPath();
  ctx.ellipse(64, 46, 18, 28, 0, 0, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(64, 98, 14, 18, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (let y = 24; y < 116; y += 9) ctx.fillRect(48, y, 32, 3);
  const t = finish(c, 1);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function glowSprite(color = '255,210,150') {
  const S = 128;
  const { c, ctx } = makeCanvas(S, S);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${color},1)`);
  g.addColorStop(0.2, `rgba(${color},0.45)`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function blobShadow() {
  const S = 64;
  const { c, ctx } = makeCanvas(S, S);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.75)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

export function labelTex(lines: string[], w: number, h: number, fg: string, bg: string, font: string, align: CanvasTextAlign = 'center') {
  const { c, ctx } = makeCanvas(w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const lh = h / (lines.length + 1);
  lines.forEach((l, i) => ctx.fillText(l, align === 'center' ? w / 2 : 14, lh * (i + 1)));
  noiseFill(ctx, w, h, 18, rng(w + h));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Old photo / paper with optional pencil scribbles, used for documents in the world. */
export function paperTex(seed: number, kind: 'note' | 'photo' | 'doc') {
  const R = rng(seed);
  const W = 128, H = kind === 'photo' ? 100 : 170;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = kind === 'photo' ? '#d9d3c2' : '#cfc6ad';
  ctx.fillRect(0, 0, W, H);
  if (kind === 'photo') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2b2a26');
    g.addColorStop(1, '#55514a');
    ctx.fillStyle = g;
    ctx.fillRect(8, 8, W - 16, H - 26);
    ctx.fillStyle = 'rgba(15,14,12,0.9)';
    for (let i = 0; i < 3; i++) {
      const x = 28 + i * 34;
      ctx.beginPath();
      ctx.arc(x, 36, 7, 0, 7);
      ctx.fill();
      ctx.fillRect(x - 9, 44, 18, 30);
    }
  } else {
    ctx.fillStyle = 'rgba(30,30,60,0.75)';
    for (let y = 14; y < H - 10; y += 8) ctx.fillRect(10, y, 20 + R() * (W - 40), 1.4);
    if (kind === 'doc') {
      ctx.fillStyle = 'rgba(150,20,20,0.6)';
      ctx.beginPath();
      ctx.arc(W - 30, H - 30, 14, 0, 7);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(150,20,20,0.6)';
      ctx.stroke();
    }
  }
  stains(ctx, W, H, 4, R, 'rgba(90,70,30,0.2)', 30);
  noiseFill(ctx, W, H, 18, R);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildTextures() {
  return {
    barkSpruce: bark(1, '#3a2e25', 'rgba(10,8,6,0.9)'),
    barkPine: bark(2, '#5a3e2a', 'rgba(25,14,8,0.9)'),
    barkDead: bark(3, '#4b4741', 'rgba(15,14,12,0.9)'),
    birch: birch(),
    needles: needles(4),
    needles2: needles(5),
    leaves: leaves(6, [70, 80, 40]),
    leavesDry: leaves(7, [95, 78, 40]),
    forest: ground(10, [112, 100, 80], ['#2a241c', '#4c4030', '#3a3a24', '#5a4a34', '#22281a']),
    grass: ground(11, [84, 94, 62], ['#2c3a1c', '#46502e', '#3a4224', '#5c5a3a', '#1e2414']),
    mud: ground(12, [104, 90, 72], ['#2a2018', '#3e3024', '#56483a', '#1a1410']),
    gravel: ground(13, [70, 68, 62], ['#555', '#777', '#999', '#444', '#666']),
    asphalt: asphalt(),
    concrete: concrete(20),
    concreteDark: concrete(21, '#5d5b57'),
    panel: concrete(22, '#8a8780', 512, true),
    wallGreen: paintedWall(30, '#a9a596', '#3e5a4d'),
    wallBlue: paintedWall(31, '#b0ad9f', '#3d4d5c', 0.5),
    wallLab: paintedWall(32, '#c2c0b7', '#8f9a92', 0.35),
    tilesLab: tiles(40, 8, '#c8cbc5', '#77786f'),
    tilesFloor: tiles(41, 6, '#8d6a52', '#3b2f27'),
    linoleum: linoleum(),
    wallpaper: wallpaper(),
    planks: planks(50, [92, 72, 52]),
    planksGrey: planks(51, [88, 86, 80], 48, true, 0.75),
    planksDark: planks(52, [60, 46, 34], 56),
    logs: logs(),
    roofTin: corrugated(60, 1),
    roofTinClean: corrugated(61, 0.3),
    metalGreen: rustMetal(70, '#3f4a3a', 0.5),
    metalGrey: rustMetal(71, '#6a6c6a', 0.35),
    metalRust: rustMetal(72, '#5a3a24', 1),
    metalBlue: rustMetal(73, '#33475a', 0.6),
    metalWhite: rustMetal(74, '#b9b8b0', 0.25),
    chainlink: chainlink(),
  };
}
export type TexLib = ReturnType<typeof buildTextures>;
