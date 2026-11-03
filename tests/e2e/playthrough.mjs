/**
 * Full Chapter 01 playthrough in headless Chromium (both endings + save/load).
 * Uses the debug hooks on window.__afterlight and a sped-up clock.
 *   node tests/e2e/playthrough.mjs [closed|opened|save]   (default: all)
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL ?? 'http://localhost:4173/';
const which = process.argv[2] ?? 'all';
const SPEED = 6;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let failures = 0;

async function session(name, fn) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 520 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const t0 = Date.now();
  try {
    await fn(page);
    if (errors.length) throw new Error('console errors: ' + errors.join(' | '));
    console.log(`PASS ${name} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  } catch (e) {
    failures++;
    console.log(`FAIL ${name}: ${e.message}`);
    await page.screenshot({ path: `tests/e2e/out/fail-${name}.png` }).catch(() => {});
    const st = await page.evaluate(() => { const g = window.__afterlight?.game(); return g ? { stage: g.s.stage, fired: g.s.fired, flags: g.s.flags, ui: Object.fromEntries(Object.entries(window.__afterlight.ui.getState()).filter(([, v]) => typeof v !== 'function')) } : null; }).catch(() => null);
    console.log(JSON.stringify(st)?.slice(0, 1500));
  }
  await page.close();
}

const ev = (page, fn, arg) => page.evaluate(fn, arg);
const G = (page, body, arg) => page.evaluate(new Function('arg', `const g = window.__afterlight.game(); const ui = window.__afterlight.ui; ${body}`), arg);
async function until(page, body, timeout = 60000, label = body) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await G(page, `return !!(${body});`)) return;
    await page.waitForTimeout(250);
  }
  throw new Error('timeout waiting for: ' + label);
}
async function start(page, button = 'Начать') {
  await page.goto(URL);
  await page.getByRole('button', { name: button }).click();
  await page.waitForFunction(() => window.__afterlight?.game(), null, { timeout: 30000 });
  await G(page, `g.engine.timeScale = ${SPEED};`);
}
const place = (page, x, z, yaw = 0) => G(page, `g.player.place(${x}, ${z}, ${yaw}, 0);`);
const act = (page, id) => G(page, `return g.debugInteract('${id}');`);
const closeReader = (page) => G(page, `ui.setState({ reader: null });`);

async function toStage3(page, { takeKey = false } = {}) {
  await until(page, `g.director.fired('b0_intro') && g.director.since('b0_intro') > 9`);
  // Stage 0 — ordinary life
  await place(page, 6.6, 3.3, -Math.PI / 2);
  await act(page, 'glass');
  await act(page, 'tap');
  await act(page, 'fridge');
  await act(page, 'fridge');
  await act(page, 'kettle');
  await act(page, 'tv');
  await act(page, 'tv');
  if (takeKey) {
    await act(page, 'drawer');
    await act(page, 'drawer');
    if (!(await G(page, `return g.s.inventory.includes('key48')`))) throw new Error('key not taken');
  }
  await until(page, `g.s.flags.drank && g.s.flags.routineCount >= 3`, 20000);
  await until(page, `g.s.stage === 1`, 90000, 'stage 1');
  // Stage 1 — strangeness. Stand in the room facing the window so changes can happen unseen.
  await place(page, 1.6, 5.5, Math.PI);
  await until(page, `g.director.fired('b1_wall') && g.knows('sounds48')`, 60000, 'wall sounds');
  await until(page, `g.s.world.microwave === '0317' && g.s.world.photoFaceDown`, 60000, 'unseen changes');
  await act(page, 'photo'); await closeReader(page);
  await act(page, 'microwave');
  await until(page, `g.s.flags.strangeCount >= 3 || g.s.stage === 2`, 5000).catch(async () => {
    await until(page, `g.s.world.polaroid === 'door'`, 60000, 'polaroid');
    await act(page, 'polaroid'); await closeReader(page);
  });
  await until(page, `g.s.stage === 2`, 90000, 'stage 2');
  // Stage 2 — 03:17
  await until(page, `g.s.phone.threads.find(t => t.id==='me').messages.length >= 1`, 20000, 'msg1');
  if ((await G(page, `return g.clock`)) !== '03:17') throw new Error('clock not 03:17');
  await G(page, `g.s.markRead('me');`);
  await until(page, `g.s.phone.threads.find(t => t.id==='me').messages.length >= 2`, 30000, 'msg2');
  await G(page, `g.s.markRead('me'); g.reply('me', 'Кто это?');`);
  await until(page, `g.s.world.noteDoor === 'v1'`, 60000, 'note');
  await place(page, 3.8, 1.0, 0);
  await act(page, 'noteDoor'); await closeReader(page);
  await place(page, 1.6, 5.5, Math.PI); // look away → note changes
  await until(page, `ui.getState().incomingCall`, 90000, 'call');
  if (!(await G(page, `return g.s.world.hallDead && g.s.world.noteDoor === 'v2'`))) throw new Error('bulb / note v2 missing');
  await G(page, `g.endCall('answered');`);
  await until(page, `g.director.fired('b2_intercom') && g.s.flags.intercomRinging`, 60000, 'intercom');
  await G(page, `g.setFlag('intercomPicked', true);`);
  await until(page, `g.s.world.elevator === 'here'`, 60000, 'elevator');
  await until(page, `g.s.stage === 3`, 60000, 'stage 3');
  // Stage 3 — knocks, then go to the door
  await until(page, `g.director.since('b3_start') > 6 && g.s.world.rain === 0`, 30000, 'knocks');
  await place(page, 3.8, 1.2, 0);
  await until(page, `ui.getState().dialogue && ui.getState().dialogue.choices.length`, 30000, 'dialogue');
}

async function choose(page, id) {
  await until(page, `ui.getState().dialogue && ui.getState().dialogue.choices.some(c => c.id === '${id}')`, 30000, 'choice ' + id);
  await G(page, `g.dialogueChoose('${id}');`);
}

if (which === 'all' || which === 'closed') {
  await session('ending-closed', async (page) => {
    await start(page);
    await toStage3(page);
    await choose(page, 'what');
    await choose(page, 'empty48');
    await until(page, `g.knows('galinaDead')`, 30000, 'dead message');
    await choose(page, 'dead');
    await choose(page, 'refuse');
    await until(page, `ui.getState().dialogue?.canContinue`, 10000);
    await G(page, `g.dialogueAdvance();`);
    await until(page, `g.s.flags.door === 'closed' && g.s.stage === 4`, 20000, 'branch A');
    await until(page, `g.s.world.power === false`, 60000, 'power out');
    await G(page, `g.setFlashlight(true);`);
    await until(page, `g.s.phone.threads.find(t => t.id==='me').messages.some(m => m.text.includes('открыла она'))`, 30000, 'thanks msg');
    await G(page, `g.s.markRead('me');`);
    await place(page, 1.6, 5.5, Math.PI); // look away so the jacket can vanish
    await until(page, `g.s.world.jacket === false && g.s.world.polaroid === 'neighbor'`, 60000, 'jacket gone');
    await until(page, `g.director.since('a_neighbour') > 31 && g.s.fired.includes('a_neighbour')`, 90000);
    await place(page, 4.0, 1.0, -Math.PI / 2);
    await act(page, 'hook');
    await until(page, `ui.getState().screen === 'ending'`, 60000, 'ending screen');
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'tests/e2e/out/ending-closed.png' });
    const res = await ev(page, () => JSON.parse(localStorage.getItem('afterlight.ch1.result')));
    if (res.ending !== 'closed') throw new Error('result not stored');
  });
}

if (which === 'all' || which === 'opened') {
  await session('ending-opened', async (page) => {
    await start(page);
    await toStage3(page, { takeKey: true });
    await choose(page, 'open');
    await until(page, `g.s.flags.door === 'opened' && g.s.world['door.front'] === true`, 20000, 'door opened');
    await page.waitForTimeout(1500);
    await place(page, 2.0, -1.0, Math.PI / 2);
    await act(page, 'door_d48');
    await until(page, `g.s.world['door.d48'] === true`, 5000, '48 open');
    await page.waitForTimeout(800);
    await place(page, -1.2, 1.0, 0);
    await act(page, 'flyer'); await closeReader(page);
    await until(page, `g.knows('voiceIn48')`, 30000, 'voice in 48');
    await until(page, `g.s.world.elevator === 'open'`, 60000, 'elevator open');
    await page.waitForTimeout(1500);
    await place(page, 3.8, -3.7, 0);
    await until(page, `ui.getState().screen === 'ending'`, 90000, 'ending screen');
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'tests/e2e/out/ending-opened.png' });
  });
}

if (which === 'all' || which === 'save') {
  await session('save-load', async (page) => {
    await start(page);
    await until(page, `g.director.fired('b0_intro') && g.director.since('b0_intro') > 9`);
    await place(page, 2.0, 6.0, Math.PI);
    await act(page, 'drawer');
    await act(page, 'drawer'); // take key
    await G(page, `g.setWorld('light.room', true); g.player.place(2.2, 4.4, 1.2, 0);`);
    const saved = await G(page, `return g.save(true);`);
    if (!saved) throw new Error('save failed');
    await page.reload();
    await page.getByRole('button', { name: /Продолжить/ }).click();
    await page.waitForFunction(() => window.__afterlight?.game(), null, { timeout: 30000 });
    await page.waitForTimeout(1000);
    const st = await G(page, `return { key: g.s.inventory.includes('key48'), light: g.s.world['light.room'], drawer: g.s.world.drawer, x: g.player.x, intro: g.s.fired.includes('b0_intro'), lamp: g.lamps.room.target };`);
    if (!st.key || !st.light || !st.drawer || Math.abs(st.x - 2.2) > 0.05 || !st.intro || st.lamp !== 1) throw new Error('state not restored: ' + JSON.stringify(st));
  });
}

await browser.close();
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
