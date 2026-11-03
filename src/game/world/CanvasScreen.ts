import * as THREE from 'three';

/** A tiny canvas-backed texture used for displays (microwave clock, TV, elevator floor indicator). */
export class CanvasScreen {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly tex: THREE.CanvasTexture;
  constructor(w: number, h: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
  }
  draw(fn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
    fn(this.ctx, this.canvas.width, this.canvas.height);
    this.tex.needsUpdate = true;
  }
}

export function segClock(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, color: string, bg = '#050605') {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.floor(h * 0.7)}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.fillText(text, w / 2, h / 2 + 1);
  ctx.shadowBlur = 0;
}
