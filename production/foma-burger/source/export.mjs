import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright'); import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.dirname(new URL(import.meta.url).pathname); const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((q, r) => { const p = path.join(ROOT, q.url.split('?')[0]); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
const vo = JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline_vo.json'))); await p.addInitScript(v => { window.SUBS = []; window.VO = v; }, vo);
await p.goto(`http://localhost:${server.address().port}/index.html`); await p.waitForFunction(() => window.exportGLB); await p.evaluate(() => window.ready);
const cover = await p.evaluate(() => window.renderCover()); fs.writeFileSync(`${OUT}/FOMA_BURGER_cover.png`, Buffer.from(cover.split(',')[1], 'base64'));
for (const v of ['front', 'q', 'side', 'back', 'face', 'run', 'jump', 'shock', 'skeptic', 'point', 'confused']) { const d = await p.evaluate(v => window.renderRef(v), v); fs.writeFileSync(`${OUT}/ref_${v}.jpg`, Buffer.from(d.split(',')[1], 'base64')); }
const g = await p.evaluate(() => window.exportGLB()); fs.writeFileSync(`${OUT}/foma_r15.glb`, Buffer.from(g.b64, 'base64')); console.log('clips', g.clips.join(', '));
await b.close(); server.close();
