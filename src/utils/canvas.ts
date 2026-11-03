/** Helpers for procedural canvas art (textures, phone photos, paper notes). */
export function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

export function noiseFill(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, rand: () => number, mono = true) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += mono ? n : (rand() - 0.5) * amount;
    d[i + 2] += mono ? n : (rand() - 0.5) * amount;
  }
  ctx.putImageData(img, 0, 0);
}

export function stains(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, rand: () => number, color: string, maxR = 60) {
  for (let i = 0; i < count; i++) {
    const x = rand() * w, y = rand() * h, r = 10 + rand() * maxR;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** Word-wrapped text drawing. Returns the final y. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y);
        y += lineH;
        line = word;
      } else line = test;
    }
    ctx.fillText(line, x, y);
    y += lineH;
  }
  return y;
}
