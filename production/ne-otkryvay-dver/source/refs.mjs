import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright'); import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.dirname(new URL(import.meta.url).pathname); const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((q, r) => { fs.readFile(path.join(ROOT, q.url.split('?')[0]), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': q.url.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); p.on('pageerror', e => console.log(e.message)); await p.addInitScript(() => { window.SUBS = []; });
await p.goto(`http://localhost:${server.address().port}/index.html`); await p.waitForFunction(() => window.renderRef); await p.evaluate(() => window.ready);
for (const [who, view] of [['hero','front'],['hero','side'],['hero','back'],['hero','face'],['figure','front'],['figure','side']]) {
  const d = await p.evaluate(([w, v]) => window.renderRef(w, v), [who, view]);
  fs.writeFileSync(`${OUT}/${who}_${view}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
}
await b.close(); server.close();
