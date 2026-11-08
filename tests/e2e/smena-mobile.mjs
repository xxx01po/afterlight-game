/**
 * «Последняя смена» on an emulated phone (iPhone-sized, landscape, touch):
 * multi-touch joystick + swipe-look at the same time, buttons that must not start
 * a camera swipe, the interact button, no page scroll/zoom, portrait rotate hint.
 * Usage: node tests/e2e/smena-mobile.mjs [baseUrl]
 */
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] ?? 'http://localhost:5173';
const shots = process.env.SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const cdp = await ctx.newCDPSession(page);
let n = 0;
const ok = (m) => console.log(`✓ ${++n}. ${m}`);
const fail = async (m) => {
  console.error('✗ ' + m);
  if (shots) await page.screenshot({ path: shots + '/mobile-fail.png' });
  console.error(errors.join('\n'));
  await browser.close();
  process.exit(1);
};
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y, id]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
const G = (fn, a) => page.evaluate(fn, a);

await page.goto(base + '/smena/');
await page.waitForSelector('.menu', { timeout: 60000 });
await page.waitForFunction(() => !document.querySelector('.loading-dot'), null, { timeout: 60000 });
const vp = page.viewportSize();
ok(`menu on ${vp.width}×${vp.height} (touch)`);
if (shots) await page.screenshot({ path: shots + '/m-menu.png' });
await page.tap('text=Новая игра');
await page.waitForSelector('.tbtn', { timeout: 30000 });
await page.waitForTimeout(800);
ok('touch controls visible in game');
if (shots) await page.screenshot({ path: shots + '/m-hud.png' });

// overlap check: buttons must not overlap each other
const rects = await G(() => [...document.querySelectorAll('.tbtn, .icon-btn')].map((b) => { const r = b.getBoundingClientRect(); return [b.getAttribute('aria-label'), r.left, r.top, r.right, r.bottom]; }));
for (let i = 0; i < rects.length; i++)
  for (let j = i + 1; j < rects.length; j++) {
    const [a, ax, ay, ax2, ay2] = rects[i], [b, bx, by, bx2, by2] = rects[j];
    if (ax < bx2 && bx < ax2 && ay < by2 && by < ay2) await fail(`buttons overlap: ${a} / ${b}`);
    if (ax < 0 || ay < 0 || ax2 > vp.width || ay2 > vp.height) await fail('button off-screen: ' + a);
  }
ok(`${rects.length} buttons on screen, none overlapping`);

// joystick (left) + look (right) simultaneously
await G(() => window.__smena.game.player.teleport(0, 0.2, 5, 0));
const y0 = await G(() => ({ yaw: window.__smena.game.player.yaw, z: window.__smena.game.player.pos.z }));
const jx = vp.width * 0.18, jy = vp.height * 0.7, lx = vp.width * 0.55, ly = vp.height * 0.4;
await touch('touchStart', [[jx, jy, 1]]);
await touch('touchStart', [[jx, jy, 1], [lx, ly, 2]]);
for (let i = 1; i <= 10; i++) {
  await touch('touchMove', [[jx, jy - 6 * i, 1], [lx + 8 * i, ly, 2]]);
  await page.waitForTimeout(40);
}
await page.waitForFunction((z0) => window.__smena.game.player.pos.z < z0 - 0.6, y0.z, { timeout: 20000 }).catch(() => {});
const joyVisible = await G(() => getComputedStyle(document.querySelector('.joy-base')).display !== 'none');
await touch('touchEnd', []);
const y1 = await G(() => ({ yaw: window.__smena.game.player.yaw, z: window.__smena.game.player.pos.z, x: window.__smena.game.player.pos.x }));
if (!joyVisible) await fail('floating joystick should be shown under the thumb');
if (Math.abs(y1.yaw - y0.yaw) < 0.1) await fail('swipe should rotate the camera');
if (Math.hypot(y1.z - y0.z, y1.x) < 0.5) await fail('joystick should move the player ' + JSON.stringify([y0, y1]));
ok(`multi-touch: moved ${Math.hypot(y1.z - y0.z, y1.x).toFixed(2)} m and turned ${(y1.yaw - y0.yaw).toFixed(2)} rad`);

// a press on a button must not rotate the camera
const yawA = await G(() => window.__smena.game.player.yaw);
const crouch = await page.$('[aria-label="Присесть"]');
const cb = await crouch.boundingBox();
await touch('touchStart', [[cb.x + cb.width / 2, cb.y + cb.height / 2, 3]]);
await touch('touchMove', [[cb.x + cb.width / 2 - 40, cb.y + cb.height / 2, 3]]);
await touch('touchEnd', []);
await page.waitForTimeout(300);
const st = await G(() => ({ yaw: window.__smena.game.player.yaw, crouch: window.__smena.game.player.crouching }));
if (Math.abs(st.yaw - yawA) > 0.01) await fail('dragging from a button must not move the camera');
if (!st.crouch) await fail('crouch button should toggle crouch instantly');
ok('button press reacts instantly and never starts a camera swipe');

// interact button opens the booth door when aimed at it
await G(() => {
  const g = window.__smena.game;
  if (g.player.crouching) g.player.toggleCrouch();
  g.player.teleport(3.2, 0.2, 14.6, -Math.PI / 2);
});
await page.waitForTimeout(600);
await page.waitForSelector('.tbtn.big.ready', { timeout: 5000 }).catch(() => {});
const act = await page.$('[aria-label="Действие"]');
const ab = await act.boundingBox();
await touch('touchStart', [[ab.x + ab.width / 2, ab.y + ab.height / 2, 4]]);
await touch('touchEnd', []);
await page.waitForFunction(() => window.__smena.game.door('boothDoor').open, null, { timeout: 5000 }).catch(() => {});
if (!(await G(() => window.__smena.game.door('boothDoor').open))) await fail('interact button should open the aimed door');
ok('interact button opens the aimed door');

// pause → settings → back
await page.tap('[aria-label="Пауза"]');
await page.waitForSelector('text=Пауза');
await page.tap('text=Настройки');
await page.waitForSelector('text=Чувствительность обзора');
if (shots) await page.screenshot({ path: shots + '/m-settings.png' });
await page.tap('text=Готово');
await page.tap('text=Продолжить');
await page.waitForSelector('.tbtn');
ok('pause menu and settings work with touch');

const scroll = await G(() => ({ x: document.scrollingElement.scrollLeft, y: document.scrollingElement.scrollTop, w: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
if (scroll.x || scroll.y || scroll.w > scroll.cw) await fail('page must not scroll ' + JSON.stringify(scroll));
const sel = await G(() => getComputedStyle(document.body).userSelect || getComputedStyle(document.body).webkitUserSelect);
if (sel !== 'none') await fail('text selection must be disabled');
ok('no page scroll, no text selection');

// portrait: rotate hint
await page.setViewportSize({ width: vp.height, height: vp.width });
await page.waitForTimeout(400);
const rot = await G(() => getComputedStyle(document.querySelector('.rotate')).display);
if (rot !== 'flex') await fail('portrait should show the rotate hint');
if (shots) await page.screenshot({ path: shots + '/m-portrait.png' });
ok('portrait shows «Поверните устройство»');
if (errors.length) await fail('console errors: ' + errors.join('\n'));
console.log('ALL OK');
await browser.close();
