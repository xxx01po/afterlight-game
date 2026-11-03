/**
 * Mobile checks on an emulated iPhone (landscape + portrait): touch joystick,
 * swipe-look, interact button, phone UI, dialogue UI, no horizontal scroll.
 */
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL ?? 'http://localhost:4173/';
const dev = devices['iPhone 15 Pro landscape'] ?? devices['iPhone 13 landscape'];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ...dev });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let ok = true;
const check = (c, msg) => { console.log(`${c ? 'PASS' : 'FAIL'} ${msg}`); if (!c) ok = false; };
const G = (body) => page.evaluate(new Function(`const g = window.__afterlight.game(); const ui = window.__afterlight.ui; ${body}`));

await page.goto(URL);
await page.waitForTimeout(600);
await page.screenshot({ path: 'tests/e2e/out/m-title.png' });
const vw = page.viewportSize();
check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal scroll on title (${vw.width}x${vw.height})`);
await page.getByRole('button', { name: 'Начать' }).tap();
await page.waitForFunction(() => window.__afterlight?.game(), null, { timeout: 30000 });
await page.waitForTimeout(4000);

const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: p[2] ?? i })) });

// joystick: hold left side and push "up"
const before = await G(`return { x: g.player.x, z: g.player.z, yaw: g.player.yaw }`);
await touch('touchStart', [[120, vw.height - 110]]);
for (let i = 1; i <= 8; i++) { await touch('touchMove', [[120, vw.height - 110 - i * 7]]); await page.waitForTimeout(30); }
await page.waitForTimeout(1200);
await page.screenshot({ path: 'tests/e2e/out/m-joystick.png' });
await touch('touchEnd', []);
const after = await G(`return { x: g.player.x, z: g.player.z, yaw: g.player.yaw }`);
const moved = Math.hypot(after.x - before.x, after.z - before.z);
check(moved > 0.4, `joystick moves the player (${moved.toFixed(2)} m)`);

// swipe-look on the right half; multitouch: joystick + look at the same time
await touch('touchStart', [[120, vw.height - 110, 1], [vw.width - 260, 200, 2]]);
for (let i = 1; i <= 10; i++) { await touch('touchMove', [[120, vw.height - 150, 1], [vw.width - 260 - i * 12, 200, 2]]); await page.waitForTimeout(20); }
await touch('touchEnd', []);
const look = await G(`return g.player.yaw`);
check(Math.abs(look - after.yaw) > 0.2, `swipe turns the camera while walking (Δyaw ${(look - after.yaw).toFixed(2)})`);

// interact button appears when aiming at an interactable
await G(`g.player.place(1.7, 5.1, -Math.PI / 2, -0.55);`);
await page.waitForTimeout(400);
const prompt = await G(`return ui.getState().prompt?.label`);
check(!!prompt, `prompt shows when aiming at an object ("${prompt}")`);
await page.screenshot({ path: 'tests/e2e/out/m-prompt.png' });
if (prompt) {
  await page.locator('.interact').tap();
  await page.waitForTimeout(300);
  check((await G(`return g.s.world.tv`)) !== 'off', 'tapping the interact button triggers the action (TV on)');
}

// phone UI with incoming messages
await G(`g.receive('me', 'Влад, если ты это читаешь, значит, всё началось заново.');`);
await page.waitForTimeout(600);
await page.screenshot({ path: 'tests/e2e/out/m-banner.png' });
await page.locator('.phone-btn').tap();
await page.waitForTimeout(500);
await page.screenshot({ path: 'tests/e2e/out/m-phone-home.png' });
await page.getByRole('button', { name: /Сообщения/ }).tap();
await page.waitForTimeout(300);
await page.locator('.li').first().tap();
await page.waitForTimeout(500);
await page.screenshot({ path: 'tests/e2e/out/m-phone-thread.png' });
check((await G(`return g.s.phone.threads.find(t => t.id === 'me').unread`)) === 0, 'opening the thread marks it read');
await page.getByRole('button', { name: 'Кто это?' }).tap();
await page.waitForTimeout(500);
check(await page.locator('.failed').count() > 0, 'reply to own number shows "Не доставлено"');
await page.getByRole('button', { name: '‹ Назад' }).tap();
await page.getByRole('button', { name: 'Домой' }).tap();
await page.getByRole('button', { name: /Фото/ }).tap();
await page.waitForTimeout(400);
await page.screenshot({ path: 'tests/e2e/out/m-phone-photos.png' });
await page.getByRole('button', { name: 'Убрать' }).tap();

// dialogue UI
await G(`import('/src/data/chapter01/dialogueDoor.ts').catch(()=>{});`);
await G(`ui.setState({ dialogue: { speaker: 'Галина Петровна', text: 'Владик? Владик, ты не спишь? Это я, Галина Петровна. Из сорок шестой.', choices: [{id:'a', text:'«Галина Петровна? Что случилось?»'},{id:'b', text:'[Промолчать]'},{id:'c', text:'[Посмотреть в глазок]'},{id:'open', text:'[Открыть дверь]'}], muffled: true, canContinue: false } });`);
await page.waitForTimeout(2500);
await page.screenshot({ path: 'tests/e2e/out/m-dialogue.png' });
await G(`ui.setState({ dialogue: null });`);

// reader
await G(`g.debugInteract('polaroid') ?? null;`).catch(() => {});
await G(`g.read('Снимок', 'Полароид. Моя входная дверь — изнутри, из прихожей. Снято ночью, со вспышкой.\\nВнизу подпись: 03:17.\\n\\nУ меня нет полароида.', 'polaroid', 'polaroid');`);
await page.waitForTimeout(600);
await page.screenshot({ path: 'tests/e2e/out/m-reader.png' });
await page.locator('.reader').tap({ position: { x: 20, y: 20 } });

// pause
await page.waitForTimeout(300);
console.log('ui:', JSON.stringify(await G(`const u = ui.getState(); return { r: !!u.reader, p: u.phoneOpen, d: !!u.dialogue, c: u.cutscene, call: !!u.incomingCall, peep: u.peephole, paused: u.paused }`)));
await page.locator('.pause').tap();
await page.waitForTimeout(400);
await page.screenshot({ path: 'tests/e2e/out/m-pause.png' });
check(await G(`return ui.getState().paused`), 'pause button pauses the game');
await page.getByRole('button', { name: 'Продолжить' }).tap();

// portrait
await page.setViewportSize({ width: vw.height, height: vw.width });
await page.waitForTimeout(800);
await page.screenshot({ path: 'tests/e2e/out/m-portrait.png' });
check(await page.locator('.rotate-hint').count() === 1, 'portrait shows the rotate hint');
await page.getByRole('button', { name: 'Играть вертикально' }).tap();
await page.waitForTimeout(500);
await page.screenshot({ path: 'tests/e2e/out/m-portrait-game.png' });
check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll in portrait');

check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(ok ? 'MOBILE OK' : 'MOBILE FAILED');
process.exit(ok ? 0 : 1);
