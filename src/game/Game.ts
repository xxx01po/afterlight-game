import * as THREE from 'three';
import { Engine } from './core/Engine';
import { Input } from './core/Input';
import { Player, EYE } from './player/Player';
import { WorldBuilder } from './world/builder';
import { buildTextures, radialBlob } from './world/textures';
import { buildMaterials } from './world/materials';
import { buildApartment, type ApartmentRefs } from './world/apartment';
import { buildLanding, type LandingRefs } from './world/landing';
import { buildOutside } from './world/outside';
import { Mirror } from './world/Mirror';
import { mergeStatic } from './world/mergeStatic';
import { updateLamp, type Lamp } from './world/lights';
import { InteractionSystem } from './interactions/InteractionSystem';
import { Director, type Beat } from './narrative/Director';
import { DialogueRunner } from './dialogue/DialogueRunner';
import type { Dialogue, DialogueContext } from './dialogue/types';
import { audio } from './audio';
import { Soundscape } from './audio/Soundscape';
import { occlusionBetween, type Edge } from './audio/occlusion';
import * as S from './audio/synth';
import type { Vec3 } from './audio/AudioEngine';
import { story } from './state/storyStore';
import { snapshot } from './state/story';
import type { FlagValue, StoryState } from './state/types';
import { useUI, say, setObjective, toast, inputBlocked } from './state/ui';
import { useSettings } from './state/settings';
import { saves } from './save/SaveSystem';
import { formatClock } from '@/utils/math';
import type { Interactable } from './interactions/types';

export interface ChapterModule {
  beats: Beat<Game>[];
  interactables: (g: Game) => Interactable[];
  applyWorld: (g: Game) => void;
  update?: (g: Game, dt: number, t: number) => void;
}

let current: Game | null = null;
export const getGame = () => current;

/**
 * Composition root of a play session: builds the world, wires systems and
 * exposes high-level verbs (say, wait, knock, receive message, call…) used by
 * chapter scripts. React UI talks to the game only through this object and
 * the stores.
 */
export class Game {
  readonly engine: Engine;
  readonly input: Input;
  readonly player: Player;
  readonly builder: WorldBuilder;
  readonly apt: ApartmentRefs;
  readonly land: LandingRefs;
  readonly mirror: Mirror;
  readonly interactions: InteractionSystem;
  readonly director: Director<Game>;
  readonly lamps: Record<string, Lamp>;
  readonly flashlight: THREE.SpotLight;
  readonly peepCam: THREE.PerspectiveCamera;
  sound: Soundscape | null = null;
  private outside: ReturnType<typeof buildOutside>;
  private edges: Edge[];
  private dialogue: DialogueRunner | null = null;
  private unsubs: (() => void)[] = [];
  private pendingSeen = new Map<string, number>();
  private callResolve: ((r: 'answered' | 'declined' | 'missed') => void) | null = null;
  private callTimer = 0;
  private ringTimer = 0;
  private recording: { id: string; t: number; dur: number } | null = null;
  readonly story = story;
  disposed = false;

  constructor(container: HTMLElement, private chapter: ChapterModule, initial: StoryState) {
    current = this;
    story.getState().load(initial);
    this.engine = new Engine(container);
    const tex = buildTextures();
    const mats = buildMaterials(tex);
    this.builder = new WorldBuilder(radialBlob());
    this.apt = buildApartment(this.builder, mats, tex);
    this.land = buildLanding(this.builder, mats);
    this.outside = buildOutside(this.builder);
    this.mirror = new Mirror(this.builder.root, this.apt.mirrorSpot, this.engine.preset.mirror);
    this.engine.scene.add(this.builder.root);
    this.lamps = { ...this.apt.lamps, ...this.land.lamps };

    // ambient: cold night through windows + very low fill
    const hemi = new THREE.HemisphereLight(0x4c545e, 0x1c1915, 0.3);
    this.engine.scene.add(hemi);
    const moon = new THREE.DirectionalLight(0x6f82a0, 0.18);
    moon.position.set(2, 6, 20);
    this.engine.scene.add(moon);

    // phone flashlight (always in the shader, toggled by intensity)
    this.flashlight = new THREE.SpotLight(0xe8eeff, 0, 9, 0.55, 0.6, 2);
    this.flashlight.position.set(0.12, -0.15, 0);
    this.flashlight.target.position.set(0, -0.1, -1);
    this.engine.camera.add(this.flashlight, this.flashlight.target);
    this.engine.scene.add(this.engine.camera);

    this.peepCam = new THREE.PerspectiveCamera(105, 1, 0.05, 60);
    this.peepCam.position.set(3.8, 1.55, -0.14);
    this.peepCam.rotation.set(-0.08, 0, 0);

    this.input = new Input(container);
    this.player = new Player(this.engine.camera, this.input, () => this.builder.colliders, this.builder.rooms);
    const p = story.getState().player;
    this.player.place(p.x, p.z, p.yaw, p.pitch);
    this.player.onStep = (room) => this.sound?.local((e, d) => S.footstep(e, d, room?.floor ?? 'linoleum', 0.5));
    this.mirror.bindCamera(this.engine.camera);

    // sound propagation graph
    const d = this.apt.doors, ld = this.land.doors;
    const open = (door: { open: boolean }) => () => door.open;
    this.edges = [
      { a: 'hall', b: 'bath', kind: 'door', isOpen: open(d.bath) },
      { a: 'hall', b: 'room', kind: 'door', isOpen: open(d.room) },
      { a: 'hall', b: 'closet', kind: 'door', isOpen: open(d.closet) },
      { a: 'hall', b: 'kitchen', kind: 'open' },
      { a: 'hall', b: 'landing', kind: 'frontDoor', isOpen: open(d.front) },
      { a: 'landing', b: 'elevator', kind: 'door', isOpen: () => this.land.elevator.open > 0.5 },
      { a: 'landing', b: 'apt48', kind: 'frontDoor', isOpen: open(ld.d48) },
      { a: 'landing', b: 'apt46', kind: 'frontDoor' },
      { a: 'landing', b: 'shaft', kind: 'wall' },
      { a: 'room', b: 'apt48', kind: 'wall' },
      { a: 'bath', b: 'apt48', kind: 'wall' },
      { a: 'kitchen', b: 'apt46', kind: 'wall' },
      { a: 'outside', b: 'room', kind: 'window' },
      { a: 'outside', b: 'kitchen', kind: 'window' },
      { a: 'outside', b: 'landing', kind: 'window' },
      { a: 'upstairs', b: 'room', kind: 'ceiling' },
      { a: 'upstairs', b: 'hall', kind: 'ceiling' },
    ];
    audio.occlusion = (src, lis) => occlusionBetween(this.edges, src, lis);
    Object.values({ ...d, ...ld }).forEach((door) => (door.onChange = () => audio.refreshOcclusion()));

    const its = chapter.interactables(this);
    its.forEach((i) => i.objects.forEach((o) => o.traverse((c) => (c.userData.interactId = i.id))));
    const merged = mergeStatic(this.builder.root, this.builder.occluders);
    console.info(`[afterlight] merged ${merged.removed} static meshes into ${merged.created}`);
    this.interactions = new InteractionSystem(this.engine.camera, [], this.builder.occluders);
    for (const it of its) this.interactions.register(it);

    this.director = new Director<Game>(chapter.beats, () => story.getState(), () => this);
    this.director.onError = (e) => console.error('[director]', e);
    this.director.syncFromStore();

    this.input.onAction = (a) => {
      if (a === 'pause') this.togglePause();
      else if (a === 'interact') this.interact();
      else if (a === 'flashlight') this.toggleFlashlight();
      else if (a === 'phone') this.togglePhone();
    };

    // world = f(state): re-apply whenever reality variables change
    let lastWorld = story.getState().world;
    this.unsubs.push(
      story.subscribe((s) => {
        if (s.world !== lastWorld) {
          lastWorld = s.world;
          this.chapter.applyWorld(this);
        }
      }),
    );
    this.unsubs.push(
      useSettings.subscribe((s, prev) => {
        if (s.quality !== prev.quality) this.engine.applyQuality(s.quality);
      }),
    );
    this.engine.add((dt, t) => this.update(dt, t));
    document.addEventListener('visibilitychange', this.onVisibility);
    this.chapter.applyWorld(this);
    // first frame is rendered immediately (behind the loading fade)
    this.engine.resize();
  }

  /** Must run inside a user gesture (Start/Continue button). */
  startAudio() {
    audio.unlock();
    if (!this.sound) {
      const a = this.apt.anchors, l = this.land.anchors;
      this.sound = new Soundscape(audio, (p) => this.roomAt(p), {
        rainRoom: { x: 1.6, y: 1.5, z: 7.6 },
        rainKitchen: { x: 6.1, y: 1.5, z: 7.6 },
        rainLanding: { x: 10.4, y: 1.6, z: -1.5 },
        fridge: a.fridge,
        ventBath: a.ventBath,
        ventKitchen: a.ventKitchen,
        tv: a.tv,
        tap: a.tap,
        hallLamp: { x: 3.8, y: 2.5, z: 1.5 },
        kettle: a.kettle,
      });
      void l;
      this.chapter.applyWorld(this);
    }
  }

  start() {
    this.engine.start();
  }

  // ---------------------------------------------------------------- loop
  private update(dt: number, t: number) {
    const ui = useUI.getState();
    this.outside.update(t);
    for (const l of Object.values(this.lamps)) updateLamp(l, dt, t);
    Object.values(this.apt.doors).forEach((d) => d.update(dt));
    Object.values(this.land.doors).forEach((d) => d.update(dt));
    this.updateElevator(dt);
    if (ui.paused) return;
    this.input.enabled = !inputBlocked();
    this.player.update(dt, t);
    const pr = this.player.room?.id ?? 'hall';
    const inBathZone = pr === 'bath' || (pr === 'hall' && this.player.z < 2.6 && this.apt.doors.bath.open);
    this.mirror.update(t, this.player.x, this.player.z, this.player.yaw, this.player.pitch, inBathZone && this.engine.preset.mirror > 0);
    const cam = this.engine.camera;
    const fwd = this.player.forward();
    audio.updateListener({ x: cam.position.x, y: cam.position.y, z: cam.position.z }, { x: fwd.x, y: fwd.y, z: fwd.z }, pr);
    this.sound?.update(dt);
    this.interactions.update();
    this.dialogue?.tick(dt);
    this.director.update(dt);
    this.chapter.update?.(this, dt, t);
    this.resolvePending(dt);
    this.updateCall(dt);
    this.updateRecording(dt);
    story.getState().addPlayTime(dt);
  }

  private updateElevator(dt: number) {
    const e = this.land.elevator;
    e.open += (e.target - e.open) * Math.min(1, dt * 1.6);
    e.left.position.x = 3.57 - e.open * 0.44;
    e.right.position.x = 4.03 + e.open * 0.44;
    e.collider.enabled = e.open < 0.8;
  }

  // ------------------------------------------------------------ queries
  get s() {
    return story.getState();
  }
  flag(k: string) {
    return this.s.flags[k];
  }
  setFlag(k: string, v: FlagValue) {
    this.s.setFlag(k, v);
  }
  world(k: string) {
    return this.s.world[k];
  }
  setWorld(k: string, v: FlagValue) {
    this.s.setWorld(k, v);
  }
  knows(id: string) {
    return this.s.knowledge.includes(id);
  }
  learn(id: string) {
    this.s.learn(id);
  }
  /** Change reality only while the player can't see `pos`. */
  unseen(key: string, value: FlagValue, pos: Vec3) {
    this.s.queueUnseen({ key, value, pos: [pos.x, pos.y, pos.z] });
  }
  roomAt(p: Vec3) {
    if (p.z > 6.95) return 'outside';
    if (p.y > 2.7) return 'upstairs';
    if (p.x < -0.1 && p.z > 0.1) return 'apt48';
    if (p.x > 4.7 && p.x < 7.5 && p.z > -0.3 && p.z < 2.35 && p.y > -0.1) return p.z < 0 ? 'landing' : 'apt46';
    if (p.z < -3.05) return p.x > 3.2 && p.x < 4.4 ? (p.z < -4.35 ? 'shaft' : 'elevator') : 'landing';
    for (const r of this.builder.rooms) if (p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ) return r.id;
    return 'landing';
  }
  room() {
    return this.player.room?.id ?? 'hall';
  }
  dist(p: Vec3) {
    return Math.hypot(p.x - this.player.x, p.z - this.player.z);
  }
  /** Is the player looking at p (within cone) and within distance? */
  looking(p: Vec3, maxDist = 4, cos = 0.9) {
    const cam = this.engine.camera;
    const v = new THREE.Vector3(p.x, p.y, p.z).sub(cam.position);
    const d = v.length();
    if (d > maxDist) return false;
    return v.normalize().dot(this.player.forward()) > cos;
  }
  private canSee(p: Vec3) {
    const cam = this.engine.camera;
    const v = new THREE.Vector3(p.x, p.y, p.z).sub(cam.position);
    const d = v.length();
    if (d > 9) return false;
    const target = this.roomAt(p);
    const me = this.room();
    // different room and not adjacent through an open door → can't see
    if (target !== me) {
      const occ = occlusionBetween(this.edges, target, me);
      if (occ.cutoff < 5000) return false;
    }
    const fovCos = Math.cos(THREE.MathUtils.degToRad(Math.max(cam.fov, cam.fov * cam.aspect) / 2 + 12));
    return v.normalize().dot(this.player.forward()) > fovCos;
  }
  private resolvePending(dt: number) {
    for (const p of this.s.pending) {
      const pos = { x: p.pos[0], y: p.pos[1], z: p.pos[2] };
      if (this.canSee(pos)) {
        this.pendingSeen.delete(p.key);
        continue;
      }
      const tt = (this.pendingSeen.get(p.key) ?? 0) + dt;
      this.pendingSeen.set(p.key, tt);
      if (tt > 0.6) {
        this.pendingSeen.delete(p.key);
        this.s.resolvePending(p.key);
      }
    }
  }

  // -------------------------------------------------------------- verbs
  wait(sec: number) {
    return this.director.wait(sec);
  }
  say(text: string, sec?: number, speaker?: string) {
    if (useSettings.getState().subtitles || speaker === undefined) say(text, sec, speaker);
  }
  objective(text: string | null) {
    setObjective(text);
  }
  setClock(min: number) {
    this.s.setClock(min);
  }
  get clock() {
    return formatClock(this.s.clockMin);
  }
  /** Three (or n) knocks on a door anchor. */
  knock(pos: Vec3, n = 3, strength = 1) {
    this.sound?.at(pos, (e, d) => S.knockSeq(e, d, n, 0.62, strength), 5, true);
  }
  sfx(pos: Vec3 | null, fn: (e: typeof audio, d: AudioNode) => void, life = 5) {
    if (pos) this.sound?.at(pos, fn, life);
    else this.sound?.local(fn);
  }
  music(fn: (e: typeof audio, d: AudioNode) => void) {
    this.sound?.local(fn, 'music');
  }
  vibrate(times = 2) {
    useUI.setState({ phoneVibrating: true });
    for (let i = 0; i < times; i++) setTimeout(() => this.sound?.local((e, d) => S.vibrate(e, d, 0.45)), i * 800);
    navigator.vibrate?.(Array.from({ length: times * 2 - 1 }, (_, i) => (i % 2 ? 350 : 450)));
    setTimeout(() => useUI.setState({ phoneVibrating: false }), times * 800 + 200);
  }
  /** Incoming SMS: stored in the phone + vibration + banner. */
  receive(threadId: string, text: string) {
    this.s.pushMessage(threadId, { from: 'them', text });
    this.vibrate(2);
    const th = this.s.phone.threads.find((t) => t.id === threadId);
    useUI.setState({ toast: `${th?.name ?? ''}: ${text}` });
    setTimeout(() => {
      if (useUI.getState().toast?.endsWith(text)) useUI.setState({ toast: null });
    }, 5000);
  }
  /** Ring the phone; resolves with what the player did. */
  incomingCall(name: string, number: string, timeout = 22) {
    return new Promise<'answered' | 'declined' | 'missed'>((resolve) => {
      this.callResolve = resolve;
      this.callTimer = timeout;
      this.ringTimer = 0;
      useUI.setState({ incomingCall: { name, number }, phoneOpen: false });
      this.input.reset();
    });
  }
  private updateCall(dt: number) {
    if (!this.callResolve) return;
    this.callTimer -= dt;
    this.ringTimer -= dt;
    if (this.ringTimer <= 0) {
      this.ringTimer = 2.2;
      this.sound?.local((e, d) => S.ringtone(e, d));
      this.sound?.local((e, d) => S.vibrate(e, d, 0.6));
      navigator.vibrate?.(500);
    }
    if (this.callTimer <= 0) this.endCall('missed');
  }
  endCall(r: 'answered' | 'declined' | 'missed') {
    const res = this.callResolve;
    if (!res) return;
    this.callResolve = null;
    const c = useUI.getState().incomingCall;
    useUI.setState({ incomingCall: null, activeCall: r === 'answered' && c ? { name: c.name, startedAt: performance.now() } : null });
    this.s.addCall({ contact: c?.name ?? '?', dir: r === 'answered' ? 'in' : 'missed', time: this.clock, duration: r === 'answered' ? '0:24' : undefined });
    res(r);
  }
  hangUp() {
    useUI.setState({ activeCall: null });
  }

  /** Run a dialogue; resolves with its outcome. */
  runDialogue(dlg: Dialogue, emit: (ev: string, payload?: unknown) => void) {
    const ctx: DialogueContext = {
      flag: (k) => this.flag(k),
      setFlag: (k, v) => this.setFlag(k, v),
      has: (i) => this.s.inventory.includes(i),
      knows: (k) => this.knows(k),
      learn: (k) => this.learn(k),
      relation: (id, dv) => this.s.setCharacter(id, { relation: (this.s.characters[id]?.relation ?? 0) + dv, met: true }),
      record: (id, label) => this.s.record(id, label),
      emit,
    };
    return new Promise<string>((resolve) => {
      const r = new DialogueRunner(dlg, ctx);
      this.dialogue = r;
      r.onView = (v) => useUI.setState({ dialogue: v ? { speaker: v.speaker, text: v.text, choices: v.choices, muffled: v.muffled, canContinue: v.canContinue } : null });
      r.onEnd = (o) => {
        this.dialogue = null;
        useUI.setState({ dialogue: null });
        resolve(o);
      };
      this.input.reset();
      r.start();
    });
  }
  dialogueChoose(id: string) {
    this.sound?.local((e, d) => S.uiTick(e, d, 900));
    this.dialogue?.choose(id);
  }
  dialogueAdvance() {
    this.dialogue?.advance();
  }
  refreshDialogue() {
    const r = this.dialogue;
    if (r) r.onView?.(r.view());
  }

  /** Look through the front door peephole until the player steps back. */
  peephole() {
    return new Promise<void>((resolve) => {
      this.engine.viewCamera = this.peepCam;
      this.engine.post.mat.uniforms.uBarrel.value = 1;
      this.engine.resize();
      useUI.setState({ peephole: true });
      this.sound?.local((e, d) => S.click(e, d, 0.6));
      const unsub = useUI.subscribe((s) => {
        if (!s.peephole) {
          unsub();
          this.engine.viewCamera = this.engine.camera;
          this.engine.post.mat.uniforms.uBarrel.value = 0;
          this.engine.resize();
          resolve();
        }
      });
    });
  }

  fade(to: number, ms = 1200) {
    useUI.setState({ fade: to, fadeMs: ms });
    return this.wait(ms / 1000);
  }
  async cutsceneLook(target: Vec3, seconds: number, moveTo?: { x: number; z: number }) {
    useUI.setState({ cutscene: true });
    this.player.lookAt(new THREE.Vector3(target.x, target.y, target.z), 2.6, moveTo);
    await this.wait(seconds);
    this.player.lookAt(null);
    useUI.setState({ cutscene: false });
  }

  setFlashlight(on: boolean) {
    this.flashlight.intensity = on ? 9 : 0;
    useUI.setState({ flashlight: on });
  }
  toggleFlashlight() {
    if (useUI.getState().paused) return;
    this.setFlashlight(!useUI.getState().flashlight);
    this.sound?.local((e, d) => S.click(e, d, 1.4), 'ui');
  }
  togglePhone(open?: boolean) {
    const u = useUI.getState();
    if (u.paused || u.dialogue || u.reader || u.cutscene || u.peephole) return;
    const v = open ?? !u.phoneOpen;
    useUI.setState({ phoneOpen: v, phoneApp: v ? u.phoneApp : u.phoneApp, prompt: null });
    this.sound?.local((e, d) => S.uiTick(e, d, v ? 1400 : 900), 'ui');
    this.input.reset();
    if (v) this.director.mark('phoneOpened');
  }
  interact() {
    if (useUI.getState().dialogue?.canContinue) return this.dialogueAdvance();
    this.interactions.interact();
  }
  read(title: string, body: string, style: 'paper' | 'flyer' | 'photo' | 'polaroid' | 'plain' = 'paper', image?: string) {
    useUI.setState({ reader: { title, body, style, image }, prompt: null });
    this.input.reset();
    return new Promise<void>((resolve) => {
      const unsub = useUI.subscribe((s) => {
        if (!s.reader) {
          unsub();
          resolve();
        }
      });
    });
  }

  // ------------------------------------------------------------ phone
  /** Place an outgoing call from the phone UI. Resolves with the network's answer. */
  async dial(threadId: string): Promise<string> {
    const th = this.s.phone.threads.find((t) => t.id === threadId);
    this.director.mark('dialed_' + threadId);
    const beep = (n: number, f = 425) => {
      for (let i = 0; i < n; i++) setTimeout(() => this.sound?.local((e, d) => S.mallet(e, d, f, e.now, 0.05, 0.9)), i * 1600);
    };
    const res = (() => {
      switch (threadId) {
        case 'me':
          return 'Занято';
        case 'galina':
          return 'Номер не обслуживается';
        case 'uk':
          return 'Вызов невозможен';
        default:
          return 'Абонент не отвечает';
      }
    })();
    if (threadId === 'me') {
      for (let i = 0; i < 6; i++) setTimeout(() => this.sound?.local((e, d) => S.mallet(e, d, 425, e.now, 0.05, 0.2)), i * 400);
      this.learn('ownBusy');
    } else beep(threadId === 'galina' ? 1 : 3);
    this.s.addCall({ contact: th?.name ?? threadId, dir: 'out', time: this.clock });
    if (threadId === 'galina') setTimeout(() => this.learn('galinaNumberDead'), 1500);
    return res;
  }

  /** Reply in a thread. Messages to your own number never arrive. */
  reply(threadId: string, text: string) {
    this.s.pushMessage(threadId, { from: 'me', text, status: threadId === 'me' ? 'failed' : 'sent' }, false);
    this.sound?.local((e, d) => S.uiTick(e, d, 1600), 'ui');
    if (threadId === 'me') {
      this.setFlag('repliedMe', true);
      setTimeout(() => this.say('Не доставлено.', 2.2), 900);
    }
  }

  viewPhoto(id: string) {
    this.director.mark('photo_' + id);
    if (id === 'p_door48' && !this.knows('photoDoor48')) {
      this.learn('photoDoor48');
      setTimeout(() => this.say('Четырнадцатое октября. Прошлого года. 03:17.\nЯ не помню, как это снимал.', 5), 700);
    }
    if (id === 'p_balcony' && !this.knows('balconyPhone')) {
      this.learn('balconyPhone');
      setTimeout(() => this.say('Тот же снимок, что на полке. Год назад. Значит, я её знал.', 4.5), 700);
    }
  }

  // ---------------------------------------------------------- recordings
  playRecording(id: string) {
    const r = this.s.phone.recordings.find((x) => x.id === id);
    if (!r) return;
    this.recording = { id, t: 0, dur: Math.min(r.duration, r.kind === 'self' ? r.duration : 30) };
    useUI.setState({ toast: null });
    if (r.kind === 'self') {
      this.sound?.local((e, d) => S.drone(e, d, 30, 49), 'music');
      this.director.mark('recordingPlayed');
    }
  }
  stopRecording() {
    this.recording = null;
    recordingTime.set(-1, '');
  }
  private updateRecording(dt: number) {
    const rec = this.recording;
    if (!rec) return;
    const r = this.s.phone.recordings.find((x) => x.id === rec.id)!;
    const prevT = rec.t;
    rec.t += dt;
    recordingTime.set(rec.t, rec.id);
    // sound bed: hiss + murmured speech per transcript line
    if (Math.floor(prevT * 2) !== Math.floor(rec.t * 2)) this.sound?.local((e, d) => S.paper(e, d, 0.05));
    for (const line of r.transcript)
      if (line.t > prevT && line.t <= rec.t && !line.text.startsWith('[')) {
        const dur = Math.min(4, line.text.length * 0.06);
        this.sound?.local((e, d) => S.murmur(e, d, dur, r.kind === 'self' ? 120 : 140, 2600, 0.35));
      } else if (line.t > prevT && line.t <= rec.t && line.text.includes('удара')) this.sound?.local((e, d) => S.knockSeq(e, d, 3, 0.6, 0.5));
    if (rec.t >= rec.dur) this.stopRecording();
  }

  // --------------------------------------------------------- save / load
  canSave() {
    const u = useUI.getState();
    return this.director.busy === 0 && !u.dialogue && !u.incomingCall && !u.peephole && !u.cutscene && !this.s.flags.ended;
  }
  save(manual = false) {
    if (!this.canSave()) {
      if (manual) toast('Сейчас нельзя сохраниться');
      return false;
    }
    this.s.savePlayer({ x: this.player.x, z: this.player.z, yaw: this.player.yaw, pitch: this.player.pitch });
    const ok = saves.save(snapshot(story));
    if (manual) toast(ok ? 'Сохранено' : 'Не удалось сохранить');
    return ok;
  }
  checkpoint() {
    setTimeout(() => this.save(false), 50);
  }

  togglePause(v?: boolean) {
    const u = useUI.getState();
    if (u.screen !== 'game' || u.loading) return;
    const p = v ?? !u.paused;
    useUI.setState({ paused: p });
    audio.setDuck(p ? 0.25 : 1);
    if (p && document.pointerLockElement) document.exitPointerLock();
    this.input.reset();
  }

  private onVisibility = () => {
    if (document.hidden) {
      this.togglePause(true);
      audio.suspend();
      this.engine.stop();
    } else {
      this.engine.start();
      // audio resumes on the next user gesture (Continue button)
    }
  };

  end(id: string) {
    this.setFlag('ended', id);
    // keep the chapter outcome for Chapter 2; the resumable slot is cleared
    try {
      localStorage.setItem('afterlight.ch1.result', JSON.stringify({ ending: id, flags: this.s.flags, knowledge: this.s.knowledge, characters: this.s.characters, choices: this.s.choices, at: Date.now() }));
    } catch {
      /* storage unavailable */
    }
    saves.clear();
    useUI.setState({ ending: id, screen: 'ending', phoneOpen: false, dialogue: null, prompt: null });
    this.sound?.local((e, d) => S.endingMotif(e, d), 'music');
  }

  /** Test/debug helper: run an interactable's action by id (ignores aim). */
  debugInteract(id: string) {
    const it = this.interactions.get(id);
    if (!it) throw new Error('no interactable ' + id);
    const label = it.label();
    if (label) it.act();
    return label;
  }

  dispose() {
    this.disposed = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.unsubs.forEach((u) => u());
    this.input.dispose();
    this.sound?.dispose();
    this.engine.dispose();
    if (current === this) current = null;
  }
}

/** Lightweight shared clock for the recorder UI. */
export const recordingTime = {
  t: -1,
  id: '',
  listeners: new Set<() => void>(),
  set(t: number, id: string) {
    this.t = t;
    this.id = id;
    this.listeners.forEach((l) => l());
  },
};

export { EYE };
