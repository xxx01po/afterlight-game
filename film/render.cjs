// usage: node render.js preview <out.png> t1 t2 ...   |  node render.js range <startFrame> <endFrame> <out.mp4>
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname;
function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
      fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; }
        const ext = path.extname(f); r.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : 'font/ttf' }); r.end(d); });
    }).listen(0, () => res(srv));
  });
}
(async () => {
  const mode = process.argv[2];
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('console', m => { if (m.type() === 'error') console.error('PAGE:', m.text()); });
  page.on('pageerror', e => console.error('PAGEERR:', e.message));
  await page.goto(`http://127.0.0.1:${port}/film.html`);
  await page.evaluate(() => FILM.init());
  if (mode === 'cover') {
    const data = await page.evaluate(() => { FILM.cover(); return document.getElementById('c').toDataURL('image/png'); });
    fs.writeFileSync(process.argv[3], Buffer.from(data.split(',')[1], 'base64'));
  } else if (mode === 'cues') {
    fs.writeFileSync(process.argv[3], JSON.stringify(await page.evaluate(() => window.CUES), null, 1));
  } else if (mode === 'preview') {
    const out = process.argv[3];
    const times = process.argv.slice(4).map(Number);
    let i = 0;
    for (const t of times) {
      const t0 = Date.now();
      const data = await page.evaluate((f) => { FILM.render(f); return document.getElementById('c').toDataURL('image/jpeg', 0.9); }, Math.round(t * 30));
      fs.writeFileSync(out.replace('%d', String(i).padStart(2, '0')), Buffer.from(data.split(',')[1], 'base64'));
      console.log('t', t, (Date.now() - t0) + 'ms'); i++;
    }
  } else if (mode === 'range') {
    const a = +process.argv[3], b = +process.argv[4], out = process.argv[5];
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', '30', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = a; f < b; f++) {
      const data = await page.evaluate((f) => { FILM.render(f); return document.getElementById('c').toDataURL('image/jpeg', 0.96); }, f);
      const buf = Buffer.from(data.split(',')[1], 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - a) % 60 === 0) console.log(`[${a}-${b}] frame ${f} ${((Date.now() - t0) / (f - a + 1)).toFixed(0)}ms/f`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close(); srv.close();
})();
