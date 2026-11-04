// Рендер превиза: headless Chromium (SwiftShader) → JPEG-кадры → ffmpeg.
// node render.mjs out.mp4 [fps] [t0] [t1]   |   node render.mjs --stills dir t1,t2,...
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const root = path.dirname(new URL(import.meta.url).pathname);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
const port = srv.address().port;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', m => { if (m.type() === 'error') console.error('PAGE', m.text()); });
page.on('pageerror', e => console.error('PAGEERR', e.message));
await page.goto(`http://localhost:${port}/index.html${process.env.NOBARS ? '?bars=0' : ''}`);
await page.waitForFunction('window.ready === true', null, { timeout: 60000 });
const frame = async (t) => { await page.evaluate(t => window.renderAt(t), t); const d = await page.evaluate(() => window.grab(0.92)); return Buffer.from(d.split(',')[1], 'base64'); };
if (process.argv[2] === '--stills') {
  const dir = process.argv[3]; fs.mkdirSync(dir, { recursive: true });
  for (const t of process.argv[4].split(',').map(Number)) { await frame(t); fs.writeFileSync(path.join(dir, `t${String(t).padStart(5, '0')}.jpg`), await frame(t)); console.log('still', t); }
} else {
  const out = process.argv[2], fps = +(process.argv[3] || 24), t0 = +(process.argv[4] || 0), t1 = +(process.argv[5] || 48.5);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round((t1 - t0) * fps), st = Date.now();
  for (let i = 0; i < n; i++) { const buf = await frame(t0 + i / fps); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); if (i % 120 === 0) console.log(`frame ${i}/${n} ${((Date.now() - st) / 1000).toFixed(0)}s`); }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log('done', out, ((Date.now() - st) / 1000).toFixed(0) + 's');
}
await browser.close(); srv.close();
