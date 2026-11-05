// usage: node render.mjs test <out_dir> <t1,t2,...>   |   node render.mjs full <out.mp4>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(0);
const port = server.address().port;

const [mode, outArg, list] = process.argv.slice(2);
const subs = JSON.parse(fs.readFileSync(path.join(ROOT, 'subs.json'), 'utf8'));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.addInitScript(s => { window.SUBS = s; }, subs);
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForFunction(() => window.renderFrame && window.ready);
await page.evaluate(() => window.ready);

if (mode === 'test') {
  fs.mkdirSync(outArg, { recursive: true });
  for (const ts of list.split(',')) {
    const f = Math.round(parseFloat(ts) * 30);
    const id = await page.evaluate(f => window.renderFrame(f), f);
    const data = await page.evaluate(() => window.grab(0.9));
    fs.writeFileSync(path.join(outArg, `t${ts.padStart(5, '0')}_${id}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
    console.log('frame', ts, id);
  }
} else {
  const total = parseInt(process.argv[6] || '900'); const start = parseInt(process.argv[5] || '0');
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', outArg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = start; f < total; f++) {
    await page.evaluate(f => window.renderFrame(f), f);
    const data = await page.evaluate(() => window.grab(0.95));
    const buf = Buffer.from(data.split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 30 === 0) console.log(`frame ${f}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('done', ((Date.now() - t0) / 1000).toFixed(0), 's');
}
await browser.close(); server.close();
