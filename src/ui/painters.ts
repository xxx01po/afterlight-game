import { rng } from '@/utils/math';
import { flyerTexture } from '@/game/world/landing';

/**
 * Procedural "photos" for the phone gallery and the inspect view.
 * Deliberately low-fi: night phone pictures with grain and blur.
 */
type Painter = (c: CanvasRenderingContext2D, w: number, h: number) => void;

function grain(c: CanvasRenderingContext2D, w: number, h: number, amt: number, seed: number) {
  const R = rng(seed);
  const img = c.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (R() - 0.5) * amt;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  c.putImageData(img, 0, 0);
}
function sky(c: CanvasRenderingContext2D, w: number, h: number, top: string, bottom: string) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}
function figure(c: CanvasRenderingContext2D, x: number, y: number, s: number, body: string, head: string, hair?: string) {
  c.fillStyle = body;
  c.beginPath();
  c.ellipse(x, y + s * 1.4, s * 0.9, s * 1.3, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = head;
  c.beginPath();
  c.arc(x, y, s * 0.55, 0, Math.PI * 2);
  c.fill();
  if (hair) {
    c.fillStyle = hair;
    c.beginPath();
    c.arc(x, y - s * 0.1, s * 0.6, Math.PI, Math.PI * 2);
    c.fill();
    c.fillRect(x - s * 0.6, y - s * 0.1, s * 0.25, s * 0.9);
    c.fillRect(x + s * 0.35, y - s * 0.1, s * 0.25, s * 0.9);
  }
}

const P: Record<string, Painter> = {
  busstop: (c, w, h) => {
    sky(c, w, h, '#20262d', '#0c0f12');
    c.fillStyle = '#3a4048';
    c.fillRect(w * 0.15, h * 0.35, w * 0.6, h * 0.04);
    c.fillRect(w * 0.18, h * 0.39, w * 0.02, h * 0.4);
    c.fillRect(w * 0.7, h * 0.39, w * 0.02, h * 0.4);
    const g = c.createRadialGradient(w * 0.8, h * 0.2, 2, w * 0.8, h * 0.2, w * 0.3);
    g.addColorStop(0, 'rgba(255,210,140,0.8)');
    g.addColorStop(1, 'rgba(255,210,140,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(180,190,200,0.25)';
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - 2, y + 10);
      c.stroke();
    }
    grain(c, w, h, 30, 1);
  },
  cat: (c, w, h) => {
    sky(c, w, h, '#5a5e62', '#2a2c2e');
    c.fillStyle = '#4a4a46';
    c.fillRect(0, h * 0.55, w, h * 0.45);
    c.fillStyle = '#6a6a64';
    for (let i = 0; i < 4; i++) c.fillRect(i * w * 0.26, h * 0.25, w * 0.24, h * 0.32);
    c.fillStyle = '#1c1a18';
    c.beginPath();
    c.ellipse(w * 0.5, h * 0.66, w * 0.12, h * 0.07, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(w * 0.6, h * 0.58, h * 0.05, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#c8b860';
    c.fillRect(w * 0.59, h * 0.57, 3, 2);
    c.fillRect(w * 0.615, h * 0.57, 3, 2);
    grain(c, w, h, 22, 2);
  },
  friend: (c, w, h) => {
    sky(c, w, h, '#3a3022', '#1a1610');
    c.fillStyle = 'rgba(255,190,120,0.25)';
    c.fillRect(0, 0, w, h * 0.3);
    figure(c, w * 0.5, h * 0.38, h * 0.13, '#2e3a2a', '#b8987a', '#2a2018');
    c.fillStyle = '#d8c8a0';
    c.save();
    c.translate(w * 0.62, h * 0.6);
    c.rotate(-0.4);
    c.fillRect(-8, -24, 16, 48);
    c.restore();
    grain(c, w, h, 24, 3);
  },
  schedule: (c, w, h) => {
    c.fillStyle = '#e8e8e8';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#333';
    c.font = `bold ${Math.floor(h * 0.06)}px sans-serif`;
    c.fillText('График — октябрь', w * 0.08, h * 0.1);
    c.font = `${Math.floor(h * 0.04)}px sans-serif`;
    for (let i = 0; i < 14; i++) {
      const y = h * 0.17 + i * h * 0.055;
      c.fillStyle = i % 2 ? '#f4f4f4' : '#ddd';
      c.fillRect(w * 0.06, y - h * 0.035, w * 0.88, h * 0.05);
      c.fillStyle = '#333';
      c.fillText(`${i + 1}.10`, w * 0.1, y);
      c.fillText(i % 3 === 2 ? 'вых' : '08–20', w * 0.4, y);
      c.fillText(i === 13 ? '—' : 'Ершов', w * 0.68, y);
    }
  },
  balcony: (c, w, h) => {
    sky(c, w, h, '#8a9aa6', '#c9b89a');
    c.fillStyle = '#5e5446';
    c.fillRect(0, h * 0.72, w, h * 0.28);
    c.fillStyle = '#3e3a34';
    for (let i = 0; i < 12; i++) c.fillRect(i * (w / 12), h * 0.72, 3, h * 0.28);
    figure(c, w * 0.36, h * 0.36, h * 0.11, '#2a3036', '#b49a82', '#1e1a16');
    figure(c, w * 0.62, h * 0.38, h * 0.105, '#d8d0c0', '#c4a88c', '#7a5a3a');
    c.fillStyle = '#9a8a6a';
    c.fillRect(w * 0.54, h * 0.5, w * 0.16, h * 0.05); // grey scarf
    grain(c, w, h, 18, 4);
  },
  door48: (c, w, h) => {
    c.fillStyle = '#050505';
    c.fillRect(0, 0, w, h);
    const g = c.createRadialGradient(w * 0.5, h * 0.45, 4, w * 0.5, h * 0.45, w * 0.6);
    g.addColorStop(0, 'rgba(120,130,110,0.6)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#2a201a';
    c.fillRect(w * 0.32, h * 0.18, w * 0.36, h * 0.72);
    c.fillStyle = '#c8b88a';
    c.font = `bold ${Math.floor(h * 0.06)}px serif`;
    c.fillText('48', w * 0.46, h * 0.3);
    c.filter = 'blur(2px)';
    c.drawImage(c.canvas, 3, 0);
    c.filter = 'none';
    grain(c, w, h, 50, 5);
  },
  shelfPhoto: (c, w, h) => P.balcony(c, w, h),
  shelfBack: (c, w, h) => {
    c.fillStyle = '#d8d0bc';
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(60,40,20,0.08)';
    for (let i = 0; i < 20; i++) c.fillRect(Math.random() * w, Math.random() * h, 30, 2);
    c.fillStyle = '#2a3446';
    c.font = `italic ${Math.floor(h * 0.07)}px "Segoe Script", "Comic Sans MS", cursive`;
    c.fillText('Ты обещал,', w * 0.12, h * 0.42);
    c.fillText('что откроешь.', w * 0.12, h * 0.55);
    c.fillText('— А.', w * 0.55, h * 0.72);
  },
  polaroid: (c, w, h) => {
    c.fillStyle = '#ece6d8';
    c.fillRect(0, 0, w, h);
    const m = w * 0.08;
    c.fillStyle = '#100e0c';
    c.fillRect(m, m, w - 2 * m, w - 2 * m);
    const g = c.createRadialGradient(w * 0.5, w * 0.45, 4, w * 0.5, w * 0.45, w * 0.5);
    g.addColorStop(0, 'rgba(255,240,220,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(m, m, w - 2 * m, w - 2 * m);
    c.fillStyle = '#3a2c24';
    c.fillRect(w * 0.32, w * 0.2, w * 0.36, w * 0.68);
    c.fillStyle = '#a89870';
    c.fillRect(w * 0.6, w * 0.52, 6, 6);
    c.fillStyle = '#333';
    c.font = `${Math.floor(w * 0.08)}px monospace`;
    c.fillText('03:17', w * 0.36, h * 0.92);
  },
  polaroidNeighbor: (c, w, h) => {
    c.fillStyle = '#ece6d8';
    c.fillRect(0, 0, w, h);
    const m = w * 0.08;
    c.fillStyle = '#0a0908';
    c.fillRect(m, m, w - 2 * m, w - 2 * m);
    c.fillStyle = '#4c5e52';
    c.fillRect(w * 0.3, w * 0.18, w * 0.4, w * 0.7);
    c.fillStyle = '#121518';
    c.fillRect(w * 0.44, w * 0.38, w * 0.12, w * 0.46);
    c.beginPath();
    c.arc(w * 0.5, w * 0.33, w * 0.06, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#333';
    c.font = `${Math.floor(w * 0.08)}px monospace`;
    c.fillText('03:17', w * 0.36, h * 0.92);
  },
  flyer: (c, w, h) => {
    const img = flyerTexture().image as HTMLCanvasElement;
    c.drawImage(img, 0, 0, w, h);
  },
};

export function paint(key: string, canvas: HTMLCanvasElement) {
  const c = canvas.getContext('2d');
  const p = P[key];
  if (!c || !p) return;
  p(c, canvas.width, canvas.height);
}
