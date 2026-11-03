// Quick visual probe: node tests/e2e/shot.mjs [x z yaw pitch] name
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.env.URL ?? 'http://localhost:4173/';
const [x, z, yaw, pitch, name = 'shot', extra] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 600 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForTimeout(800);
await page.screenshot({ path: `tests/e2e/out/${name}-title.png` });
await page.getByRole('button', { name: 'Начать' }).click();
await page.waitForFunction(() => window.__afterlight?.game(), null, { timeout: 30000 });
await page.waitForTimeout(3500);
if (x !== undefined && x !== '-') {
  await page.evaluate(([x, z, yaw, pitch, extra]) => {
    const g = window.__afterlight.game();
    g.player.place(+x, +z, +yaw, +pitch);
    if (extra) for (const kv of extra.split(',')) {
      if (kv.startsWith('!')) { new Function('g', kv.slice(1))(g); continue; }
      const [k, v] = kv.split('='); g.setWorld(k, v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v);
    }
  }, [x, z, yaw, pitch, extra]);
}
await page.waitForTimeout(1500);
await page.screenshot({ path: `tests/e2e/out/${name}.png` });
const info = await page.evaluate(() => { const g = window.__afterlight.game(); return { fps: g.engine.fps, calls: g.engine.renderer.info.render.calls, tris: g.engine.renderer.info.render.triangles, geos: g.engine.renderer.info.memory.geometries, tex: g.engine.renderer.info.memory.textures, progs: g.engine.renderer.info.programs.length, room: g.room() }; });
console.log(JSON.stringify(info));
console.log(logs.filter((l) => !l.includes('GPU stall')).slice(0, 20).join('\n'));
await browser.close();
