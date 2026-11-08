import * as THREE from 'three';
import { Engine, resolveQuality } from './core/Engine';
import { Input, type Action } from './core/Input';
import { G, groups, loadRapier, Physics, type Prop } from './core/Physics';
import { World } from './world/World';
import { Player } from './player/Player';
import { Flashlight } from './player/Flashlight';
import { Hands } from './player/Hands';
import { InteractionSystem, type Verb } from './gameplay/Interaction';
import { Inventory } from './gameplay/Inventory';
import { ITEMS, type ItemId } from './gameplay/items';
import { Grab } from './gameplay/Grab';
import { FlareSystem } from './gameplay/Flare';
import { AudioEngine } from './audio/AudioEngine';
import { Ambience, type Zone } from './audio/Ambience';
import * as S from './audio/synth';
import { Creature } from './ai/Creature';
import { buildNavGraph } from './ai/navmap';
import type { NavGraph } from './ai/NavGraph';
import { Cctv } from './horror/Cctv';
import { Figures } from './horror/Figures';
import { Anomalies } from './horror/Anomalies';
import { Director } from './story/Director';
import { buildEpisode, type Episode } from './story/episode01';
import { DOCS, LINES, OBJECTIVES, type Line } from './story/texts';
import { saves, type SaveData, type Slot } from './save/SaveSystem';
import { pushSubtitle, toast, useGame } from './state/game';
import { useSettings, type Quality } from './state/settings';
import { telegram } from './platform/telegram';
import { ZONES } from './world/layout';
import type { Door } from './world/Door';
import type { QualityProfile } from './core/quality';
import { formatClock } from '@/utils/math';

export type DoorHook = (d: Door) => boolean;

/**
 * Composition root of a play session. Owns every system, runs them in a fixed
 * order each frame and exposes small "verbs" (say, setStage, power, fade…) that
 * the episode script and the anomaly system use.
 */
export class Game {
  readonly engine: Engine;
  readonly input: Input;
  readonly world: World;
  readonly player: Player;
  readonly flashlight: Flashlight;
  readonly hands: Hands;
  readonly interact = new InteractionSystem();
  readonly inv = new Inventory();
  readonly audio = new AudioEngine();
  readonly ambience: Ambience;
  readonly cctv: Cctv;
  readonly figures: Figures;
  readonly flare: FlareSystem;
  readonly nav: NavGraph;
  ph: Physics | null = null;
  grab: Grab | null = null;
  creature: Creature | null = null;
  anomalies!: Anomalies;
  director!: Director<Game>;
  episode!: Episode;
  stage = 0;
  flags: Record<string, number> = {};
  docsRead = new Set<string>();
  taken = new Set<string>();
  seed = Math.floor(Math.random() * 1e9);
  playTime = 0;
  deaths = 0;
  mode: 'menu' | 'play' = 'menu';
  readonly doorHooks = new Map<string, DoorHook>();
  private hudT = 0;
  private fadeTarget = 0;
  private fadeSpeed = 1;
  private fade = 1;
  private fear = 0;
  private damageFlash = 0;
  private menuT = 0;
  private sayQueue: Promise<void> = Promise.resolve();
  private lastLook = { x: 0, y: 0 };
  private zoneName: Zone = 'base';
  private clockMin = 40;
  private onReady: (() => void)[] = [];
  private disposed = false;

  constructor(container: HTMLElement) {
    this.engine = new Engine(container);
    this.world = new World(this.engine.scene, this.engine.profile);
    this.input = new Input(container);
    this.player = new Player(this.engine.camera, this.input);
    this.flashlight = new Flashlight(this.engine.camera);
    this.flashlight.setShadow(this.engine.profile.shadow);
    this.hands = new Hands(this.engine.camera, this.world.M);
    this.ambience = new Ambience(this.audio);
    this.figures = new Figures(this.engine.scene);
    this.flare = new FlareSystem(this.engine.scene, () => this.ph);
    this.nav = buildNavGraph();
    const ctx = this.world.ctx;
    this.cctv = new Cctv(this.engine.profile.cctvRes, ctx.cams);
    this.cctv.addFeed({ id: 'boothCam', label: 'КАМ 5 · КПП', pos: new THREE.Vector3(7.0, 2.35, 15.9), look: new THREE.Vector3(5.6, 0.8, 14.2) });
    this.cctv.addScreen(ctx.spots.cctvScreen as THREE.Mesh, ['cam1', 'cam2', 'cam3', 'cam4']);
    this.cctv.addScreen(ctx.spots.cctvScreen2 as THREE.Mesh, []);
    this.cctv.addScreen(ctx.spots.cxScreen as THREE.Mesh, ['boothCam']);
    this.cctv.addScreen(ctx.spots.labScreen as THREE.Mesh, ['cxCam']);
    this.engine.addRenderHook((r) => this.cctv.renderHook(r, this.engine.scene));
    this.engine.onQualityChange = (q, p) => this.onQuality(q, p);
    this.world.onThunder = (delay, s) => setTimeout(() => this.audio.ready && S.thunder(this.audio, this.audio.bus.amb, s), delay * 1000);
    this.input.onAction = (a) => this.onAction(a);
    this.setupInteractions();
    this.episode = buildEpisode(this);
    this.director = new Director<Game>(this, this.episode.beats);
    this.anomalies = new Anomalies(this);
    this.engine.add((dt, t) => this.update(dt, t));
    this.engine.start();
    useGame.getState().set({ stats: { playTime: 0, deaths: 0, docs: 0, docsTotal: Object.keys(DOCS).length } });
    void this.initPhysics();
  }

  private async initPhysics() {
    try {
      const R = await loadRapier();
      if (this.disposed) return;
      const ph = new Physics(R);
      ph.activeRadius = this.engine.profile.physicsRadius;
      this.world.attachPhysics(ph);
      this.player.attach(ph);
      const spawn = this.world.ctx.spots.spawn.position;
      this.player.teleport(spawn.x, 0.05, spawn.z, -Math.PI / 2);
      this.grab = new Grab(ph, this.engine.camera);
      this.grab.onThrow = (p) => this.noise(p.mesh.position, 8);
      ph.onImpact = (p, f) => this.onImpact(p, f);
      this.creature = new Creature({
        ph,
        nav: this.nav,
        doors: this.world.ctx.doors,
        playerPos: () => this.player.pos,
        playerEye: () => this.engine.camera.position,
        playerState: () => ({ crouching: this.player.crouching, moving: this.player.speed > 0.5, flashlightOn: this.flashlight.on, inLight: this.inLight(this.player.pos), inCover: this.inCover(), dead: this.player.dead }),
        litByFlashlight: (p) => this.flashlight.illuminates(p, 20),
        damagePlayer: (n, from) => this.hurtPlayer(n, from),
        forbidden: (x, z) => this.isSafeZone(x, z),
        sound: (k, p) => this.creatureSound(k, p),
        onState: (s) => {
          if (s === 'Chase') telegram.haptic('warning');
        },
      });
      this.creature.attach(this.engine.scene);
      this.ph = ph;
      this.player.ev = {
        footstep: (s, v, run) => {
          if (!this.audio.ready) return;
          S.footstep(this.audio, this.audio.bus.sfx, s, v * (this.player.crouching ? 0.5 : 1));
          this.anomalies.onFootstep(run);
        },
        noise: (p, r) => this.noise(p, r),
        land: (sp) => sp > 4 && this.audio.ready && S.footstep(this.audio, this.audio.bus.sfx, this.player.surface, 1.3),
        hurt: () => {
          this.damageFlash = 1;
          if (this.audio.ready) S.hurt(this.audio, this.audio.bus.sfx);
          if (useSettings.getState().haptics) telegram.haptic('heavy');
        },
      };
      useGame.getState().set({ physicsReady: true });
      this.onReady.forEach((f) => f());
      this.onReady = [];
    } catch (e) {
      console.error('physics init failed', e);
      useGame.getState().set({ loadingText: 'Не удалось загрузить физику. Обновите страницу.' });
    }
  }

  whenReady(f: () => void) {
    if (this.ph) f();
    else this.onReady.push(f);
  }

  // ------------------------------------------------------------------ verbs
  flag(k: string) {
    return this.flags[k] ?? 0;
  }
  setFlag(k: string, v = 1) {
    this.flags[k] = v;
  }
  door(id: string) {
    return this.world.ctx.doors.find((d) => d.id === id)!;
  }
  prop(id: string) {
    return this.ph?.props.find((p) => p.id === id);
  }
  hasItem(id: ItemId) {
    if (id === 'flashlight') return this.flashlight.owned;
    return this.inv.has(id);
  }

  setStage(n: number, save = true) {
    if (n <= this.stage && this.stage !== 0) return;
    this.stage = n;
    this.refreshObjective(true);
    if (save && n < 14) void this.save('auto');
  }

  refreshObjective(flash = false) {
    let text = OBJECTIVES[this.stage] ?? '';
    if (this.stage === 7 && !this.inv.has('fuse') && !this.flag('fuseUsed')) text += ' · возьмите предохранитель на складе';
    if (this.stage === 8 && !this.inv.has('screwdriver') && !this.flag('relayOpen')) text = 'Найдите отвёртку, чтобы открыть щиток ретранслятора';
    if (this.stage === 9 && !this.inv.has('pass')) text += ' · нужен пропуск';
    if (this.stage === 10 && !this.inv.has('fusebox_key')) text = 'Найдите ключ от щитовой (в деревне?)';
    useGame.getState().set({ objective: text, objectiveFlash: flash ? Date.now() : useGame.getState().objectiveFlash });
  }

  /** Radio/thought lines; returns when finished. Lines queue up and never overlap. */
  say(lines: Line[] | string): Promise<void> {
    const list = typeof lines === 'string' ? LINES[lines] ?? [] : lines;
    const run = async () => {
      for (const l of list) {
        const dur = l.dur ?? Math.min(7, 1.6 + l.text.length * 0.055);
        if (useSettings.getState().subtitles || l.who !== 'hero') pushSubtitle(l.who, l.text, dur + 0.4);
        if (this.audio.ready) {
          if (l.who === 'disp' || l.who === 'echo') {
            S.radioSquelch(this.audio, this.audio.bus.voice, 0.18);
            S.radioVoice(this.audio, this.audio.bus.voice, dur * 0.85, l.who === 'echo' ? 128 : 102);
            setTimeout(() => this.audio.ready && S.radioSquelch(this.audio, this.audio.bus.voice, 0.1), dur * 1000);
          } else if (l.who === 'radio') S.radioVoice(this.audio, this.audio.bus.voice, dur * 0.8, 140, true);
        }
        if (l.who === 'disp' || l.who === 'echo') this.engine.post.u.uStatic.value = l.who === 'echo' ? 0.25 : 0.04;
        await this.director.wait(dur + 0.35);
        this.engine.post.u.uStatic.value = 0;
      }
    };
    this.sayQueue = this.sayQueue.then(run, run);
    return this.sayQueue;
  }

  /** Power groups: base (generator), complex, emergency, village (relay). */
  power(group: 'base' | 'complex' | 'emergency' | 'village', on: boolean) {
    this.world.pool.powered[group] = on;
    if (group === 'base') this.ambience.setGenerator(on, this.world.ctx.spots.generator.getWorldPosition(new THREE.Vector3()));
    if (group === 'complex') this.ambience.humOn = on;
  }

  fadeTo(v: number, seconds: number) {
    this.fadeTarget = v;
    this.fadeSpeed = 1 / Math.max(0.01, seconds);
  }

  sfx(play: (dest: AudioNode) => void, pos?: THREE.Vector3, bus: 'sfx' | 'amb' | 'voice' = 'sfx') {
    if (!this.audio.ready) return;
    if (pos) this.audio.at(pos, play, bus, 5, this.mufflingTo(pos));
    else play(this.audio.bus[bus]);
  }

  /** Crude occlusion: sounds from another enclosed building are muffled. */
  private mufflingTo(p: THREE.Vector3) {
    const a = this.world.indoorAt(this.player.pos), b = this.world.indoorAt(p);
    if (a === b) return 1;
    return a && b ? 0.25 : a || b ? 0.45 : 1;
  }

  noise(p: THREE.Vector3, r: number) {
    this.creature?.hearNoise(p, r);
  }

  /** Inside the lit compound (generator on) — the creature won't go there. */
  isSafeZone(x: number, z: number) {
    if (!this.world.pool.powered.base) return false;
    const b = ZONES.base;
    return Math.abs(x - b.x) < b.hx - 1.5 && z > b.z - b.hz + 1 && z < b.z + b.hz;
  }

  inLight(p: THREE.Vector3) {
    for (const l of this.world.ctx.lamps) if (l.k > 0.5 && this.world.pool.lit(l) && l.pos.distanceToSquared(p) < (l.range * 0.45) ** 2) return true;
    return this.flare.active && this.flare.pos.distanceTo(p) < 8;
  }

  private inCover() {
    // crouching among trunks/bushes counts as cover
    if (!this.player.crouching) return false;
    const p = this.player.pos;
    let n = 0;
    for (const t of this.world.forest.trunks) if (Math.abs(t.x - p.x) < 3 && Math.abs(t.z - p.z) < 3 && ++n >= 2) return true;
    return false;
  }

  hurtPlayer(n: number, from: THREE.Vector3) {
    this.player.damage(n);
    const push = this.player.pos.clone().sub(from).setY(0).normalize();
    this.player.yaw += (Math.random() - 0.5) * 0.4;
    void push;
  }

  private creatureSound(k: 'step' | 'breath' | 'click' | 'roar' | 'hit', p: THREE.Vector3) {
    const pos = p.clone().setY(p.y + 1.8);
    if (k === 'step') this.sfx((d) => S.creatureStep(this.audio, d, 0.8), pos);
    else if (k === 'breath') this.sfx((d) => S.creatureBreath(this.audio, d), pos);
    else if (k === 'click') this.sfx((d) => S.creatureClick(this.audio, d), pos);
    else if (k === 'roar') this.sfx((d) => S.creatureRoar(this.audio, d), pos);
    else this.sfx((d) => S.impact(this.audio, d, 'wood', 1), pos);
  }

  private onImpact(p: Prop, f: number) {
    if (!this.audio.ready) return;
    const s = Math.min(1, f / (40 * p.mass + 30));
    if (s < 0.08) return;
    this.sfx((d) => S.impact(this.audio, d, p.material, s), p.mesh.position.clone());
    if (s > 0.3) this.noise(p.mesh.position, 6 + s * 10);
  }

  // ------------------------------------------------------------------ interactions
  private setupInteractions() {
    const ctx = this.world.ctx;
    const verbFor = (d: Door): Verb => (d.locked ? 'locked' : 'door');
    for (const d of ctx.doors) {
      d.onSound = (kind, door) => {
        const pos = door.center();
        if (kind === 'open') {
          this.sfx((x) => S.doorLatch(this.audio, x, door.opts.heavy), pos);
          this.sfx((x) => S.creak(this.audio, x, door.opts.heavy ? 1.2 : 0.7, door.opts.heavy ? 0.6 : 1), pos);
        } else if (kind === 'close') setTimeout(() => this.sfx((x) => S.doorLatch(this.audio, x, door.opts.heavy), pos), 450);
        else if (kind === 'locked') this.sfx((x) => S.doorLocked(this.audio, x), pos);
        else this.sfx((x) => S.keyTurn(this.audio, x), pos);
      };
      this.interact.add({
        id: 'door:' + d.id,
        targets: [d.leaf],
        verb: () => verbFor(d),
        label: () => {
          if (d.locked) return d.opts.keyId && this.hasItem(d.opts.keyId as ItemId) ? `Отпереть: ${d.opts.label ?? 'дверь'}` : `Заперто: ${d.opts.label ?? 'дверь'}`;
          return d.open ? 'Закрыть' : `Открыть: ${d.opts.label ?? 'дверь'}`;
        },
        use: () => {
          const hook = this.doorHooks.get(d.id);
          if (hook && hook(d)) return;
          const r = d.toggle((k) => this.hasItem(k as ItemId));
          if (r === 'unlock') {
            toast(`Отперто: ${d.opts.label ?? 'дверь'}`);
            setTimeout(() => d.setOpen(true), 350);
          }
          if (r === 'open' || r === 'close') this.noise(d.center(), d.opts.heavy ? 9 : 5);
        },
      });
    }
    for (const p of ctx.pickups) {
      this.interact.add({
        id: 'pick:' + p.id,
        targets: [p.mesh],
        verb: () => 'take',
        range: 2.4,
        enabled: () => !this.taken.has(p.id),
        label: () => `Взять: ${ITEMS[p.item].name}${p.count > 1 ? ` ×${p.count}` : ''}`,
        use: () => this.takePickup(p.id),
      });
    }
    for (const dc of ctx.docs) {
      this.interact.add({
        id: 'doc:' + dc.id,
        targets: [dc.mesh],
        verb: () => 'read',
        range: 2.4,
        label: () => `Читать: ${DOCS[dc.docId]?.title ?? 'записка'}`,
        use: () => this.readDoc(dc.docId),
      });
    }
    // only walls block prompts; a margin lets items on shelves/in wardrobes (inside a furniture box) stay reachable
    this.interact.blocked = (o, dir, dist) => dist > 0.5 && !!this.ph?.raycast(o, dir, dist - 0.45, groups(0xffff, G.STATIC));
  }

  takePickup(id: string, silent = false) {
    const p = this.world.ctx.pickups.find((x) => x.id === id);
    if (!p || this.taken.has(id)) return false;
    if (p.item === 'flashlight') {
      this.flashlight.owned = true;
      this.hands.torchVisible = true;
    } else if (p.item === 'walkie') {
      this.setFlag('walkie');
    } else {
      const added = this.inv.add(p.item, p.count);
      if (!added) {
        if (!silent) toast('Нет места в рюкзаке');
        return false;
      }
    }
    this.taken.add(id);
    p.mesh.visible = false;
    this.interact.markDirty();
    if (!silent) {
      toast(`+ ${ITEMS[p.item].name}${p.count > 1 ? ` ×${p.count}` : ''}`);
      this.sfx((d) => S.pickup(this.audio, d));
      if (p.item === 'flashlight') toast(this.input.usingTouch ? 'Фонарь: кнопка с лампой' : 'Фонарь: F', 3.5);
    }
    this.syncInventoryUI();
    this.refreshObjective();
    return true;
  }

  readDoc(docId: string) {
    this.docsRead.add(docId);
    this.sfx((d) => S.paper(this.audio, d));
    useGame.getState().set({ reading: docId, docsRead: [...this.docsRead] });
    this.setPausedForUI(true);
    this.episode.onRead?.(docId);
  }

  closeDoc() {
    useGame.getState().set({ reading: null });
    this.setPausedForUI(false);
  }

  /** Inventory/doc readers freeze the world (it's a horror game: no menu-camping deaths). */
  setPausedForUI(v: boolean) {
    if (this.mode !== 'play') return;
    this.engine.paused = v;
    this.input.enabled = !v;
    this.audio.setDuck(v ? 0.45 : 1);
  }

  useItem(id: ItemId | null = this.inv.selected) {
    if (!id || !this.inv.has(id)) return;
    if (id === 'medkit') {
      if (this.player.health >= 100) return toast('Вы не ранены');
      this.inv.remove('medkit');
      this.player.heal(60);
      toast('Аптечка использована');
      this.sfx((d) => S.paper(this.audio, d, 0.8));
    } else if (id === 'battery') {
      if (!this.flashlight.owned) return;
      if (this.flashlight.battery > 90) return toast('Фонарь заряжен');
      this.inv.remove('battery');
      this.flashlight.recharge();
      toast('Батарейки заменены');
      this.sfx((d) => S.click(this.audio, d, 0.6));
    } else if (id === 'flaregun') {
      if (!this.inv.has('flare')) {
        this.sfx((d) => S.click(this.audio, d, 0.4));
        return toast('Нет сигнальных патронов');
      }
      if (this.flare.active && this.flare.burning > 10) return;
      this.inv.remove('flare');
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.engine.camera.quaternion);
      this.flare.fire(this.engine.camera.position.clone(), dir);
      this.hands.kick();
      this.sfx((d) => S.flareShot(this.audio, d));
      this.noise(this.player.pos, 30);
      // shot in its direction → it flees
      const c = this.creature;
      if (c && c.mode !== 'off') {
        const to = c.pos.clone().setY(c.pos.y + 1.5).sub(this.engine.camera.position);
        if (to.length() < 30 && to.normalize().dot(dir) > 0.93) c.stun();
      }
    }
    this.syncInventoryUI();
  }

  syncInventoryUI() {
    this.hands.gunOut = this.inv.selected === 'flaregun';
    useGame.getState().set({ inventory: this.inv.list(), selected: this.inv.selected, flashlightOwned: this.flashlight.owned });
  }

  // ------------------------------------------------------------------ input
  private onAction(a: Action) {
    const ui = useGame.getState();
    if (a === 'pause') {
      if (ui.reading) return this.closeDoc();
      if (ui.invOpen || ui.journalOpen) return this.toggleInventory(false);
      if (ui.monitor) return;
      if (ui.screen === 'playing') return this.pause(true);
      if (ui.screen === 'paused') return this.pause(false);
      return;
    }
    if (this.mode !== 'play' || ui.screen !== 'playing') return;
    if (ui.reading) {
      if (a === 'interact') this.closeDoc();
      return;
    }
    if (a === 'inventory') return this.toggleInventory(!ui.invOpen);
    if (a === 'journal') return this.toggleInventory(!ui.journalOpen, true);
    if (ui.invOpen || ui.journalOpen) return;
    if (this.player.dead) return;
    if (a === 'flashlight') {
      if (this.flashlight.toggle()) this.sfx((d) => S.click(this.audio, d, this.flashlight.on ? 1 : 0.8));
      else if (this.flashlight.owned) toast('Батарейки сели');
    } else if (a === 'crouch') this.player.toggleCrouch();
    else if (a === 'interact') {
      if (this.grab?.held) {
        this.grab.drop(false);
        return;
      }
      if (this.interact.activate()) return;
      const p = this.grab?.aimed();
      if (p && this.grab!.pick(p)) this.sfx((d) => S.pickup(this.audio, d));
    } else if (a === 'use') {
      if (this.grab?.held) {
        this.grab.drop(true);
        return;
      }
      this.useItem();
    } else if (a.startsWith('slot')) {
      const i = Number(a.slice(4));
      const it = this.inv.list()[i];
      if (it && ITEMS[it.id].usable) {
        this.inv.select(it.id);
        this.syncInventoryUI();
      }
    }
  }

  toggleInventory(open: boolean, journal = false) {
    useGame.getState().set({ invOpen: open && !journal, journalOpen: open && journal });
    this.setPausedForUI(open);
  }

  pause(v: boolean) {
    if (this.mode !== 'play') return;
    useGame.getState().set({ screen: v ? 'paused' : 'playing', invOpen: false, journalOpen: false });
    this.engine.paused = v;
    this.input.enabled = !v;
    this.input.reset();
    this.audio.setDuck(v ? 0.25 : 1);
    if (v && document.pointerLockElement) document.exitPointerLock();
    telegram.setBack(v ? () => this.pause(false) : () => this.pause(true));
  }

  // ------------------------------------------------------------------ flow
  /** Start/continue from the main menu (inside a user gesture: unlocks audio). */
  async begin(data: SaveData | null) {
    this.audio.unlock();
    this.audio.hrtf = this.engine.profile.hrtf;
    if (!this.ambience.started) this.ambience.start();
    this.fadeTo(1, 0.6);
    await new Promise((r) => setTimeout(r, 650));
    await new Promise<void>((r) => this.whenReady(r));
    this.resetSession();
    if (data) this.applySave(data);
    else {
      this.seed = Math.floor(Math.random() * 1e9);
      this.anomalies.reseed(this.seed);
      const sp = this.world.ctx.spots.spawn.position;
      this.player.teleport(sp.x, 0.05, sp.z, -Math.PI / 2);
      this.refreshObjective(true);
      void this.save('auto');
    }
    this.mode = 'play';
    this.input.enabled = true;
    this.engine.paused = false;
    useGame.getState().set({ screen: 'playing', hasSave: true });
    telegram.setBack(() => this.pause(true));
    this.fadeTo(0, 1.6);
  }

  private resetSession() {
    // pending lines from the previous session wait on cancelled timers forever — start a fresh queue
    this.sayQueue = Promise.resolve();
    this.engine.post.u.uStatic.value = 0;
    this.director.reset();
    this.flags = {};
    this.stage = 0;
    this.docsRead.clear();
    this.taken.clear();
    this.playTime = 0;
    this.inv.load({ items: {}, selected: null });
    this.flashlight.owned = false;
    this.flashlight.on = false;
    this.flashlight.battery = 100;
    this.hands.torchVisible = false;
    this.player.health = 100;
    this.player.dead = false;
    this.player.stamina = 100;
    if (this.player.crouching) this.player.toggleCrouch();
    this.player.frozen = false;
    this.player.lookAt(null);
    this.player.speedMul = 1;
    this.grab?.drop();
    this.creature?.despawn();
    for (const p of this.world.ctx.pickups) p.mesh.visible = true;
    for (const d of this.world.ctx.doors) {
      d.setLocked(d.opts.locked);
      d.setOpen(false, true);
    }
    for (const pr of this.ph?.props ?? []) {
      pr.body.setEnabled(true);
      pr.body.setTranslation(pr.home, true);
      pr.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      pr.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      pr.mesh.visible = true;
      pr.mesh.position.copy(pr.home);
    }
    this.episode.reset();
    this.anomalies.reset();
    this.power('base', false);
    this.power('complex', false);
    this.power('village', false);
    this.power('emergency', true);
    this.interact.markDirty();
    this.syncInventoryUI();
    useGame.getState().set({ docsRead: [], reading: null, invOpen: false, journalOpen: false, subtitles: [], monitor: null });
  }

  serialize(): SaveData {
    const doors: SaveData['doors'] = {};
    for (const d of this.world.ctx.doors) doors[d.id] = { open: d.open, locked: d.locked };
    return {
      v: 1,
      savedAt: Date.now(),
      playTime: this.playTime,
      seed: this.seed,
      stage: this.stage,
      flags: { ...this.flags, deaths: this.deaths },
      beats: [...this.director.fired],
      player: this.player.serialize(),
      flashlight: { owned: this.flashlight.owned, on: this.flashlight.on, battery: this.flashlight.battery },
      inv: this.inv.serialize(),
      docs: [...this.docsRead],
      taken: [...this.taken],
      doors,
    };
  }

  async save(slot: Slot) {
    if (this.mode !== 'play' && slot === 'manual') return;
    try {
      await saves.write(slot, this.serialize());
      if (slot === 'manual') toast('Игра сохранена');
    } catch {
      toast('Не удалось сохранить');
    }
  }

  private applySave(d: SaveData) {
    this.seed = d.seed;
    this.anomalies.reseed(d.seed);
    this.flags = { ...d.flags };
    this.deaths = d.flags.deaths ?? 0;
    this.playTime = d.playTime;
    this.director.reset(d.beats);
    this.inv.load(d.inv);
    for (const id of d.taken) this.takePickup(id, true);
    this.inv.load(d.inv); // pickups above may have re-added items
    this.flashlight.owned = d.flashlight.owned;
    this.hands.torchVisible = d.flashlight.owned;
    this.flashlight.battery = d.flashlight.battery;
    this.flashlight.on = d.flashlight.on && d.flashlight.battery > 0;
    d.docs.forEach((x) => this.docsRead.add(x));
    for (const dr of this.world.ctx.doors) {
      const s = d.doors[dr.id];
      if (!s) continue;
      dr.setLocked(s.locked);
      dr.setOpen(s.open, true);
    }
    this.stage = d.stage;
    this.episode.applyFlags();
    this.player.teleport(d.player.x, d.player.y + 0.05, d.player.z, d.player.yaw);
    this.player.health = d.player.health;
    this.player.stamina = d.player.stamina;
    this.syncInventoryUI();
    this.refreshObjective(true);
    useGame.getState().set({ docsRead: [...this.docsRead] });
  }

  async continueFromCheckpoint() {
    const d = await saves.read('auto');
    this.deaths++;
    if (d) {
      d.flags.deaths = this.deaths;
      await this.begin(d);
    } else await this.begin(null);
  }

  endEpisode() {
    this.mode = 'menu';
    this.input.enabled = false;
    this.creature?.despawn();
    void saves.clear();
    useGame.getState().set({ screen: 'end', hasSave: false, stats: { playTime: this.playTime, deaths: this.deaths, docs: this.docsRead.size, docsTotal: Object.keys(DOCS).length } });
    telegram.setBack(null);
  }

  toMenu() {
    this.mode = 'menu';
    this.engine.paused = false;
    this.input.enabled = false;
    this.audio.setDuck(1);
    this.creature?.despawn();
    useGame.getState().set({ screen: 'menu', invOpen: false, journalOpen: false, reading: null, subtitles: [] });
    telegram.setBack(null);
    this.fadeTo(0, 1);
  }

  private onQuality(_q: Quality, p: QualityProfile) {
    this.world.applyProfile(p);
    this.flashlight.setShadow(p.shadow);
    if (this.ph) this.ph.activeRadius = p.physicsRadius;
    void resolveQuality;
  }

  zone(): Zone {
    const p = this.player.pos;
    for (const [k, z] of Object.entries(ZONES)) if (Math.abs(p.x - z.x) < z.hx + 6 && Math.abs(p.z - z.z) < z.hz + 6) return k as Zone;
    return 'forest';
  }

  // ------------------------------------------------------------------ frame
  private update(dt: number, t: number) {
    const cam = this.engine.camera;
    if (this.mode === 'menu') {
      // slow cinematic drift around the gate booth
      this.menuT += Math.max(dt, 1 / 120);
      const k = this.menuT * 0.045;
      cam.position.set(-3.5 + Math.sin(k) * 2.2, 1.85 + Math.sin(k * 2.3) * 0.12, 6.5 + Math.cos(k * 0.8) * 1.6);
      cam.rotation.order = 'YXZ';
      // look across the yard at the booth, the gate lamp and the treeline
      cam.rotation.set(0.02 + Math.sin(k * 1.7) * 0.02, -1.05 + Math.sin(k * 0.6) * 0.18, 0);
      cam.updateMatrixWorld();
      this.world.pool.powered.base = true;
    } else if (this.ph) {
      this.playTime += dt;
      this.input.update();
      const look = { x: 0, y: 0 };
      this.player.update(dt);
      look.x = this.player.yaw - this.lastLook.x;
      look.y = this.player.pitch - this.lastLook.y;
      this.lastLook.x = this.player.yaw;
      this.lastLook.y = this.player.pitch;
      this.grab?.update();
      this.ph.step(dt, this.player.pos);
      this.creature?.update(dt, t);
      this.flare.update(dt, t);
      if (this.flare.active && this.creature && this.creature.mode === 'hunt' && this.creature.pos.distanceTo(this.flare.pos) < 7 && this.creature.fsm.state !== 'Flee') this.creature.stun();
      this.flashlight.update(dt, look, t);
      this.hands.update(dt, look, this.player.speed, t, this.flashlight.on);
      this.interact.update(cam);
      this.director.update(dt);
      this.anomalies.update(dt, t);
      this.figures.update(t);
      if (this.player.dead && useGame.getState().screen === 'playing') this.onDeath();
    }
    // world, audio, post
    this.world.update(dt, t, cam, this.mode === 'play' ? this.player.pos : cam.position, this.flashlight.light.intensity / 75, this.engine.renderer.getPixelRatio());
    this.cctv.update(dt, t, this.player.pos, (m) => this.screenPowered(m));
    if (this.audio.ready) {
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      this.audio.updateListener(cam.position, fwd);
      const ind = this.world.indoorAt(cam.position);
      this.zoneName = this.zone();
      this.ambience.update(dt, cam.position, this.zoneName, ind?.closed ?? 0, this.mode === 'play' ? this.fear : 0, 1);
    }
    // fear: creature proximity & awareness
    const c = this.creature;
    let fearT = 0;
    if (c && c.mode !== 'off') {
      const d = c.pos.distanceTo(this.player.pos);
      fearT = Math.max(0, 1 - d / 25) * (c.fsm.state === 'Chase' ? 1 : 0.6);
    }
    this.fear += (fearT - this.fear) * Math.min(1, dt * 2);
    this.flashlight.setDisturbance(this.fear > 0.4 ? this.fear : this.anomalies.disturb);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.4);
    const lowHp = this.mode === 'play' ? Math.max(0, (40 - this.player.health) / 40) * 0.45 : 0;
    const u = this.engine.post.u;
    u.uDamage.value = Math.max(this.damageFlash, lowHp * (0.6 + 0.4 * Math.sin(t * 3)));
    u.uFear.value = this.fear * 0.8 + this.anomalies.disturb * 0.4;
    this.fade += Math.sign(this.fadeTarget - this.fade) * Math.min(Math.abs(this.fadeTarget - this.fade), dt * this.fadeSpeed + 0.0001);
    u.uFade.value = this.fade;
    // HUD at 10 Hz
    this.hudT -= dt;
    if (this.hudT <= 0 || dt === 0) {
      this.hudT = 0.1;
      this.pushHud();
    }
  }

  private screenPowered(m: THREE.Mesh) {
    const s = this.world.ctx.spots;
    if (m === s.cctvScreen || m === s.cctvScreen2) return this.world.pool.powered.base;
    return this.world.pool.powered.complex;
  }

  private onDeath() {
    this.mode = 'menu';
    this.input.enabled = false;
    this.grab?.drop();
    this.fadeTo(0.92, 1.2);
    useGame.getState().set({ screen: 'dead', invOpen: false, journalOpen: false });
    telegram.setBack(null);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private pushHud() {
    const p = this.player;
    const f = this.interact.focus;
    let prompt: { text: string; verb: Verb } | null = null;
    if (this.mode === 'play') {
      if (this.grab?.held) prompt = { text: this.input.usingTouch ? 'Положить · бросить — кнопкой «Действие»' : 'E — положить · ЛКМ/R — бросить', verb: 'hand' };
      else if (f) prompt = { text: f.label() ?? '', verb: f.verb?.() ?? 'hand' };
      else {
        const pr = this.grab?.aimed();
        if (pr) prompt = { text: 'Поднять', verb: 'hand' };
      }
    }
    this.clockMin = 40 + Math.floor(this.playTime / 20);
    this.cctv.setClock(formatClock(this.clockMin));
    useGame.getState().set({
      health: p.health,
      battery: this.flashlight.battery,
      stamina: p.stamina,
      noise: p.noise,
      flashlightOn: this.flashlight.on,
      crouching: p.crouching,
      sprinting: p.running,
      prompt,
      holding: !!this.grab?.held,
      fps: this.engine.fps,
    });
  }

  /** Debug/test hooks (also used by the e2e playthrough). */
  get debug() {
    return {
      game: this,
      tp: (x: number, z: number, y = 0.2) => this.player.teleport(x, y, z),
      stage: (n: number) => this.setStage(n, false),
      give: (id: ItemId, n = 1) => {
        this.inv.add(id, n);
        this.syncInventoryUI();
      },
    };
  }

  dispose() {
    this.disposed = true;
    this.engine.dispose();
    this.input.dispose();
    this.audio.dispose();
  }
}
