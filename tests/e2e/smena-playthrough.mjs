/**
 * «Последняя смена» — full episode playthrough in headless Chromium.
 * Drives the story through the real systems (interactables, doors, physics grab,
 * director beats, creature FSM), checks save → reload → continue, death → checkpoint,
 * and fails on any console error. Usage: start `npm run dev` / `npm run preview`,
 * then `node tests/e2e/smena-playthrough.mjs [baseUrl]`.
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] ?? 'http://localhost:5173';
const shots = process.env.SHOTS;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
let step = 0;
const ok = (msg) => console.log(`✓ ${++step}. ${msg}`);
const fail = async (msg) => {
  console.error('✗ ' + msg);
  if (shots) await page.screenshot({ path: `${shots}/fail.png` });
  console.error(errors.join('\n'));
  await browser.close();
  process.exit(1);
};
const G = (fn, arg) => page.evaluate(fn, arg);
const waitFor = async (fn, arg, ms, what) => {
  try {
    await page.waitForFunction(fn, arg, { timeout: ms, polling: 100 });
  } catch {
    await fail('timeout: ' + what + ' ' + JSON.stringify(await G(() => ({ stage: window.__smena.game.stage, flags: window.__smena.game.flags }))));
  }
};
const snap = async (n) => shots && page.screenshot({ path: `${shots}/${n}.png` });
const stageIs = (n) => waitFor((n) => window.__smena.game.stage >= n, n, 90000, 'stage ' + n);
const tp = (x, z, yaw) => G(([x, z, yaw]) => window.__smena.game.player.teleport(x, 0.2, z, yaw), [x, z, yaw]);
const use = (id) => G((id) => window.__smena.game.interact.get(id).use(), id);
const take = (id) => G((id) => window.__smena.game.takePickup(id), id);

await page.goto(base + '/smena/');
await page.waitForSelector('.menu', { timeout: 60000 });
await waitFor(() => !document.querySelector('.loading-dot'), null, 60000, 'physics');
ok('menu loaded, physics ready');
await snap('01-menu');
await page.click('text=Новая игра');
await page.waitForSelector('.hud-obj', { timeout: 30000 });
await G(() => (window.__smena.game.engine.timeScale = 4));
ok('new game started');

// real aiming interaction: face the booth door and press E
await tp(3.2, 14.6, -Math.PI / 2);
// first frames compile shaders (slow in software GL): wait for the aim system to catch up
await page.waitForFunction(() => window.__smena.game.interact.focus?.id === 'door:boothDoor', null, { timeout: 15000 }).catch(() => {});
const focus = await G(() => window.__smena.game.interact.focus?.id);
if (focus !== 'door:boothDoor') await fail('aim should focus the booth door, got ' + focus);
await page.keyboard.press('KeyE');
await waitFor(() => window.__smena.game.door('boothDoor').open, null, 3000, 'door opens');
ok('aim + E opens the booth door (physics hinge)');
// walk into the booth with real movement
await tp(3.4, 14.6, -Math.PI / 2);
await page.keyboard.down('KeyW');
// headless software GL is slow: wait for simulated distance rather than wall-clock time
await page.waitForFunction(() => window.__smena.game.player.pos.x > 4.9, null, { timeout: 20000 }).catch(() => {});
await page.keyboard.up('KeyW');
const px = await G(() => window.__smena.game.player.pos.x);
if (px < 4.6) await fail('player should walk into the booth, x=' + px);
ok(`walked through the doorway (x=${px.toFixed(2)})`);
await snap('02-booth');
await take('pk_flashlight');
await take('pk_walkie');
await page.keyboard.press('KeyF');
if (!(await G(() => window.__smena.game.flashlight.on))) await fail('flashlight should turn on');
ok('flashlight + walkie taken, F toggles light');
await stageIs(2);
ok('briefing done → stage 2');

await tp(14, -6.5, Math.PI);
await use('generator');
await stageIs(3);
ok('generator empty → stage 3');
// key from the board, storage door, carry the canister with physics
await take('pk_key_storage');
await G(() => {
  const g = window.__smena.game;
  const d = g.door('storageDoor');
  d.toggle((k) => g.hasItem(k));
  d.setOpen(true);
});
await tp(13, 6, Math.PI);
await page.waitForTimeout(300);
const picked = await G(() => {
  const g = window.__smena.game;
  const c = g.ph.props.find((p) => p.mesh === g.world.ctx.spots.canister);
  return g.grab.pick(c);
});
if (!picked) await fail('canister should be grabbable');
// carry it over: teleport the player and the held body together (a long walk is too slow in software GL)
await G(() => {
  const g = window.__smena.game;
  g.player.teleport(14, 0.2, -6.4, 0);
  g.grab.held.body.setTranslation({ x: 14, y: 1.45, z: -7.6 }, true);
});
await page.waitForTimeout(500);
const held = await G(() => !!window.__smena.game.grab.held);
if (!held) await fail('canister should stay in hands while walking');
await use('generator');
await stageIs(4);
ok('canister carried by physics grab and poured → stage 4');
await use('generator');
await use('generator');
await stageIs(5);
if (!(await G(() => window.__smena.game.world.pool.powered.base))) await fail('base power should be on');
ok('generator started, lights on → stage 5');
await snap('03-yard-lit');

await tp(-8.6, 0.3, 0);
await page.waitForTimeout(300);
for (let i = 0; i < 3; i++) await use('cctv');
await stageIs(6);
if (!(await G(() => window.__smena.game.figures.cctvMan.root.visible))) await fail('man on camera 3 should be visible to CCTV');
ok('camera 3 shows a man → stage 6');
await page.waitForTimeout(800);
await snap('04-cctv');
await tp(-3, 2, 0);
await waitFor(() => !window.__smena.game.figures.cctvMan.root.visible, null, 5000, 'man vanishes');
ok('leaving the room: the man is gone, tracks appear');
await G(() => {
  const g = window.__smena.game;
  for (const id of ['northGateL', 'northGateR']) g.door(id).setOpen(true);
});
await tp(0, -19, Math.PI);
await stageIs(7);
ok('north gate checked → stage 7');
await take('pk_fuse');
await G(() => window.__smena.game.save('manual'));
await page.waitForTimeout(500);

// save → reload → continue
await page.reload();
await page.waitForSelector('.menu', { timeout: 60000 });
await waitFor(() => !document.querySelector('.loading-dot'), null, 60000, 'physics after reload');
await page.click('text=Продолжить');
await page.waitForSelector('.hud-obj', { timeout: 30000 });
const restored = await G(() => {
  const g = window.__smena.game;
  return { stage: g.stage, fuse: g.inv.has('fuse'), torch: g.flashlight.owned, power: g.world.pool.powered.base, gen: g.flag('genOn') };
});
if (restored.stage !== 7 || !restored.fuse || !restored.torch || !restored.power) await fail('save restore mismatch ' + JSON.stringify(restored));
ok('reload + continue restored stage 7, inventory, flashlight, generator');
await G(() => (window.__smena.game.engine.timeScale = 4));

// forest: the passive creature sighting
await tp(-25, -80, Math.PI);
await waitFor(() => window.__smena.game.creature.mode === 'passive', null, 30000, 'creature appears');
ok('something crosses the road (creature, passive patrol)');
await page.waitForTimeout(1500);
await snap('05-forest');
await waitFor(() => window.__smena.game.flag('creatureSeen') > 0, null, 120000, 'creature leaves');
ok('it walks off and despawns');

// village relay
await tp(-31, -122, Math.PI);
await stageIs(8);
await take('pk_screwdriver');
await use('relay');
await use('relay');
await stageIs(9);
ok('relay fixed with screwdriver + fuse → radio plays your own voice → stage 9');
await take('pk_pass');
await take('pk_fusebox_key');
await take('pk_flare_village');

// complex
await tp(38.6, -148.5, Math.PI);
await use('passReader');
await waitFor(() => !window.__smena.game.door('cxEntrance').locked, null, 3000, 'pass opens');
ok('pass card opens the complex');
await tp(38, -153, Math.PI);
await stageIs(10);
await G(() => {
  const g = window.__smena.game;
  const d = g.door('cxElectric');
  d.toggle((k) => g.hasItem(k));
});
if (await G(() => window.__smena.game.door('cxElectric').locked)) await fail('electrical room should unlock with the key');
await tp(51, -151.5, 0);
await use('breakers');
await stageIs(11);
ok('breakers on → complex powered → stage 11');
await take('pk_flaregun');
await take('pk_flare_cx');
await tp(43, -162.5, 0);
await page.waitForTimeout(300);
await snap('06-lab');
await G(() => window.__smena.game.readDoc('shiftJournal'));
await page.waitForTimeout(200);
await G(() => window.__smena.game.closeDoc());
await stageIs(12);
await waitFor(() => ['Chase', 'Attack', 'Search', 'Investigate'].includes(window.__smena.game.creature.fsm.state), null, 10000, 'hunt starts');
ok('journal read → the cell opens, the hunt begins (Chase)');
await page.waitForTimeout(1200);
await snap('07-hunt');
// flare stun
await G(() => {
  const g = window.__smena.game;
  const c = g.creature;
  g.player.teleport(c.pos.x, c.pos.y + 0.2, c.pos.z + 6, 0);
  g.player.pitch = 0.1;
  g.inv.select('flaregun');
  g.useItem('flaregun');
});
await waitFor(() => window.__smena.game.creature.fsm.state === 'Flee', null, 4000, 'flare stun');
ok('flare shot → creature flees');

// death → checkpoint
await G(() => window.__smena.game.player.damage(500));
await page.waitForSelector('text=Смена прервана', { timeout: 10000 });
ok('death screen');
await page.click('text=С контрольной точки');
await page.waitForSelector('.hud-obj', { timeout: 30000 });
const afterDeath = await G(() => ({ stage: window.__smena.game.stage, hp: window.__smena.game.player.health, mode: window.__smena.game.creature.mode }));
if (afterDeath.stage !== 12 || afterDeath.hp !== 100 || afterDeath.mode !== 'hunt') await fail('checkpoint restore ' + JSON.stringify(afterDeath));
ok('checkpoint restored at stage 12 with the hunter respawned far away');
await G(() => (window.__smena.game.engine.timeScale = 4));

// back to base
await tp(0, -10, 0);
await stageIs(13);
ok('reached the lit compound → gates shut → stage 13');
await tp(-8.0, 0.0, 0);
await use('radio');
await page.waitForSelector('text=Ночная смена № 01', { timeout: 120000 });
ok('final radio call → «Ты уверен, что сегодня твоя первая смена?» → end screen');
await snap('08-end');

const stats = await G(() => ({ calls: window.__smena.game.engine.renderer.info.render.calls, tris: window.__smena.game.engine.renderer.info.render.triangles }));
console.log('render stats at end:', JSON.stringify(stats));
if (errors.length) await fail('console errors:\n' + errors.join('\n'));
console.log('ALL OK');
await browser.close();
